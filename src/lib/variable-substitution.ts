/**
 * Pattern matching `{{key}}` placeholders in a template string.
 * Captures the key name inside the double braces.
 */
const PLACEHOLDER_REGEX = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

interface SubstitutionResult {
  /** The template with all resolvable placeholders replaced. */
  result: string;
  /** Keys that appeared in the template but were not found in the variables map. */
  unresolved: string[];
}

/**
 * Substitute `{{key}}` placeholders in a template with values from a variables map.
 *
 * Any placeholder whose key is not present in the variables map is left as-is
 * and its key is included in the `unresolved` list.
 *
 * @param template  - The template string containing `{{key}}` placeholders.
 * @param variables - A map of variable keys to their replacement values.
 * @returns An object with the substituted `result` string and an array of `unresolved` keys.
 */
export function substituteVariables(
  template: string,
  variables: Record<string, string>
): SubstitutionResult {
  const unresolvedSet = new Set<string>();

  const result = template.replace(PLACEHOLDER_REGEX, (match, key: string) => {
    if (Object.hasOwn(variables, key)) {
      return variables[key];
    }
    unresolvedSet.add(key);
    return match;
  });

  return {
    result,
    unresolved: Array.from(unresolvedSet),
  };
}
