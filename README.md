# ReadFlow

ReadFlow is a free, local-first reading app. It runs in the browser without an account, subscription, paid API, cloud database, or API key. Imported PDF/EPUB files, progress, notes, and reading sessions are stored in the browser's IndexedDB.

## Run locally

Requirements: Node.js 20 or later and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. For a production build, run `npm run build`; the static files are written to `dist/`. Preview that build with `npm run preview`.

The first `npm ci` downloads open-source packages from npm. The app itself does not call a remote API. Web Speech voices come from the browser/operating system and their availability varies by device. Scanned PDFs need OCR before their page text can be read aloud; ReadFlow does not send them to an OCR service.

## Free GitHub Pages deployment

1. Create a **public** GitHub repository and push this project to its `main` branch. No paid GitHub add-on or API key is used.
2. In the repository, open **Settings → Pages** and select **GitHub Actions** as the build and deployment source.
3. Push to `main` (or run the **Deploy ReadFlow to GitHub Pages** workflow from the Actions tab). The workflow installs the locked dependencies, builds `dist/`, and publishes the static site.
4. Open the Pages URL shown in the workflow's deployment summary.

The included Vite configuration uses relative asset paths so the site works under a repository subpath. GitHub Pages hosts the static app; it does not host or receive the reader's imported books.

## Free Vercel deployment

The repository includes `vercel.json` to build the Vite app with `npm run build`, publish `dist/`, and serve the client-side app correctly. Import the GitHub repository in the Vercel dashboard and keep the detected Vite settings. No environment variables or backend services are required.

## Local data and backup

Data stays in the browser profile and site origin where it was created. Clearing browser storage or changing browser/device/origin can remove or strand that data. **Exporter mes données** downloads JSON containing book metadata, notes, summaries, and reading sessions; for privacy, book files themselves are not included and must be kept separately. A JSON import/restore is not currently provided.

## Implemented features

- PDF viewing with PDF.js, page navigation, zoom, text extraction, and scan/OCR notice.
- EPUB viewing with epub.js, chapter navigation, extracted displayed text, and saved CFI reading position.
- Import-time analysis of PDF page count and EPUB spine chapters; a saved, day-by-day reading plan is generated for the selected completion date and adjusted as reading progress changes.
- IndexedDB book/progress/notes/session persistence; local search, status filters, deletion, per-book cover image upload (JPG/PNG/WebP/GIF, up to 10 MB), and JSON export. Cover images remain stored locally alongside their book and are not included in JSON exports.
- Browser-native speech synthesis for available page/chapter text, segmented around sentences and detected EPUB headings/quotes, with language-matched available voices, optional separate quote voice, gentle heading pacing, pause/resume/stop, speed selection, sleep timer, and next-page controls.
- Daily reading goal, completion target, recalculated pages/day, weekly session chart, streak, personal notes, and a local extractive passage summary.
- Responsive layouts, keyboard-operable controls, optional light theme, and reduced-motion support.

The dashboard and coach show today's assigned pages/chapters and generated daily sessions; session completion follows the saved reading position. Reading time measures time spent in the reader and is not a measure of comprehension. Voice features depend on browser and operating system support. Native speech cannot reliably infer a character's age or identity; headings and quotes are only classified when their document structure or punctuation makes them detectable, and available voices determine the sound quality.
