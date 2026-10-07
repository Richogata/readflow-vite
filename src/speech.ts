export type SpeechKind = "body" | "heading" | "quote";

export interface SpeechSegment {
  text: string;
  kind: SpeechKind;
}

export function resolveSpeechVoice(voices: SpeechSynthesisVoice[], text: string, voiceIndex: number, fallbackLanguage: string): SpeechSynthesisVoice | undefined {
  if (voiceIndex > 0) return voices[voiceIndex - 1];
  const french = (text.match(/\b(?:le|la|les|des|une|est|dans|pour|avec|qui|que|pas|sur)\b/gi) ?? []).length;
  const english = (text.match(/\b(?:the|and|that|this|with|from|have|was|were|for|not|you)\b/gi) ?? []).length;
  const language = french > english ? "fr" : english > french ? "en" : fallbackLanguage.split("-")[0].toLowerCase();
  const matching = voices.filter((voice) => voice.lang.toLowerCase().startsWith(language));
  return matching.find((voice) => voice.default) ?? matching[0] ?? voices.find((voice) => voice.default);
}

const quotePattern = /^(?:[«“"]|[-—]\s+).*(?:[»”"])?$/;
const headingPattern = /^(?:chapitre|chapter|partie|part|préface|preface|introduction|conclusion|épilogue|epilogue)\b/i;

export function classifySpeechLines(lines: string[]): SpeechSegment[] {
  return lines
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((text) => {
      const isHeading = text.length < 100 && (
        headingPattern.test(text) ||
        (text.length < 70 && text === text.toLocaleUpperCase() && /[\p{L}]/u.test(text)) ||
        (text.length < 48 && text.split(/\s+/).length <= 8 && !/[.!?,;:]$/.test(text) && !quotePattern.test(text))
      );
      return {
        text,
        kind: isHeading ? "heading" : quotePattern.test(text) ? "quote" : "body",
      };
    });
}

export function extractEpubSpeech(contents: Document): SpeechSegment[] {
  const elements = Array.from(contents.body.querySelectorAll("h1, h2, h3, h4, h5, h6, blockquote, p"));
  const blocks = elements
    .filter((element) => !element.parentElement?.closest("blockquote, p"))
    .map((element) => ({
      text: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
      kind: element.tagName.toLowerCase() === "blockquote"
        ? "quote" as const
        : /^h[1-6]$/i.test(element.tagName) ? "heading" as const : "body" as const,
    }))
    .filter((block) => block.text);
  return blocks.length ? blocks : classifySpeechLines([contents.body.innerText]);
}

export function createSpeechSegments(blocks: SpeechSegment[]): SpeechSegment[] {
  const result: SpeechSegment[] = [];
  for (const block of blocks) {
    const sentences = block.text.match(/[^.!?…]+(?:[.!?…]+[»”"]*|$)/g)?.map((part) => part.trim()).filter(Boolean) ?? [];
    let current = "";
    for (const sentence of sentences) {
      if (current && `${current} ${sentence}`.length > 220) {
        result.push({ text: current, kind: block.kind });
        current = sentence;
      } else {
        current = current ? `${current} ${sentence}` : sentence;
      }
    }
    if (current) result.push({ text: current, kind: block.kind });
  }
  return result;
}

export function extractPdfSpeechLines(items: Array<{ str: string; transform: number[] }>): string[] {
  const rows = new Map<number, string[]>();
  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = Math.round(item.transform[5] / 3) * 3;
    rows.set(y, [...(rows.get(y) ?? []), item.str.trim()]);
  }
  return [...rows.entries()]
    .sort(([first], [second]) => second - first)
    .map(([, parts]) => parts.join(" ").replace(/\s+/g, " ").trim());
}
