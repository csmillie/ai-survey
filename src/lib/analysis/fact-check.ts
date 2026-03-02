// ---------------------------------------------------------------------------
// Fact-check analysis — extract claims, numbers, dates, and key assertions
// from LLM responses for cross-model comparison. Pure computation, no IO.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedClaim {
  type: "number" | "percentage" | "date" | "assertion";
  raw: string;
  normalized: string;
  value?: number;
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
    claims: [...extractNumericClaims(text), ...extractDateClaims(text)],
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

  // --- Numeric comparison ---
  // Group numeric claims by normalized form or close values
  const numericDisagreements = findNumericDisagreements(models);
  if (numericDisagreements.length > 0) {
    disagreementSignals.push(
      `${numericDisagreements.length} numeric disagreement${numericDisagreements.length === 1 ? "" : "s"} detected`
    );
  }

  // Check if all models that mention numbers agree
  const allNumericClaims = models.flatMap((m) =>
    m.factCheck.claims.filter((c) => c.type === "number" || c.type === "percentage")
  );
  if (allNumericClaims.length > 0 && numericDisagreements.length === 0) {
    agreementSignals.push("consistent numeric claims");
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
 * Find numeric disagreements across models.
 * Groups claims by proximity (within 20% of mean) and flags splits.
 */
function findNumericDisagreements(
  models: ModelFactData[]
): NumericDisagreement[] {
  // Collect all numeric claims with model attribution
  const allClaims: Array<{
    modelName: string;
    claim: ExtractedClaim;
  }> = [];

  for (const m of models) {
    for (const c of m.factCheck.claims) {
      if ((c.type === "number" || c.type === "percentage") && c.value !== undefined) {
        allClaims.push({ modelName: m.modelName, claim: c });
      }
    }
  }

  if (allClaims.length < 2) return [];

  // Group claims by type + rough magnitude (same order of magnitude)
  const groups = new Map<string, typeof allClaims>();
  for (const entry of allClaims) {
    // Group key: type + order of magnitude
    const magnitude =
      entry.claim.value !== undefined && entry.claim.value !== 0
        ? Math.floor(Math.log10(Math.abs(entry.claim.value)))
        : 0;
    const key = `${entry.claim.type}:${magnitude}`;
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
      .filter((g) => g.claim.value !== undefined)
      .map((g) => g.claim.value as number);
    if (values.length < 2) continue;

    const meanValue = values.reduce((a, b) => a + b, 0) / values.length;
    const maxDelta = Math.max(...values) - Math.min(...values);

    // Flag if values differ by more than 5% of the mean
    const threshold = Math.abs(meanValue) * 0.05;
    if (maxDelta > threshold && maxDelta > 0) {
      disagreements.push({
        claim: group[0].claim.normalized,
        values: group.map((g) => ({
          modelName: g.modelName,
          value: g.claim.value as number,
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
