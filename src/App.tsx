import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Reader from "./Reader";
import { storage } from "./storage";
import { analyzeDocument } from "./documentAnalysis";
import type { Book, BookNote, ReadingPlanSession, ReadingSession, StoredBook } from "./types";

type Page = "library" | "reader" | "coach";
type Filter = "all" | "unread" | "reading" | "finished";

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
};

const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (date: string, days: number) => {
  const result = new Date(`${date}T12:00:00`);
  result.setDate(result.getDate() + days);
  return dateKey(result);
};

function createSchedule(startPage: number, totalPages: number, startDate: string, endDate: string): ReadingPlanSession[] {
  const dayCount = Math.max(0, Math.floor((new Date(`${endDate}T12:00:00`).getTime() - new Date(`${startDate}T12:00:00`).getTime()) / 86400_000) + 1);
  const remaining = Math.max(0, totalPages - startPage + 1);
  if (!dayCount || !remaining) return [];
  const schedule: ReadingPlanSession[] = [];
  let nextPage = startPage;
  for (let day = 0; day < dayCount && nextPage <= totalPages; day += 1) {
    const daysLeft = dayCount - day;
    const amount = Math.ceil((totalPages - nextPage + 1) / daysLeft);
    schedule.push({ date: addDays(startDate, day), startPage: nextPage, endPage: Math.min(totalPages, nextPage + amount - 1) });
    nextPage += amount;
  }
  return schedule;
}

function refreshSchedule(book: StoredBook, today: string): StoredBook {
  if (!book.goalDate || !book.totalPages) return book;
  if (!book.readingPlan) {
    return { ...book, readingPlan: createSchedule(book.currentPage, book.totalPages, today, book.goalDate) };
  }
  const past = book.readingPlan.filter((session) => session.date < today);
  const todaySession = book.readingPlan.find((session) => session.date === today);
  if (todaySession && book.currentPage <= todaySession.endPage) {
    const future = createSchedule(Math.max(todaySession.endPage + 1, book.currentPage + 1), book.totalPages, addDays(today, 1), book.goalDate);
    return { ...book, readingPlan: [...past, todaySession, ...future] };
  }
  const startDate = todaySession ? addDays(today, 1) : today;
  const startPage = todaySession ? book.currentPage + 1 : book.currentPage;
  const future = createSchedule(startPage, book.totalPages, startDate, book.goalDate);
  return { ...book, readingPlan: [...past, ...(todaySession ? [todaySession] : []), ...future] };
}

function createSummary(text: string): string {
  const sentences = text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((item) => item.trim()).filter((item) => item.length > 35) ?? [];
  if (!sentences.length) return "";
  const frequencies = new Map<string, number>();
  const words = text.toLocaleLowerCase().match(/\p{L}{4,}/gu) ?? [];
  for (const word of words) frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
  return sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score: (sentence.toLocaleLowerCase().match(/\p{L}{4,}/gu) ?? []).reduce((score, word) => score + (frequencies.get(word) ?? 0), 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(3, sentences.length))
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence)
    .join(" ");
}

function App() {
  const [books, setBooks] = useState<StoredBook[]>([]);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [notes, setNotes] = useState<Record<string, BookNote>>({});
  const [page, setPage] = useState<Page>("library");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [activeBook, setActiveBook] = useState<StoredBook | null>(null);
  const [selectedCoachBook, setSelectedCoachBook] = useState("");
  const [passage, setPassage] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(Number(localStorage.getItem("readflow-daily-goal") || 20));
  const [lightMode, setLightMode] = useState(localStorage.getItem("readflow-theme") === "light");
  const [goalChoice, setGoalChoice] = useState("14");
  const [customDate, setCustomDate] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([storage.listBooks(), storage.listSessions()])
      .then(([loadedBooks, loadedSessions]) => {
        const refreshedBooks = loadedBooks.map((book) => refreshSchedule(book, dateKey()));
        setBooks(refreshedBooks.sort((a, b) => b.addedAt - a.addedAt));
        setSessions(loadedSessions);
        void Promise.all(refreshedBooks.map((book, index) =>
          JSON.stringify(book.readingPlan) === JSON.stringify(loadedBooks[index].readingPlan)
            ? Promise.resolve()
            : storage.saveBook(book),
        )).catch((reason: unknown) => setError(`Le plan de lecture n'a pas pu être actualisé : ${reason instanceof Error ? reason.message : "erreur inconnue"}`));
      })
      .catch((reason: unknown) => setError(`Le stockage local est indisponible : ${reason instanceof Error ? reason.message : "erreur inconnue"}`))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = lightMode ? "light" : "dark";
    localStorage.setItem("readflow-theme", lightMode ? "light" : "dark");
  }, [lightMode]);

  const saveBook = useCallback(async (book: StoredBook) => {
    await storage.saveBook(book);
    setBooks((current) => current.map((item) => item.id === book.id ? book : item));
    setActiveBook((current) => current?.id === book.id ? book : current);
  }, []);

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setError("");
    let imported = 0;
    try {
      for (const file of files) {
        const format = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : file.name.toLowerCase().endsWith(".epub") ? "epub" : null;
        if (!format) {
          setError(`${file.name} n'est pas pris en charge. Choisissez un fichier PDF ou EPUB.`);
          continue;
        }
        if (file.size === 0) {
          setError(`${file.name} est vide et n'a pas été importé.`);
          continue;
        }
        let totalPages: number;
        try {
          totalPages = await analyzeDocument(file, format);
        } catch (reason) {
          setError(`Analyse impossible pour ${file.name} : ${reason instanceof Error ? reason.message : "fichier invalide ou endommagé"}`);
          continue;
        }
        const book: StoredBook = {
          id: crypto.randomUUID(),
          title: file.name.replace(/\.(pdf|epub)$/i, "").replace(/[_-]+/g, " ").trim() || "Sans titre",
          format,
          size: file.size,
          addedAt: Date.now(),
          totalPages,
          currentPage: 1,
          progress: 0,
          status: "unread",
          file,
        };
        await storage.saveBook(book);
        setBooks((current) => [book, ...current]);
        imported += 1;
      }
      if (imported) setNotice(`${imported} livre${imported > 1 ? "s" : ""} ajouté${imported > 1 ? "s" : ""} à votre bibliothèque privée.`);
    } catch (reason) {
      setError(`Import impossible. Votre navigateur manque peut-être d'espace local : ${reason instanceof Error ? reason.message : "erreur inconnue"}`);
    } finally {
      setBusy(false);
      window.setTimeout(() => { setNotice(""); setError(""); }, 6500);
    }
  };

  const openBook = async (book: StoredBook) => {
    setError("");
    try {
      const fullBook = await storage.getBook(book.id);
      if (!fullBook) throw new Error("Le fichier n'a pas été trouvé dans le stockage local.");
      setActiveBook(fullBook);
      setPassage("");
      setPage("reader");
    } catch (reason) {
      setError(`Ouverture impossible : ${reason instanceof Error ? reason.message : "erreur inconnue"}`);
    }
  };

  const updateProgress = useCallback(async (id: string, patch: Partial<Book>): Promise<boolean> => {
    const current = books.find((book) => book.id === id);
    if (!current) return false;
    const updated = refreshSchedule({ ...current, ...patch }, dateKey());
    try {
      await saveBook(updated);
      return true;
    } catch (reason) {
      setError(`La progression n'a pas pu être enregistrée : ${reason instanceof Error ? reason.message : "erreur inconnue"}`);
      return false;
    }
  }, [books, saveBook]);

  const recordSession = useCallback((bookId: string, seconds: number) => {
    if (seconds <= 0) return;
    const id = `${bookId}-${dateKey()}`;
    setSessions((current) => {
      const previous = current.find((session) => session.id === id);
      const updated: ReadingSession = previous
        ? { ...previous, seconds: previous.seconds + seconds }
        : { id, bookId, startedAt: Date.now(), seconds };
      void storage.saveSession(updated).catch((reason: unknown) => setError(`Session non enregistrée : ${reason instanceof Error ? reason.message : "erreur inconnue"}`));
      return previous ? current.map((session) => session.id === id ? updated : session) : [...current, updated];
    });
  }, []);

  const removeBook = async (book: StoredBook) => {
    if (!window.confirm(`Supprimer « ${book.title} » et ses notes de cet appareil ?`)) return;
    try {
      await storage.deleteBook(book.id);
      setBooks((current) => current.filter((item) => item.id !== book.id));
      if (activeBook?.id === book.id) { setActiveBook(null); setPage("library"); }
      setNotice("Livre supprimé de cet appareil.");
    } catch (reason) {
      setError(`Suppression impossible : ${reason instanceof Error ? reason.message : "erreur inconnue"}`);
    }
  };

  const updateBookCover = async (book: StoredBook, coverImage?: Blob) => {
    try {
      const updated = { ...book };
      if (coverImage) updated.coverImage = coverImage;
      else delete updated.coverImage;
      await saveBook(updated);
      setNotice(coverImage ? `Couverture mise à jour pour « ${book.title} ».` : `Couverture personnalisée retirée de « ${book.title} ».`);
      window.setTimeout(() => setNotice(""), 4000);
    } catch (reason) {
      setError(`La couverture n'a pas pu être enregistrée : ${reason instanceof Error ? reason.message : "erreur inconnue"}`);
    }
  };

  const selectCoachBook = async (bookId: string) => {
    setSelectedCoachBook(bookId);
    if (!bookId) return;
    try {
      const existing = await storage.getNote(bookId);
      setNotes((current) => ({ ...current, [bookId]: existing ?? { bookId, text: "", summary: "" } }));
    } catch (reason) {
      setError(`Notes indisponibles : ${reason instanceof Error ? reason.message : "erreur inconnue"}`);
    }
  };

  const saveCoachNote = async (note: BookNote) => {
    setNotes((current) => ({ ...current, [note.bookId]: note }));
    try {
      await storage.saveNote(note);
    } catch (reason) {
      setError(`Notes non enregistrées : ${reason instanceof Error ? reason.message : "erreur inconnue"}`);
    }
  };

  const setBookGoal = async (book: StoredBook) => {
    if (!book.totalPages) {
      setError("Le nombre de pages ou de chapitres n'est pas encore disponible. Réimportez ou rouvrez le livre pour l'analyser.");
      return;
    }
    if (book.status === "finished" || book.currentPage > book.totalPages) {
      setError("Ce livre est déjà terminé : il n'y a plus de sessions à planifier.");
      return;
    }
    const target = goalChoice === "custom" ? customDate : (() => {
      const date = new Date();
      date.setDate(date.getDate() + Number(goalChoice) - 1);
      return dateKey(date);
    })();
    if (!target || target < dateKey()) {
      setError("Choisissez une date de fin située aujourd'hui ou plus tard.");
      return;
    }
    const schedule = createSchedule(book.currentPage, book.totalPages, dateKey(), target);
    const saved = await updateProgress(book.id, { goalDate: target, readingPlan: schedule });
    if (!saved) return;
    setNotice(`Votre plan de ${schedule.length} sessions quotidiennes a été enregistré sur cet appareil.`);
  };

  const visibleBooks = useMemo(() => books.filter((book) =>
    (filter === "all" || book.status === filter) && book.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  ), [books, filter, search]);
  const finishedCount = books.filter((book) => book.status === "finished").length;
  const totalSeconds = sessions.reduce((total, session) => total + session.seconds, 0);
  const todayKey = dateKey();
  const todaySeconds = sessions.filter((session) => dateKey(new Date(session.startedAt)) === todayKey).reduce((total, session) => total + session.seconds, 0);
  const weeklySessions = sessions.filter((session) => Date.now() - session.startedAt < 7 * 86400_000);
  const weekMinutes = Math.round(weeklySessions.reduce((total, session) => total + session.seconds, 0) / 60);
  const activeDays = new Set(sessions.filter((session) => session.seconds > 0).map((session) => dateKey(new Date(session.startedAt))));
  let streak = 0;
  const streakDay = new Date();
  if (!activeDays.has(dateKey(streakDay))) streakDay.setDate(streakDay.getDate() - 1);
  while (activeDays.has(dateKey(streakDay))) {
    streak += 1;
    streakDay.setDate(streakDay.getDate() - 1);
  }
  const activeCoachBook = books.find((book) => book.id === selectedCoachBook);
  const activeNote = activeCoachBook ? notes[activeCoachBook.id] ?? { bookId: activeCoachBook.id, text: "", summary: "" } : null;
  const goalDaysRemaining = activeCoachBook?.goalDate
    ? Math.max(1, Math.ceil((new Date(`${activeCoachBook.goalDate}T23:59:59`).getTime() - Date.now()) / 86400_000))
    : 14;
  const pagesPerDay = activeCoachBook ? Math.ceil(Math.max(0, activeCoachBook.totalPages - activeCoachBook.currentPage + 1) / goalDaysRemaining) : 0;
  const todayPlan = books.flatMap((book) => {
    const session = book.readingPlan?.find((item) => item.date === todayKey);
    return session ? [{ book, session }] : [];
  });

  const startCurrentBook = () => {
    const candidate = books.find((book) => book.status === "reading") ?? books.find((book) => book.status === "unread");
    if (candidate) void openBook(candidate);
    else setPage("library");
  };

  const activeBookId = activeBook?.id;
  const recordActiveSession = useCallback((seconds: number) => {
    if (activeBookId) recordSession(activeBookId, seconds);
  }, [activeBookId, recordSession]);
  const saveActiveProgress = useCallback((patch: Partial<Book>) => {
    if (activeBook) void updateProgress(activeBook.id, patch);
  }, [activeBook, updateProgress]);

  const saveDailyGoal = (value: number) => {
    const safeValue = Math.max(1, Math.min(500, value || 1));
    setDailyGoal(safeValue);
    localStorage.setItem("readflow-daily-goal", String(safeValue));
  };

  const exportData = async () => {
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        books: books.map(({ file: _file, coverImage: _coverImage, ...book }) => book),
        sessions,
        notes: await Promise.all(books.map((book) => storage.getNote(book.id))),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "readflow-sauvegarde.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(`Export impossible : ${reason instanceof Error ? reason.message : "erreur inconnue"}`);
    }
  };

  if (page === "reader" && activeBook) {
    return <Reader
      key={activeBook.id}
      book={activeBook}
      onClose={() => setPage("library")}
      onProgress={saveActiveProgress}
      onSession={recordActiveSession}
      onPassage={setPassage}
    />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setPage("library")} aria-label="ReadFlow, accueil">
          <span className="brand-mark"><span /></span><span>read<span>flow</span></span>
        </button>
        <div className="side-caption">ESPACE PERSONNEL</div>
        <nav className="main-nav" aria-label="Navigation principale">
          <button className={`nav-item ${page === "library" ? "active" : ""}`} onClick={() => setPage("library")}><span className="nav-icon">▤</span> Bibliothèque</button>
          <button className={`nav-item ${page === "coach" ? "active" : ""}`} onClick={() => setPage("coach")}><span className="nav-icon">✧</span> Coach de lecture</button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="privacy-card">
          <span className="privacy-icon">⬡</span>
          <strong>Vos livres restent privés</strong>
          <p>Stockés uniquement sur cet appareil. Aucun compte, aucun envoi distant.</p>
        </div>
        <button className="nav-item theme-toggle" onClick={() => setLightMode(!lightMode)}><span className="nav-icon">{lightMode ? "☾" : "☼"}</span> Mode {lightMode ? "sombre" : "clair"}</button>
        <div className="sidebar-foot">READFLOW · GRATUIT & LOCAL</div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Votre espace <span>/</span> {page === "library" ? "Bibliothèque" : "Coach de lecture"}</div>
          <div className="topbar-right"><span className="local-status"><i /> Données locales</span><button className="avatar" aria-label="Profil local sans compte">R</button></div>
        </header>

        {error && <div className="toast error-toast" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Fermer">×</button></div>}
        {notice && <div className="toast success-toast" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Fermer">×</button></div>}

        {page === "library" ? (
          <section className="page-content">
            <div className="welcome-row">
              <div><div className="eyebrow">{new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toLocaleUpperCase()}</div>
                <h1>Votre prochaine page <span>vous attend.</span></h1>
                <p className="page-subtitle">Un petit moment de lecture, un grand pas vers la fin.</p>
              </div>
              <button className="primary-button" onClick={() => fileInputRef.current?.click()} disabled={busy}><span>＋</span> {busy ? "Import en cours…" : "Ajouter un livre"}</button>
              <input ref={fileInputRef} type="file" accept=".pdf,.epub,application/pdf,application/epub+zip" multiple hidden onChange={(event) => void handleImport(event)} />
            </div>

            <div className="stats-grid">
              <article className="stat-card"><span className="stat-icon blue">▤</span><div className="stat-label">Dans votre bibliothèque</div><div className="stat-value">{books.length}<small> livres</small></div><div className="stat-foot">{books.filter((book) => book.status === "reading").length} en cours de lecture</div></article>
              <article className="stat-card"><span className="stat-icon violet">✧</span><div className="stat-label">Livres terminés</div><div className="stat-value">{finishedCount}<small> livres</small></div><div className="stat-foot">Chaque page compte, à votre rythme</div></article>
              <article className="stat-card"><span className="stat-icon cyan">◷</span><div className="stat-label">Temps de lecture cumulé</div><div className="stat-value">{formatDuration(totalSeconds)}</div><div className="stat-foot">Aujourd'hui : {formatDuration(todaySeconds)}</div></article>
              <article className="stat-card"><span className="stat-icon pink">↗</span><div className="stat-label">Série de lecture</div><div className="stat-value">{streak}<small> jour{streak > 1 ? "s" : ""}</small></div><div className="stat-foot">{weekMinutes} min réellement lues cette semaine</div></article>
            </div>

            <div className="reading-goal-panel glass-panel">
              <div className="goal-symbol">◌<span>{Math.min(100, Math.round(todaySeconds / 60 / dailyGoal * 100))}%</span></div>
              <div className="goal-copy"><div className="eyebrow">VOTRE OBJECTIF DU JOUR</div><h2>Chaque minute vous rapproche.</h2><p>{Math.floor(todaySeconds / 60)} min lues aujourd'hui sur votre objectif de {dailyGoal} min.</p><div className="goal-track"><span style={{ width: `${Math.min(100, todaySeconds / 60 / dailyGoal * 100)}%` }} /></div></div>
              <label className="goal-input">Objectif quotidien <span><input type="number" min="1" max="500" value={dailyGoal} onChange={(event) => saveDailyGoal(Number(event.target.value))} /> min</span></label>
              <button className="secondary-button" onClick={startCurrentBook}>Reprendre ma lecture <span>→</span></button>
            </div>

            {todayPlan.length > 0 && <section className="today-plan glass-panel" aria-labelledby="today-plan-title">
              <div className="today-plan-heading"><div><div className="section-kicker"><span>✦</span> SESSIONS D'AUJOURD'HUI</div><h2 id="today-plan-title">Votre lecture du jour</h2></div><span>{todayPlan.length} livre{todayPlan.length > 1 ? "s" : ""} planifié{todayPlan.length > 1 ? "s" : ""}</span></div>
              <div className="today-plan-list">{todayPlan.map(({ book, session }) => {
                const complete = book.currentPage > session.endPage || book.status === "finished";
                const started = book.currentPage > session.startPage || sessions.some((item) =>
                  item.bookId === book.id && dateKey(new Date(item.startedAt)) === todayKey && item.seconds > 0,
                );
                const progress = Math.min(100, Math.round(Math.max(0, book.currentPage - session.startPage) / Math.max(1, session.endPage - session.startPage + 1) * 100));
                return <article className="today-plan-item" key={book.id}>
                  <div className={`today-plan-check ${complete ? "complete" : ""}`}>{complete ? "✓" : "◷"}</div>
                  <div className="today-plan-copy"><strong>{book.title}</strong><span>{book.format === "pdf" ? "Pages" : "Chapitres"} {session.startPage}–{session.endPage} · {complete ? "Session terminée" : started ? "En cours" : "À commencer"}</span><div className="goal-track"><span style={{ width: `${complete ? 100 : progress}%` }} /></div></div>
                  <button className="secondary-button compact" onClick={() => void openBook(book)}>{complete ? "Relire" : "Lire maintenant"} →</button>
                </article>;
              })}</div>
            </section>}

            <div className="library-heading">
              <div><h2>Ma bibliothèque <span className="count-pill">{books.length}</span></h2><p>Vos livres, votre rythme, vos données.</p></div>
              <div className="library-tools"><label className="search-box"><span>⌕</span><input placeholder="Rechercher un livre…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="export-button" onClick={() => void exportData()} title="Exporter notes et statistiques (les fichiers restent séparés)">Exporter mes données</button></div>
            </div>
            <div className="filter-tabs" role="tablist" aria-label="Filtrer la bibliothèque">
              {([["all", "Tous"], ["reading", "En cours"], ["unread", "À lire"], ["finished", "Terminés"]] as [Filter, string][]).map(([value, label]) => <button key={value} role="tab" aria-selected={filter === value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{label}<span>{value === "all" ? books.length : books.filter((book) => book.status === value).length}</span></button>)}
            </div>

            {loading ? <div className="empty-state"><span className="loading-ring" /><p>Ouverture de votre bibliothèque locale…</p></div> : visibleBooks.length ? (
              <div className="book-grid">{visibleBooks.map((book, index) => <BookCard key={book.id} book={book} index={index} onOpen={() => void openBook(book)} onDelete={() => void removeBook(book)} onCoach={() => { void selectCoachBook(book.id); setPage("coach"); }} onCoverChange={(cover) => void updateBookCover(book, cover)} />)}</div>
            ) : (
              <div className="empty-state"><div className="empty-orbit"><span>▤</span></div><h3>{books.length ? "Aucun livre ne correspond." : "Votre bibliothèque commence ici."}</h3><p>{books.length ? "Essayez un autre filtre ou une autre recherche." : "Importez un PDF ou un EPUB pour lire, écouter et suivre votre progression en privé."}</p>{!books.length && <button className="primary-button" onClick={() => fileInputRef.current?.click()}>＋ Importer mon premier livre</button>}</div>
            )}
            <div className="privacy-note"><span>⬡</span> Vos livres ne quittent jamais votre appareil. ReadFlow ne nécessite ni compte, ni abonnement, ni clé API.</div>
          </section>
        ) : (
          <section className="page-content coach-page">
            <div className="coach-heading"><div><div className="eyebrow">VOTRE COMPAGNON DE LECTURE</div><h1>Lire avec <span>intention.</span></h1><p className="page-subtitle">Un plan réaliste, des notes à vous, des idées à retenir.</p></div><div className="coach-illustration">✧<span>◌</span><i>✳</i></div></div>
            {!books.length ? <div className="empty-state coach-empty"><div className="empty-orbit"><span>✧</span></div><h3>Ajoutez un livre pour commencer.</h3><p>Vos objectifs, notes et révisions seront conservés localement.</p><button className="primary-button" onClick={() => { setPage("library"); fileInputRef.current?.click(); }}>Ajouter un livre</button></div> : <>
              <div className="coach-selector glass-panel"><label htmlFor="coach-book-select">LIVRE À ACCOMPAGNER</label><select id="coach-book-select" value={selectedCoachBook} onChange={(event) => void selectCoachBook(event.target.value)}><option value="">Choisir un livre…</option>{books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select>
                {activeCoachBook && <div className="coach-book-progress"><span>{activeCoachBook.progress}% lu</span><div className="goal-track"><span style={{ width: `${activeCoachBook.progress}%` }} /></div><span>{Math.max(0, activeCoachBook.totalPages - activeCoachBook.currentPage + 1)} pages restantes</span></div>}
              </div>
              {activeCoachBook ? <>
                <div className="coach-columns">
                  <article className="glass-panel plan-card"><div className="section-kicker"><span>01</span> PLAN DE LECTURE</div><h2>À quel horizon voulez-vous le terminer ?</h2><p>Votre plan évolue selon les pages réellement lues.</p>
                    <div className="horizon-options">{[["7", "7 jours"], ["14", "14 jours"], ["30", "30 jours"], ["custom", "Date choisie"]].map(([value, label]) => <button key={value} className={goalChoice === value ? "active" : ""} onClick={() => setGoalChoice(value)}>{label}</button>)}</div>
                    {goalChoice === "custom" && <input className="date-input" type="date" min={dateKey()} value={customDate} onChange={(event) => setCustomDate(event.target.value)} aria-label="Date de fin souhaitée" />}
                    <button className="primary-button full-button" onClick={() => void setBookGoal(activeCoachBook)}>Mettre à jour mon plan <span>→</span></button>
                    <div className="plan-result"><strong>{activeCoachBook.totalPages ? pagesPerDay : "—"}</strong><span>{activeCoachBook.format === "pdf" ? "pages" : "chapitres"} par jour pour atteindre votre objectif actuel</span></div>
                    {activeCoachBook.goalDate && <p className="estimated-date">Date visée : {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(`${activeCoachBook.goalDate}T12:00:00`))}</p>}
                    {!!activeCoachBook.readingPlan?.length && <div className="planned-sessions" aria-label="Sessions quotidiennes générées">
                      <h3>Sessions quotidiennes · {activeCoachBook.readingPlan.length} jours</h3>
                      {activeCoachBook.readingPlan.map((session) => {
                        const complete = activeCoachBook.currentPage > session.endPage || activeCoachBook.status === "finished";
                        const missed = session.date < todayKey && !complete;
                        return <div className={`planned-session ${complete ? "complete" : missed ? "missed" : ""}`} key={session.date}>
                          <span className="planned-session-date">{new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${session.date}T12:00:00`))}</span>
                          <span>{activeCoachBook.format === "pdf" ? "Pages" : "Chapitres"} {session.startPage}–{session.endPage}</span>
                          <strong>{complete ? "Terminé" : missed ? "Manqué · plan réajusté" : session.date === todayKey ? "Aujourd'hui" : "À lire"}</strong>
                        </div>;
                      })}
                    </div>}
                    {!activeCoachBook.totalPages && <p className="muted small">Analyse du nombre de pages ou de chapitres en attente.</p>}
                  </article>
                  <article className="glass-panel session-card"><div className="section-kicker"><span>02</span> VOTRE RYTHME</div><h2>Des progrès bien réels.</h2><div className="session-metric"><span>Cette semaine</span><strong>{weekMinutes}<small> min</small></strong></div><div className="week-bars">{Array.from({ length: 7 }, (_, i) => {
                    const day = new Date(); day.setDate(day.getDate() - (6 - i));
                    const seconds = sessions.filter((session) => dateKey(new Date(session.startedAt)) === dateKey(day)).reduce((sum, session) => sum + session.seconds, 0);
                    const height = Math.max(6, Math.min(100, seconds / 60 / Math.max(dailyGoal, 1) * 100));
                    return <div className="week-day" key={i}><div className="bar-track"><i style={{ height: `${height}%` }} /></div><span>{new Intl.DateTimeFormat("fr-FR", { weekday: "narrow" }).format(day)}</span></div>;
                  })}</div><p className="muted small">Seules vos sessions mesurées sont affichées.</p><button className="secondary-button full-button" onClick={() => activeCoachBook && void openBook(activeCoachBook)}>Continuer ce livre <span>→</span></button></article>
                </div>
                <div className="coach-columns lower-coach">
                  <article className="glass-panel notes-card"><div className="section-kicker"><span>03</span> NOTES PERSONNELLES</div><h2>Ce que vous voulez retenir.</h2><textarea value={activeNote?.text ?? ""} onChange={(event) => void saveCoachNote({ ...(activeNote ?? { bookId: activeCoachBook.id, summary: "" }), text: event.target.value })} placeholder="Une idée, une citation ou une réflexion… vos notes restent privées." rows={6} /><span className="autosave-label">Enregistrement local automatique</span></article>
                  <article className="glass-panel review-card"><div className="section-kicker"><span>04</span> RÉVISION ACTIVE</div><h2>Faites travailler votre mémoire.</h2><p className="review-question">Sans rouvrir le livre, quelle est l'idée la plus importante que vous retenez de votre dernière session ?</p><div className="revision-response">{activeNote?.text ? "Vos notes peuvent servir d'indice lors de votre révision." : "Ajoutez vos propres notes pour créer votre support de révision."}</div><div className="section-divider" /><h3>Résumé local du passage lu</h3>{passage.trim() ? <><p className="muted small">Extrait de la page ou du passage actuellement affiché — calcul effectué sur cet appareil, sans IA distante.</p><button className="secondary-button full-button" onClick={() => {
                      const summary = createSummary(passage);
                      if (!summary) { setError("Pas assez de texte lisible pour établir un résumé de ce passage."); return; }
                      void saveCoachNote({ ...(activeNote ?? { bookId: activeCoachBook.id, text: "" }), summary });
                    }}>Créer un résumé de cet extrait</button></> : <p className="muted small">Ouvrez ce livre puis lisez un passage pour rendre le résumé local disponible.</p>}{activeNote?.summary && <div className="summary-box"><span>RÉSUMÉ EXTRACTIF · LOCAL</span><p>{activeNote.summary}</p></div>}</article>
                </div>
              </> : <div className="coach-placeholder"><span>✧</span><p>Choisissez un livre pour créer votre plan de lecture et retrouver vos notes.</p></div>}
              <div className="privacy-note"><span>⬡</span> Vos notes et statistiques restent sur cet appareil. Le résumé est une sélection locale de phrases, pas une génération par IA.</div>
            </>}
          </section>
        )}
      </main>
    </div>
  );
}

function BookCard({ book, index, onOpen, onDelete, onCoach, onCoverChange }: { book: StoredBook; index: number; onOpen: () => void; onDelete: () => void; onCoach: () => void; onCoverChange: (cover?: Blob) => void }) {
  const palettes = ["cover-blue", "cover-purple", "cover-cyan", "cover-rose"];
  const statusText = book.status === "finished" ? "Terminé" : book.status === "reading" ? "En cours" : "À lire";
  const [coverUrl, setCoverUrl] = useState("");

  useEffect(() => {
    if (!book.coverImage) {
      setCoverUrl("");
      return;
    }
    const url = URL.createObjectURL(book.coverImage);
    setCoverUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [book.coverImage]);

  const handleCoverSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      window.alert("Choisissez une image JPG, PNG, WebP ou GIF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      window.alert("L'image doit faire 10 Mo maximum.");
      return;
    }
    onCoverChange(file);
  };

  return (
    <article className="book-card" style={{ animationDelay: `${index * 45}ms` }}>
      <div className="book-cover-wrap">
        <button className="book-cover-open" onClick={onOpen} aria-label={`Ouvrir ${book.title}`}>
          {coverUrl
            ? <img className="book-cover-image" src={coverUrl} alt={`Couverture de ${book.title}`} />
            : <div className={`book-cover ${palettes[index % palettes.length]}`}><span className="cover-shine" /><span className="cover-symbol">{book.format === "pdf" ? "PDF" : "EPUB"}</span><strong>{book.title}</strong><span className="cover-lines" /><i className="cover-spine" /></div>}
          <span className="cover-shadow" />
        </button>
        <label className="cover-upload-control" title={coverUrl ? "Changer la couverture" : "Ajouter une couverture"}>
          <span aria-hidden="true">▧</span><span>{coverUrl ? "Changer" : "Ajouter une image"}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label={`Ajouter ou changer la couverture de ${book.title}`} onChange={handleCoverSelection} />
        </label>
        {coverUrl && <button className="cover-remove-control" onClick={() => onCoverChange()} aria-label={`Retirer la couverture personnalisée de ${book.title}`} title="Retirer la couverture">×</button>}
      </div>
      <div className="book-card-content">
        <div className="book-title-row"><button className="book-title" onClick={onOpen} title={book.title}>{book.title}</button><button className="more-button" aria-label={`Options pour ${book.title}`} onClick={onDelete}>···</button></div>
        <div className="book-meta"><span className={`status-dot status-${book.status}`} />{statusText}<span className="meta-divider">·</span>{book.format.toUpperCase()}</div>
        <div className="book-progress"><div className="progress-track"><i style={{ width: `${book.progress}%` }} /></div><span>{book.progress}%</span></div>
        <div className="book-bottom"><span>{book.totalPages ? `Page ${Math.min(book.currentPage, book.totalPages)} / ${book.totalPages}` : "Position à détecter"}</span><button onClick={onCoach} aria-label={`Créer un plan pour ${book.title}`} title="Planifier">↗</button></div>
      </div>
    </article>
  );
}

export default App;
