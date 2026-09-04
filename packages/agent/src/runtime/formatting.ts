/** Turns a model's reply into 1-3 plain-text iMessage-shaped texts (no markdown, no walls of text). */

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitLong(paragraph: string, maxLen: number): string[] {
  if (paragraph.length <= maxLen) return [paragraph];
  const out: string[] = [];
  let rest = paragraph;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf('. ', maxLen);
    if (cut < maxLen * 0.5) cut = rest.lastIndexOf(' ', maxLen);
    if (cut < maxLen * 0.5) cut = maxLen - 1;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/** Strips markdown and splits into at most `maxParts` texts of at most `maxLen` chars each. */
export function formatForIMessage(text: string, maxParts = 3, maxLen = 1000): string[] {
  const clean = stripMarkdown(text);
  if (!clean) return [];
  const paragraphs = clean
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';
  for (const p of paragraphs) {
    const candidate = current ? `${current}\n\n${p}` : p;
    if (candidate.length <= maxLen) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    const pieces = splitLong(p, maxLen);
    chunks.push(...pieces.slice(0, -1));
    current = pieces[pieces.length - 1] ?? '';
  }
  if (current) chunks.push(current);

  if (chunks.length <= maxParts) return chunks;
  const head = chunks.slice(0, maxParts - 1);
  const tail = chunks.slice(maxParts - 1).join(' ');
  const tailPieces = splitLong(tail, maxLen);
  return [...head, tailPieces[0] ?? ''];
}
