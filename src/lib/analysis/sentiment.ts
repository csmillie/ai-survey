// ---------------------------------------------------------------------------
// Simple word-list sentiment analysis
// ---------------------------------------------------------------------------

const POSITIVE_WORDS = new Set([
  "good",
  "great",
  "excellent",
  "wonderful",
  "fantastic",
  "amazing",
  "positive",
  "helpful",
  "beneficial",
  "effective",
  "best",
  "better",
  "love",
  "loved",
  "enjoy",
  "enjoyed",
  "impressive",
  "outstanding",
  "remarkable",
  "superior",
  "perfect",
  "brilliant",
  "exceptional",
  "magnificent",
  "superb",
  "delightful",
  "favorable",
  "recommend",
  "recommended",
  "pleased",
  "satisfying",
  "satisfied",
  "reliable",
  "efficient",
  "innovative",
  "strong",
  "useful",
  "valuable",
  "successful",
  "improved",
]);

const NEGATIVE_WORDS = new Set([
  "bad",
  "terrible",
  "awful",
  "horrible",
  "negative",
  "harmful",
  "ineffective",
  "poor",
  "worst",
  "worse",
  "hate",
  "hated",
  "disappointing",
  "disappointed",
  "frustrating",
  "frustrated",
  "inadequate",
  "inferior",
  "problematic",
  "unreliable",
  "useless",
  "flawed",
  "defective",
  "broken",
  "failed",
  "failure",
  "dangerous",
  "risky",
  "weak",
  "lacking",
  "mediocre",
  "subpar",
  "unsatisfactory",
  "unacceptable",
  "dreadful",
  "miserable",
  "annoying",
  "painful",
  "damaging",
  "detrimental",
]);

/**
 * Compute a sentiment score for the given text.
 *
 * Returns a value between -1 (extremely negative) and 1 (extremely positive).
 * A score of 0 indicates neutral sentiment.
 *
 * The algorithm tokenises the text on word boundaries, counts positive and
 * negative word occurrences, and normalises the difference by the total number
 * of sentiment-bearing words.  When no sentiment words are found the score is 0.
 */
export function analyzeSentiment(text: string): number {
  const words = text.toLowerCase().match(/\b[a-z]+\b/g);
  if (!words || words.length === 0) return 0;

  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) positiveCount++;
    if (NEGATIVE_WORDS.has(word)) negativeCount++;
  }

  const total = positiveCount + negativeCount;
  if (total === 0) return 0;

  // Normalise to [-1, 1]
  return (positiveCount - negativeCount) / total;
}
