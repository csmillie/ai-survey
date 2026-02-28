import nlp from "compromise";

// ---------------------------------------------------------------------------
// Entity extraction
// ---------------------------------------------------------------------------

export interface ExtractedEntities {
  people: string[];
  places: string[];
  organizations: string[];
}

/**
 * Extract named entities from text using the compromise NLP library.
 *
 * Returns deduplicated arrays of people, places, and organizations.
 * Organisation detection falls back to a capitalised-phrase heuristic when
 * the library does not surface them directly.
 */
export function extractEntities(text: string): ExtractedEntities {
  const doc = nlp(text);

  const people: string[] = dedupe(doc.people().out("array") as string[]);
  const places: string[] = dedupe(doc.places().out("array") as string[]);

  // compromise exposes .organizations() — use it when available, otherwise
  // fall back to a heuristic that looks for capitalised multi-word sequences.
  let organizations: string[];
  if (typeof doc.organizations === "function") {
    organizations = dedupe(doc.organizations().out("array") as string[]);
  } else {
    organizations = extractCapitalisedPhrases(text);
  }

  return { people, places, organizations };
}

// ---------------------------------------------------------------------------
// Brand mention extraction
// ---------------------------------------------------------------------------

/**
 * Extract likely brand mentions from text.
 *
 * Detects:
 *  - PascalCase words (e.g. "OpenAI", "ChatGPT")
 *  - ALL_CAPS words of 2+ characters that are not common abbreviations
 */
export function extractBrandMentions(text: string): string[] {
  const brands = new Set<string>();

  // PascalCase: at least two uppercase-lowercase transitions
  const pascalCaseRegex = /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g;
  for (const match of text.matchAll(pascalCaseRegex)) {
    brands.add(match[0]);
  }

  // Camel-like with embedded caps (e.g. "ChatGPT", "iPhone")
  const mixedCapsRegex = /\b[A-Za-z]*[a-z][A-Z][A-Za-z]*\b/g;
  for (const match of text.matchAll(mixedCapsRegex)) {
    if (match[0].length >= 3) {
      brands.add(match[0]);
    }
  }

  // ALL_CAPS tokens (at least 2 letters, skip common abbreviations)
  const commonAbbreviations = new Set([
    "AI",
    "API",
    "URL",
    "HTTP",
    "HTTPS",
    "HTML",
    "CSS",
    "JSON",
    "XML",
    "SQL",
    "LLM",
    "NLP",
    "ML",
    "US",
    "UK",
    "EU",
    "IT",
    "OR",
    "AND",
    "THE",
    "NOT",
    "FOR",
    "BUT",
  ]);
  const allCapsRegex = /\b[A-Z]{2,}\b/g;
  for (const match of text.matchAll(allCapsRegex)) {
    if (!commonAbbreviations.has(match[0])) {
      brands.add(match[0]);
    }
  }

  return Array.from(brands);
}

// ---------------------------------------------------------------------------
// Institution mention extraction
// ---------------------------------------------------------------------------

/**
 * Extract institution mentions from text.
 *
 * Looks for patterns like "University of ...", "Institute of ...",
 * "... University", "... College", etc., plus any organisations detected
 * by compromise.
 */
export function extractInstitutionMentions(text: string): string[] {
  const institutions = new Set<string>();

  // Pattern-based extraction
  const patterns = [
    /University\s+of\s+[A-Z][A-Za-z\s]+/g,
    /Institute\s+of\s+[A-Z][A-Za-z\s]+/g,
    /College\s+of\s+[A-Z][A-Za-z\s]+/g,
    /School\s+of\s+[A-Z][A-Za-z\s]+/g,
    /[A-Z][A-Za-z\s]+\s+University/g,
    /[A-Z][A-Za-z\s]+\s+Institute/g,
    /[A-Z][A-Za-z\s]+\s+College/g,
    /[A-Z][A-Za-z\s]+\s+Academy/g,
    /[A-Z][A-Za-z\s]+\s+Foundation/g,
    /[A-Z][A-Za-z\s]+\s+Corporation/g,
    /[A-Z][A-Za-z\s]+\s+Association/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const trimmed = match[0].trim();
      if (trimmed.length > 3) {
        institutions.add(trimmed);
      }
    }
  }

  // Also pull organisations from compromise
  const doc = nlp(text);
  if (typeof doc.organizations === "function") {
    const orgs: string[] = doc.organizations().out("array") as string[];
    for (const org of orgs) {
      institutions.add(org);
    }
  }

  return Array.from(institutions);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));
}

/**
 * Heuristic: extract capitalised multi-word phrases that are likely
 * organisation names (e.g. "World Health Organization").
 */
function extractCapitalisedPhrases(text: string): string[] {
  const regex = /(?:[A-Z][a-z]+\s+){1,5}[A-Z][a-z]+/g;
  const matches: string[] = [];
  for (const match of text.matchAll(regex)) {
    const phrase = match[0].trim();
    if (phrase.split(/\s+/).length >= 2) {
      matches.push(phrase);
    }
  }
  return dedupe(matches);
}
