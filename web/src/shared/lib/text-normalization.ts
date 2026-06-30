/**
 * Normalize text by converting LaTeX math notation to Unicode characters
 */
export function normalizeText(text: string): string {
  if (!text) return text;
  
  return text
    // Convert LaTeX arrow notation to Unicode arrow
    .replace(/\$\\rightarrow\$/g, '→')
    // JSON can decode `\r` in `\rightarrow` as a carriage return, leaving `$ ightarrow$`.
    .replace(/\$\s*ightarrow\$/g, '→')
    .replace(/\$\\leftarrow\$/g, '←')
    .replace(/\$\\leftrightarrow\$/g, '↔')
    .replace(/\$\\Rightarrow\$/g, '⇒')
    .replace(/\$\\Leftarrow\$/g, '⇐')
    .replace(/\$\\Leftrightarrow\$/g, '⇔');
}
