const BULLISH: { word: string; score: number }[] = [
  { word: "moon", score: 0.2 },
  { word: "100x", score: 0.3 },
  { word: "ape", score: 0.15 },
  { word: "bullish", score: 0.25 },
  { word: "buying", score: 0.15 },
  { word: "loaded", score: 0.2 },
  { word: "gem", score: 0.2 },
  { word: "based", score: 0.1 },
  { word: "lfg", score: 0.2 },
];

const BEARISH: { word: string; score: number }[] = [
  { word: "rug", score: -0.3 },
  { word: "scam", score: -0.3 },
  { word: "dump", score: -0.2 },
  { word: "sell", score: -0.15 },
  { word: "ngmi", score: -0.2 },
  { word: "dead", score: -0.25 },
  { word: "rip", score: -0.2 },
  { word: "bearish", score: -0.25 },
  { word: "overextended", score: -0.15 },
];

export function scoreSentiment(content: string): number {
  const text = content.toLowerCase();
  let score = 0;

  for (const { word, score: s } of BULLISH) {
    const regex = new RegExp(`\\b${word}\\b`, "g");
    const matches = text.match(regex);
    if (matches) score += s * matches.length;
  }
  for (const { word, score: s } of BEARISH) {
    const regex = new RegExp(`\\b${word}\\b`, "g");
    const matches = text.match(regex);
    if (matches) score += s * matches.length;
  }

  // ALL CAPS amplifier — only when enough alpha chars and >=50% caps
  const alphaChars = content.replace(/[^a-zA-Z]/g, "");
  if (alphaChars.length >= 6) {
    const upper = alphaChars.replace(/[^A-Z]/g, "").length;
    if (upper / alphaChars.length >= 0.5) score *= 1.3;
  }

  // Exclamation amplifier
  const bangs = (content.match(/!/g) ?? []).length;
  if (bangs > 0) {
    const amp = Math.min(1.5, 1 + 0.1 * bangs);
    score *= amp;
  }

  // Clamp
  if (score > 1) score = 1;
  if (score < -1) score = -1;
  return score;
}
