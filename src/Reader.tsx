import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Book as EpubBook, Rendition } from "epubjs";
import type { Book, StoredBook } from "./types";
import { getPdfWorker } from "./pdfWorker";
import { classifySpeechLines, createSpeechSegments, extractEpubSpeech, extractPdfSpeechLines, resolveSpeechVoice, type SpeechSegment } from "./speech";

interface ReaderProps {
  book: StoredBook;
  onClose: () => void;
  onProgress: (patch: Pick<Book, "currentPage" | "totalPages" | "progress" | "status" | "bookmarkPage" | "epubCfi">) => void;
  onSession: (seconds: number) => void;
  onPassage: (text: string) => void;
}

const speeds = [0.75, 1, 1.25, 1.5, 2];

interface TocOption {
  href: string;
  label: string;
  subitems?: TocOption[];
}

function flattenToc(items: TocOption[], prefix = ""): TocOption[] {
  return items.flatMap((item) => {
    const label = prefix ? `${prefix} / ${item.label}` : item.label;
    return [{ href: item.href, label }, ...flattenToc(item.subitems ?? [], label)];
  });
}

export default function Reader({ book, onClose, onProgress, onSession, onPassage }: ReaderProps) {
  const [page, setPage] = useState(Math.max(1, book.currentPage || 1));
  const [totalPages, setTotalPages] = useState(book.totalPages);
  const [zoom, setZoom] = useState(1);
  const [focus, setFocus] = useState(false);
  const [error, setError] = useState("");
  const [pageText, setPageText] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceIndex, setVoiceIndex] = useState(0);
  const [quoteVoiceIndex, setQuoteVoiceIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [epubFontSize, setEpubFontSize] = useState(18);
  const [epubTheme, setEpubTheme] = useState<"paper" | "sepia" | "night">("paper");
  const [toc, setToc] = useState<TocOption[]>([]);
  const [audioState, setAudioState] = useState<"idle" | "playing" | "paused">("idle");
  const [activeSegment, setActiveSegment] = useState("");
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const epubRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const speechBlocksRef = useRef<SpeechSegment[]>([]);
  const audioChunksRef = useRef<SpeechSegment[]>([]);
  const audioIndexRef = useRef(0);
  const sessionStartedRef = useRef(Date.now());
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioTimerRef = useRef<number | undefined>(undefined);
  const pendingAudioDelayRef = useRef(0);
  const sleepRef = useRef<number | undefined>(undefined);
  const speakNextRef = useRef<() => void>(() => undefined);
  const epubLocation = book.epubCfi ?? "";
  const [layoutTick, setLayoutTick] = useState(0);

  const updatePosition = useCallback((next: number, count = totalPages) => {
    const safeCount = Math.max(count, 1);
    setPage(next);
    setTotalPages(safeCount);
    onProgress({
      currentPage: next,
      totalPages: safeCount,
      progress: Math.min(100, Math.round((next / safeCount) * 100)),
      status: next >= safeCount ? "finished" : next > 1 ? "reading" : "unread",
    });
  }, [onProgress, totalPages]);

  useEffect(() => onPassage(pageText), [onPassage, pageText]);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setPageText("");
    if (book.format === "pdf") {
      import("pdfjs-dist").then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerPort = getPdfWorker();
        return book.file.arrayBuffer().then((buffer) => pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise);
      })
        .then((pdf) => {
          if (cancelled) { void pdf.destroy(); return; }
          pdfRef.current = pdf;
          setPdfDocument(pdf);
          setTotalPages(pdf.numPages);
          updatePosition(Math.min(page, pdf.numPages), pdf.numPages);
        })
        .catch((reason: unknown) => setError(`Impossible d'ouvrir ce PDF : ${reason instanceof Error ? reason.message : "fichier invalide"}`));
    } else {
      import("epubjs").then(({ default: ePub }) => book.file.arrayBuffer().then((buffer) => {
        if (cancelled) return;
        const epub = ePub(buffer);
        epubRef.current = epub;
        const rendition = epub.renderTo("epub-view", { width: "100%", height: "100%", flow: "paginated", spread: "none" });
        renditionRef.current = rendition;
        epub.ready.then(async () => {
          if (cancelled) return;
          const chapters = Math.max(1, (await epub.loaded.spine).length);
          setTotalPages(chapters);
          setToc(flattenToc(epub.navigation.toc));
          rendition.themes.default({
            body: {
              color: epubTheme === "night" ? "#e9e8e3 !important" : "#28251f !important",
              background: epubTheme === "night" ? "#171b25 !important" : epubTheme === "sepia" ? "#f1e6d0 !important" : "#faf8f2 !important",
              "font-family": "Georgia, serif !important",
              "line-height": "1.7 !important",
            },
          });
          rendition.themes.fontSize(`${epubFontSize}px`);
          rendition.on("rendered", (_section: unknown, contents: { document?: Document }) => {
            const text = contents.document?.body?.innerText ?? "";
            setPageText(text);
            speechBlocksRef.current = contents.document ? extractEpubSpeech(contents.document) : classifySpeechLines([text]);
            if (!text.trim()) setError("Aucun texte lisible n'a été trouvé dans ce passage EPUB.");
            else setError("");
          });
          rendition.on("relocated", (location: { start?: { index?: number; cfi?: string } }) => {
            const index = Math.max(0, location.start?.index ?? 0);
            setPage(index + 1);
            onProgress({
              currentPage: index + 1,
              totalPages: chapters,
              progress: Math.min(100, Math.round(((index + 1) / Math.max(chapters, 1)) * 100)),
              status: index + 1 >= chapters ? "finished" : index > 0 ? "reading" : "unread",
              epubCfi: location.start?.cfi,
            });
          });
          await rendition.display(book.epubCfi || undefined);
        }).catch((reason: unknown) => setError(`Impossible d'ouvrir cet EPUB : ${reason instanceof Error ? reason.message : "fichier invalide"}`));
      })).catch((reason: unknown) => setError(`Impossible de lire ce fichier EPUB : ${reason instanceof Error ? reason.message : "fichier invalide"}`));
    }
    return () => {
      cancelled = true;
      window.speechSynthesis?.cancel();
      if (audioTimerRef.current) window.clearTimeout(audioTimerRef.current);
      if (pdfRef.current) void pdfRef.current.destroy();
      if (epubRef.current) void epubRef.current.destroy();
      pdfRef.current = null;
      epubRef.current = null;
      renditionRef.current = null;
      if (sleepRef.current) window.clearTimeout(sleepRef.current);
    };
  // Reader is remounted on book id; initial page is intentional.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setLayoutTick((current) => current + 1));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition || book.format !== "epub") return;
    rendition.themes.default({
      body: {
        color: epubTheme === "night" ? "#e9e8e3 !important" : "#28251f !important",
        background: epubTheme === "night" ? "#171b25 !important" : epubTheme === "sepia" ? "#f1e6d0 !important" : "#faf8f2 !important",
        "font-family": "Georgia, serif !important",
        "line-height": "1.7 !important",
      },
    });
    rendition.themes.fontSize(`${epubFontSize}px`);
  }, [book.format, epubFontSize, epubTheme]);

  useEffect(() => {
    const loadPage = async () => {
      const pdf = pdfDocument;
      const canvas = canvasRef.current;
      if (!pdf || !canvas) return;
      try {
        const pdfPage = await pdf.getPage(page);
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const availableWidth = Math.max(240, (stageRef.current?.clientWidth ?? 900) - 48);
        const availableHeight = Math.max(240, (stageRef.current?.clientHeight ?? window.innerHeight) - 40);
        const fitScale = Math.min(availableWidth / baseViewport.width, availableHeight / baseViewport.height, 1.8);
        const viewport = pdfPage.getViewport({ scale: fitScale * zoom });
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas indisponible.");
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        await pdfPage.render({
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        }).promise;
        const content = await pdfPage.getTextContent();
        const lines = extractPdfSpeechLines(content.items.flatMap((item) =>
          "str" in item && "transform" in item
            ? [{ str: item.str, transform: Array.from(item.transform) }]
            : [],
        ));
        const text = lines.join("\n");
        setPageText(text);
        speechBlocksRef.current = classifySpeechLines(lines.length ? lines : [text]);
        if (!text.trim()) setError("Aucun texte détecté sur cette page. Ce PDF semble être un scan : un OCR externe serait nécessaire pour l'audio.");
        else setError("");
      } catch (reason) {
        if (pdfRef.current) setError(`Erreur d'affichage de la page : ${reason instanceof Error ? reason.message : "inconnue"}`);
      }
    };
    void loadPage();
  }, [layoutTick, page, pdfDocument, zoom]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const refresh = () => setVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartedRef.current) / 1000);
      if (elapsed >= 30) {
        onSession(elapsed);
        sessionStartedRef.current = Date.now();
      }
    }, 30_000);
    return () => {
      window.clearInterval(interval);
      const elapsed = Math.floor((Date.now() - sessionStartedRef.current) / 1000);
      if (elapsed > 0) onSession(elapsed);
    };
  }, [onSession]);

  const stopAudio = () => {
    window.speechSynthesis?.cancel();
    if (audioTimerRef.current) window.clearTimeout(audioTimerRef.current);
    pendingAudioDelayRef.current = 0;
    setAudioState("idle");
    setActiveSegment("");
  };

  const speakNext = useCallback(() => {
    const segment = audioChunksRef.current[audioIndexRef.current];
    if (!segment) {
      setAudioState("idle");
      setActiveSegment("");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(segment.text);
    const selectedIndex = segment.kind === "quote" && quoteVoiceIndex ? quoteVoiceIndex : voiceIndex;
    const selectedVoice = resolveSpeechVoice(voices, segment.text, selectedIndex, navigator.language);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = speed * (segment.kind === "heading" ? 0.9 : segment.kind === "quote" ? 0.96 : 1);
    utterance.onstart = () => { setAudioState("playing"); setActiveSegment(segment.text); };
    utterance.onend = () => {
      audioIndexRef.current += 1;
      if (audioIndexRef.current < audioChunksRef.current.length) {
        const delay = segment.kind === "heading" ? 420 : segment.kind === "quote" ? 280 : 140;
        pendingAudioDelayRef.current = delay;
        audioTimerRef.current = window.setTimeout(() => {
          audioTimerRef.current = undefined;
          pendingAudioDelayRef.current = 0;
          speakNextRef.current();
        }, delay);
      }
      else { setAudioState("idle"); setActiveSegment(""); }
    };
    utterance.onerror = (event) => {
      if (event.error !== "canceled" && event.error !== "interrupted") setError(`Lecture vocale interrompue : ${event.error}`);
      setAudioState("idle");
    };
    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [quoteVoiceIndex, speed, voiceIndex, voices]);

  useEffect(() => {
    speakNextRef.current = speakNext;
  }, [speakNext]);

  const playAudio = () => {
    if (!("speechSynthesis" in window)) {
      setError("La synthèse vocale n'est pas disponible dans ce navigateur.");
      return;
    }
    if (audioState === "paused") {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      else if (pendingAudioDelayRef.current) {
        const delay = pendingAudioDelayRef.current;
        audioTimerRef.current = window.setTimeout(() => {
          audioTimerRef.current = undefined;
          pendingAudioDelayRef.current = 0;
          speakNextRef.current();
        }, delay);
      }
      setAudioState("playing");
      return;
    }
    if (audioState === "playing") {
      window.speechSynthesis.pause();
      if (audioTimerRef.current) {
        window.clearTimeout(audioTimerRef.current);
        audioTimerRef.current = undefined;
      }
      setAudioState("paused");
      return;
    }
    const chunks = createSpeechSegments(speechBlocksRef.current.length ? speechBlocksRef.current : classifySpeechLines([pageText]));
    if (!chunks.length) {
      setError("Aucun texte lisible sur cette page. Vérifiez que le livre contient du texte sélectionnable.");
      return;
    }
    audioChunksRef.current = chunks;
    audioIndexRef.current = 0;
    setError("");
    speakNext();
  };

  const changePage = async (direction: -1 | 1) => {
    if (book.format === "epub" && renditionRef.current) {
      await renditionRef.current[direction > 0 ? "next" : "prev"]();
      return;
    }
    const next = Math.max(1, Math.min(totalPages, page + direction));
    stopAudio();
    updatePosition(next);
  };

  const openChapter = async (href: string) => {
    stopAudio();
    try {
      await renditionRef.current?.display(href);
    } catch (reason) {
      setError(`Impossible d'ouvrir ce chapitre : ${reason instanceof Error ? reason.message : "erreur inconnue"}`);
    }
  };

  const toggleBookmark = () => onProgress({
    currentPage: page,
    totalPages,
    progress: book.progress,
    status: book.status,
    bookmarkPage: book.bookmarkPage === page ? undefined : page,
  });

  const startSleepTimer = (minutes: number) => {
    if (sleepRef.current) window.clearTimeout(sleepRef.current);
    setSleepMinutes(minutes);
    if (minutes > 0) sleepRef.current = window.setTimeout(stopAudio, minutes * 60_000);
  };

  return (
    <div className={`reader-shell ${focus ? "reader-focus" : ""}`}>
      <header className="reader-topbar">
        <button className="icon-button" onClick={onClose} aria-label="Retour à la bibliothèque">←</button>
        <div className="reader-title"><span className="eyebrow">LECTURE IMMERSIVE</span><strong>{book.title}</strong></div>
        <div className="reader-actions">
          <button className="icon-button" onClick={() => setFocus(!focus)} title="Mode concentration">◉</button>
          <button className="icon-button" onClick={() => document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen()} title="Plein écran">⛶</button>
        </div>
      </header>
      <div className="reader-progress"><span style={{ width: `${totalPages ? Math.min(100, (page / totalPages) * 100) : 0}%` }} /></div>
      <main ref={stageRef} className={`reader-stage ${book.format === "epub" ? "epub-stage" : ""}`}>
        {error && <div className="reader-notice" role="status">{error}</div>}
        {book.format === "pdf" ? (
          <div className="pdf-page-wrap"><canvas ref={canvasRef} aria-label={`Page ${page} du livre`} /></div>
        ) : <div id="epub-view" className="epub-view" aria-label="Contenu du livre EPUB" />}
      </main>
      <footer className="reader-controls">
        <div className="page-controls">
          {book.format === "epub" && <>
            <label className="select-label chapter-select">Chapitre<select value="" onChange={(event) => { if (event.target.value) void openChapter(event.target.value); }}><option value="">Sommaire…</option>{toc.map((item) => <option key={item.href} value={item.href}>{item.label}</option>)}</select></label>
            <div className="zoom-controls epub-font-controls"><button className="icon-button small" onClick={() => setEpubFontSize(Math.max(12, epubFontSize - 1))} aria-label="Réduire le texte">A−</button><span>Texte</span><button className="icon-button small" onClick={() => setEpubFontSize(Math.min(30, epubFontSize + 1))} aria-label="Agrandir le texte">A+</button></div>
            <label className="select-label">Thème<select value={epubTheme} onChange={(event) => setEpubTheme(event.target.value as typeof epubTheme)}><option value="paper">Papier</option><option value="sepia">Sépia</option><option value="night">Nuit</option></select></label>
          </>}
          <button className="secondary-button compact" onClick={() => void changePage(-1)} disabled={page <= 1}>← Précédent</button>
          <span className="page-indicator">{book.format === "epub" ? `Chapitre ${page}` : `Page ${page} / ${totalPages || "…"}`}</span>
          <button className="secondary-button compact" onClick={() => void changePage(1)} disabled={page >= totalPages}>Suivant →</button>
          {book.format === "pdf" && <div className="zoom-controls"><button className="icon-button small" onClick={() => setZoom(Math.max(0.7, zoom - 0.15))}>−</button><span>{Math.round(zoom * 100)}%</span><button className="icon-button small" onClick={() => setZoom(Math.min(2, zoom + 0.15))}>+</button></div>}
          {book.format === "epub" && epubLocation && <span className="muted tiny">Position mémorisée</span>}
          <button className={`secondary-button compact ${book.bookmarkPage === page ? "bookmark-active" : ""}`} onClick={toggleBookmark}>{book.bookmarkPage === page ? "★ Marque-page" : "☆ Marquer"}</button>
        </div>
        <div className="audio-bar">
          <div className="audio-label"><span className="audio-wave">♫</span><div><strong>Écoute audio</strong><small>Titres ralentis · citations personnalisables</small></div></div>
          <button className="play-button" onClick={playAudio} aria-label={audioState === "playing" ? "Mettre en pause" : audioState === "paused" ? "Reprendre la lecture" : "Écouter"}>
            {audioState === "playing" ? "Ⅱ" : audioState === "paused" ? "▶" : "▶"}
          </button>
          <button className="icon-button" onClick={stopAudio} aria-label="Arrêter la lecture audio">■</button>
          <button className="secondary-button compact next-audio" onClick={() => { stopAudio(); void changePage(1); }} disabled={page >= totalPages}>Passage suivant →</button>
          <label className="select-label">Vitesse<select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>{speeds.map((value) => <option key={value} value={value}>{value}×</option>)}</select></label>
          <label className="select-label voice-select">Voix<select value={voiceIndex} onChange={(event) => setVoiceIndex(Number(event.target.value))}><option value={0}>Automatique</option>{voices.map((voice, index) => <option key={`${voice.name}-${voice.lang}`} value={index + 1}>{voice.name} · {voice.lang}</option>)}</select></label>
          <label className="select-label quote-voice-select">Voix des citations<select value={quoteVoiceIndex} onChange={(event) => setQuoteVoiceIndex(Number(event.target.value))}><option value={0}>Même voix</option>{voices.map((voice, index) => <option key={`${voice.name}-${voice.lang}-quote`} value={index + 1}>{voice.name} · {voice.lang}</option>)}</select></label>
          <label className="select-label">Minuteur<select value={sleepMinutes} onChange={(event) => startSleepTimer(Number(event.target.value))}><option value={0}>Désactivé</option><option value={5}>5 min</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>1 h</option></select></label>
        </div>
        {activeSegment && <div className="spoken-text" aria-live="polite">« {activeSegment} »</div>}
        <div className="audio-disclaimer">Voix locales uniquement : ReadFlow ne peut pas deviner l'âge d'un personnage. Le rythme et la voix des citations sont ajustables.</div>
      </footer>
    </div>
  );
}
