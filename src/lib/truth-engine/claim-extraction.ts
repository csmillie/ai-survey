// ---------------------------------------------------------------------------
// Claim Extraction — extracts numeric and assertion claims from model answers
// ---------------------------------------------------------------------------

import type { ExtractedClaim } from "./types";

// ---------------------------------------------------------------------------
// Numeric extraction patterns
// ---------------------------------------------------------------------------

const NUMERIC_PATTERNS: Array<{
  pattern: RegExp;
  extract: (match: RegExpMatchArray) => { value: number; unit?: string };
}> = [
  // Percentages: "5.25%", "12%", "0.5 percent"
  {
    pattern: /(-?\d+(?:\.\d+)?)\s*(%|percent)/gi,
    extract: (m) => ({ value: parseFloat(m[1]), unit: "%" }),
  },
  // Currency with multiplier: "$12k", "$1.5M", "$2B"
  {
    pattern: /\$\s*(-?\d+(?:\.\d+)?)\s*([kKmMbB])/g,
    extract: (m) => {
      const base = parseFloat(m[1]);
      const multiplier = { k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase()] ?? 1;
      return { value: base * multiplier, unit: "$" };
    },
  },
  // Currency plain: "$12,000", "$1,500.50"
  {
    pattern: /\$\s*(-?\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g,
    extract: (m) => ({
      value: parseFloat(m[1].replace(/,/g, "")),
      unit: "$",
    }),
  },
  // Plain numbers with commas: "12,000", "1,500,000"
  {
    pattern: /(?<!\$)\b(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?)\b/g,
    extract: (m) => ({
      value: parseFloat(m[1].replace(/,/g, "")),
    }),
  },
  // Decimal numbers: "5.25", "100.0" (require either decimal or >= 2 digits)
  {
    pattern: /(?<!\$|,)\b(-?\d+\.\d+)\b/g,
    extract: (m) => ({ value: parseFloat(m[1]) }),
  },
  // Plain integers >= 2 digits (avoid matching single digits that are likely filler)
  {
    pattern: /(?<!\$|,|\.)\b(-?\d{2,})\b(?!%|,\d)/g,
    extract: (m) => ({ value: parseFloat(m[1]) }),
  },
];

/**
 * Extract numeric claims from a text response.
 */
export function extractNumericClaims(
  text: string,
  modelKey: string
): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];
  const seen = new Set<string>();

  for (const { pattern, extract } of NUMERIC_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const { value, unit } = extract(match);
      // Deduplicate by value+unit
      const key = `${value}:${unit ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Get surrounding context (up to 60 chars each side)
      const start = Math.max(0, match.index - 60);
      const end = Math.min(text.length, match.index + match[0].length + 60);
      const context = text.slice(start, end).trim();

      claims.push({
        kind: "numeric",
        text: context,
        normalized: { value, unit },
        modelKey,
      });
    }
  }

  return claims;
}

/**
 * Extract assertion claims (first 2-3 key sentences) from a text response.
 */
export function extractAssertionClaims(
  text: string,
  modelKey: string,
  maxClaims = 3
): ExtractedClaim[] {
  // Split into sentences
  const sentences = text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15); // Skip very short fragments

  const claims: ExtractedClaim[] = [];
  for (let i = 0; i < Math.min(sentences.length, maxClaims); i++) {
    claims.push({
      kind: "assertion",
      text: sentences[i],
      modelKey,
    });
  }

  return claims;
}

/**
 * Extract all claims (numeric + assertion) from a model answer.
 */
export function extractClaims(
  text: string,
  modelKey: string,
  citations?: string[]
): ExtractedClaim[] {
  const numeric = extractNumericClaims(text, modelKey);
  const assertions = extractAssertionClaims(text, modelKey);

  // Attach citations to all claims
  if (citations && citations.length > 0) {
    for (const claim of [...numeric, ...assertions]) {
      claim.citations = citations;
    }
  }

  return [...numeric, ...assertions];
}
