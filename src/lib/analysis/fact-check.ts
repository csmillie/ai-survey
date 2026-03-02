// ---------------------------------------------------------------------------
// Fact-check analysis — extract claims, numbers, dates, and key assertions
// from LLM responses for cross-model comparison. Pure computation, no IO.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClaimCategory = "percentage" | "currency" | "year" | "rating";

export interface ExtractedClaim {
  type: "number" | "percentage" | "date" | "assertion" | "rating";
  category?: ClaimCategory;
  raw: string;
  normalized: string;
  value?: number;
  scaleMax?: number;        // For ratings: top of the scale (e.g. 10 for "7/10")
  normalizedScore?: number; // For ratings: value normalized to 0-100
}

export interface CitationAnalysis {
  totalCitations: number;
  hasValidUrls: boolean;
  domains: string[];
}

export interface FactCheckResult {
  claims: ExtractedClaim[];
  citationAnalysis: CitationAnalysis;
  keySentences: string[];
}

export interface NumericDisagreement {
  claim: string;
  category?: ClaimCategory;
  values: Array<{ modelName: string; value: number; raw: string }>;
  maxDelta: number;
  meanValue: number;
}

export interface CrossModelComparison {
  numericDisagreements: NumericDisagreement[];
  citationOverlap: number;
  modelsWithCitations: number;
  totalModels: number;
  sharedDomains: string[];
  agreementSignals: string[];
  disagreementSignals: string[];
}

// ---------------------------------------------------------------------------
// Claim extraction
// ---------------------------------------------------------------------------

/**
 * Extract numeric claims (numbers, percentages, currency) from text.
 */
export function extractNumericClaims(text: string): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];
  const seen = new Set<string>();

  // Percentages: "5.25%", "12.5 percent", "5.25 per cent"
  const pctRegex = /(\d+(?:\.\d+)?)\s*(%|percent|per\s*cent)/gi;
  for (const match of text.matchAll(pctRegex)) {
    const raw = match[0].trim();
    if (seen.has(raw)) continue;
    seen.add(raw);
    claims.push({
      type: "percentage",
      category: "percentage",
      raw,
      normalized: `${parseFloat(match[1])}%`,
      value: parseFloat(match[1]),
    });
  }

  // Currency: "$1,234.56", "1.5 billion", "$12M"
  const currencyRegex =
    /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(billion|million|trillion|[BMT])?/gi;
  for (const match of text.matchAll(currencyRegex)) {
    const raw = match[0].trim();
    if (seen.has(raw)) continue;
    seen.add(raw);
    const base = parseFloat(match[1].replace(/,/g, ""));
    const multiplier = getMultiplier(match[2]);
    claims.push({
      type: "number",
      category: "currency",
      raw,
      normalized: `$${(base * multiplier).toLocaleString("en-US")}`,
      value: base * multiplier,
    });
  }

  // Standalone numbers with context (e.g. "approximately 4.75", "roughly 12")
  const numberRegex =
    /(?:approximately|roughly|about|around|nearly|over|under|exactly|estimated at)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(billion|million|trillion|[BMT])?\b/gi;
  for (const match of text.matchAll(numberRegex)) {
    const raw = match[0].trim();
    // Skip if we already captured this as a percentage or currency
    if (seen.has(raw)) continue;
    // Skip pure small integers that are unlikely to be factual claims (1, 2, etc.)
    const base = parseFloat(match[1].replace(/,/g, ""));
    if (base < 10 && !match[2]) continue;
    seen.add(raw);
    const multiplier = getMultiplier(match[2]);
    claims.push({
      type: "number",
      raw,
      normalized: `${(base * multiplier).toLocaleString("en-US")}`,
      value: base * multiplier,
    });
  }

  return claims;
}

/**
 * Extract date claims from text.
 */
export function extractDateClaims(text: string): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];
  const seen = new Set<string>();

  // Year mentions: "in 2024", "since 2020", "by 2030"
  const yearRegex = /\b(in|since|by|from|until|before|after|around)?\s*((?:19|20)\d{2})\b/gi;
  for (const match of text.matchAll(yearRegex)) {
    const raw = match[0].trim();
    if (seen.has(raw)) continue;
    seen.add(raw);
    claims.push({
      type: "date",
      category: "year",
      raw,
      normalized: match[2],
      value: parseInt(match[2], 10),
    });
  }

  // Month-year: "January 2024", "March 2023"
  const monthYearRegex =
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+((?:19|20)\d{2})\b/gi;
  for (const match of text.matchAll(monthYearRegex)) {
    const raw = match[0].trim();
    if (seen.has(raw)) continue;
    seen.add(raw);
    claims.push({
      type: "date",
      raw,
      normalized: `${match[1]} ${match[2]}`,
    });
  }

  return claims;
}

/**
 * Extract rating/score claims from text.
 * Patterns: "7 out of 10", "8/10", "4.5 of 5", "rated 85/100",
 * "score: 7/10", "3.5 out of 5 stars"
 */
export function extractRatingClaims(text: string): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];
  const seen = new Set<string>();

  // Common rating scales we recognise
  const validScales = new Set([3, 4, 5, 6, 7, 10, 20, 25, 50, 100]);

  // Pattern 1: "X out of Y", "X of Y" (with optional context words)
  // e.g., "7 out of 10", "rated 4.5 out of 5", "score of 85 out of 100"
  const outOfRegex =
    /(?:rated?|score[ds]?|rating|ranked?|graded?)?[:\s]*(\d+(?:\.\d+)?)\s+(?:out\s+of|of)\s+(\d+(?:\.\d+)?)\s*(?:stars?|points?)?/gi;
  for (const match of text.matchAll(outOfRegex)) {
    const raw = match[0].trim();
    if (seen.has(raw)) continue;
    const val = parseFloat(match[1]);
    const scale = parseFloat(match[2]);
    if (!validScales.has(scale) || val > scale || val < 0 || scale === 0)
      continue;
    seen.add(raw);
    claims.push({
      type: "rating",
      category: "rating",
      raw,
      normalized: `${val}/${scale}`,
      value: val,
      scaleMax: scale,
      normalizedScore: (val / scale) * 100,
    });
  }

  // Pattern 2: "X/Y" (slash notation)
  // e.g., "8/10", "4.5/5", "85/100"
  const slashRegex =
    /(?:rated?|score[ds]?|rating|ranked?|graded?)?[:\s]*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*(?:stars?|points?)?/gi;
  for (const match of text.matchAll(slashRegex)) {
    const raw = match[0].trim();
    if (seen.has(raw)) continue;
    const val = parseFloat(match[1]);
    const scale = parseFloat(match[2]);
    if (!validScales.has(scale) || val > scale || val < 0 || scale === 0)
      continue;
    seen.add(raw);
    claims.push({
      type: "rating",
      category: "rating",
      raw,
      normalized: `${val}/${scale}`,
      value: val,
      scaleMax: scale,
      normalizedScore: (val / scale) * 100,
    });
  }

  return claims;
}

/**
 * Extract key sentences — the first 2-3 substantive assertions from text.
 */
export function extractKeySentences(text: string, maxSentences = 3): string[] {
  // Split on sentence boundaries
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 500);

  // Prioritize sentences containing factual indicators
  const factualIndicators =
    /\b(is|are|was|were|has|have|had|according|shows?|found|reported|estimated|measured|approximately|percent|%|\$)\b/i;

  const scored = sentences.map((s) => ({
    text: s,
    score: factualIndicators.test(s) ? 1 : 0,
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxSentences).map((s) => s.text);
}

/**
 * Analyze citation quality for a single response.
 */
export function analyzeCitations(
  citations: Array<{ url: string; title?: string; snippet?: string }>
): CitationAnalysis {
  const validCitations = citations.filter((c) =>
    /^https?:\/\//i.test(c.url)
  );

  const domains = validCitations
    .map((c) => {
      try {
        return new URL(c.url).hostname.replace(/^www\./, "");
      } catch {
        return null;
      }
    })
    .filter((d): d is string => d !== null);

  return {
    totalCitations: citations.length,
    hasValidUrls: validCitations.length > 0,
    domains: [...new Set(domains)],
  };
}

/**
 * Run full fact-check extraction on a single response.
 */
export function extractFactCheckData(
  text: string,
  citations: Array<{ url: string; title?: string; snippet?: string }>
): FactCheckResult {
  return {
    claims: [
      ...extractNumericClaims(text),
      ...extractDateClaims(text),
      ...extractRatingClaims(text),
    ],
    citationAnalysis: analyzeCitations(citations),
    keySentences: extractKeySentences(text),
  };
}

// ---------------------------------------------------------------------------
// Cross-model comparison
// ---------------------------------------------------------------------------

export interface ModelFactData {
  modelName: string;
  factCheck: FactCheckResult;
}

/**
 * Compare fact-check data across multiple models for a single question.
 */
export function compareAcrossModels(
  models: ModelFactData[]
): CrossModelComparison {
  const totalModels = models.length;
  const agreementSignals: string[] = [];
  const disagreementSignals: string[] = [];

  // --- Numeric comparison (category-aware) ---
  const numericDisagreements = findNumericDisagreements(models);

  if (numericDisagreements.length > 0) {
    // Group disagreements by category to produce specific signals
    const catCounts = new Map<string, number>();
    for (const d of numericDisagreements) {
      const label = categoryLabel(d.category);
      catCounts.set(label, (catCounts.get(label) ?? 0) + 1);
    }
    for (const [label, count] of catCounts) {
      disagreementSignals.push(
        `${count} ${label} disagreement${count === 1 ? "" : "s"} detected`
      );
    }
  }

  // Check if all models that mention comparable values agree
  const allComparableClaims = models.flatMap((m) =>
    m.factCheck.claims.filter(
      (c) =>
        c.type === "number" ||
        c.type === "percentage" ||
        c.type === "rating" ||
        (c.type === "date" && c.category === "year")
    )
  );

  if (allComparableClaims.length > 0 && numericDisagreements.length === 0) {
    // Generate category-specific agreement signals
    const agreedCategories = new Set(
      allComparableClaims.map((c) => c.category).filter(Boolean)
    );
    if (agreedCategories.size > 0) {
      for (const cat of agreedCategories) {
        agreementSignals.push(`consistent ${categoryLabel(cat)} claims`);
      }
    } else {
      agreementSignals.push("consistent numeric claims");
    }
  }

  // --- Citation comparison ---
  const modelsWithCitations = models.filter(
    (m) => m.factCheck.citationAnalysis.totalCitations > 0
  ).length;

  const allDomains = models.flatMap(
    (m) => m.factCheck.citationAnalysis.domains
  );
  const domainCounts = new Map<string, number>();
  for (const d of allDomains) {
    domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1);
  }
  const sharedDomains = [...domainCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([domain]) => domain);

  // Compute citation overlap ratio: shared domains / total unique domains
  const uniqueDomains = new Set(allDomains);
  const citationOverlap =
    uniqueDomains.size > 0 ? sharedDomains.length / uniqueDomains.size : 0;

  if (modelsWithCitations === totalModels && totalModels > 1) {
    agreementSignals.push("all models provided citations");
  } else if (modelsWithCitations === 0) {
    disagreementSignals.push("no models provided citations");
  } else if (modelsWithCitations < totalModels) {
    const missing = totalModels - modelsWithCitations;
    disagreementSignals.push(
      `${missing} model${missing === 1 ? "" : "s"} missing citations`
    );
  }

  if (sharedDomains.length > 0) {
    agreementSignals.push("overlapping citation sources");
  }

  // --- Key sentence overlap ---
  if (totalModels >= 2) {
    const keySentenceSets = models.map((m) =>
      new Set(m.factCheck.keySentences.map((s) => normalizeForComparison(s)))
    );
    // Simple pairwise check for assertion overlap
    let hasOverlap = false;
    for (let i = 0; i < keySentenceSets.length && !hasOverlap; i++) {
      for (let j = i + 1; j < keySentenceSets.length && !hasOverlap; j++) {
        for (const s of keySentenceSets[i]) {
          if (keySentenceSets[j].has(s)) {
            hasOverlap = true;
            break;
          }
        }
      }
    }
    if (hasOverlap) {
      agreementSignals.push("consistent reasoning");
    }
  }

  return {
    numericDisagreements,
    citationOverlap,
    modelsWithCitations,
    totalModels,
    sharedDomains,
    agreementSignals,
    disagreementSignals,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMultiplier(suffix: string | undefined): number {
  if (!suffix) return 1;
  switch (suffix.toLowerCase()) {
    case "t":
    case "trillion":
      return 1e12;
    case "b":
    case "billion":
      return 1e9;
    case "m":
    case "million":
      return 1e6;
    default:
      return 1;
  }
}

/**
 * Build a grouping key for a claim based on its category + magnitude.
 * Claims with a category are grouped by category first (percentage vs
 * percentage, currency vs currency, etc.) then by order of magnitude.
 * Ratings use the normalized 0-100 score for comparison, so different
 * scales (e.g. "7/10" and "3.5/5") can be compared directly.
 */
function claimGroupKey(claim: ExtractedClaim): string {
  const cat = claim.category ?? claim.type;

  // Ratings are always compared on the normalised 0-100 scale
  if (cat === "rating") return "rating:normalized";

  const comparisonValue =
    claim.value !== undefined && claim.value !== 0
      ? Math.floor(Math.log10(Math.abs(claim.value)))
      : 0;
  return `${cat}:${comparisonValue}`;
}

/**
 * For ratings we compare the normalizedScore (0-100); for everything else
 * we compare the raw value.
 */
function comparableValue(claim: ExtractedClaim): number | undefined {
  if (claim.category === "rating") return claim.normalizedScore;
  return claim.value;
}

/** Human-readable label for a category. */
function categoryLabel(cat: ClaimCategory | undefined): string {
  switch (cat) {
    case "percentage":
      return "percentage";
    case "currency":
      return "dollar amount";
    case "year":
      return "year";
    case "rating":
      return "rating";
    default:
      return "numeric";
  }
}

/**
 * Find numeric disagreements across models.
 * Groups claims by category + magnitude so that percentages are compared
 * with percentages, dollar amounts with dollar amounts, ratings with
 * ratings (normalised to 0-100), and years with years.
 */
function findNumericDisagreements(
  models: ModelFactData[]
): NumericDisagreement[] {
  // Collect all comparable claims with model attribution
  const allClaims: Array<{
    modelName: string;
    claim: ExtractedClaim;
  }> = [];

  for (const m of models) {
    for (const c of m.factCheck.claims) {
      const isComparable =
        c.type === "number" ||
        c.type === "percentage" ||
        c.type === "rating" ||
        (c.type === "date" && c.category === "year");
      if (isComparable && comparableValue(c) !== undefined) {
        allClaims.push({ modelName: m.modelName, claim: c });
      }
    }
  }

  if (allClaims.length < 2) return [];

  // Group claims by category + magnitude
  const groups = new Map<string, typeof allClaims>();
  for (const entry of allClaims) {
    const key = claimGroupKey(entry.claim);
    const group = groups.get(key);
    if (group) {
      group.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }

  const disagreements: NumericDisagreement[] = [];

  for (const group of groups.values()) {
    // Need at least 2 claims from different models
    const uniqueModels = new Set(group.map((g) => g.modelName));
    if (uniqueModels.size < 2) continue;

    const values = group
      .map((g) => comparableValue(g.claim))
      .filter((v): v is number => v !== undefined);
    if (values.length < 2) continue;

    const meanValue = values.reduce((a, b) => a + b, 0) / values.length;
    const maxDelta = Math.max(...values) - Math.min(...values);

    // Category-aware threshold:
    //   years → any difference (threshold 0) since even 1 year matters
    //   everything else → 5% of the mean
    const cat = group[0].claim.category;
    const threshold = cat === "year" ? 0 : Math.abs(meanValue) * 0.05;
    if (maxDelta > threshold && maxDelta > 0) {
      disagreements.push({
        claim: group[0].claim.normalized,
        category: cat,
        values: group.map((g) => ({
          modelName: g.modelName,
          value: comparableValue(g.claim) ?? (g.claim.value as number),
          raw: g.claim.raw,
        })),
        maxDelta,
        meanValue,
      });
    }
  }

  return disagreements;
}

/**
 * Normalize a sentence for rough comparison (lowercase, strip punctuation).
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
