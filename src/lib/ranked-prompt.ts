/**
 * System prompt used for ranked/scored questions.
 */
export function buildRankedSystemPrompt(): string {
  return "You are a research evaluator. You will be asked to rate something on a numeric scale. Respond ONLY with valid JSON in the exact format specified. Do not include any text outside the JSON.";
}

/**
 * Build the JSON enforcement block appended to ranked question prompts.
 */
export function buildRankedEnforcementBlock(config: {
  scaleMin: number;
  scaleMax: number;
  includeReasoning: boolean;
}): string {
  const { scaleMin, scaleMax, includeReasoning } = config;

  const schemaFields = includeReasoning
    ? `{
  "score": <integer from ${scaleMin} to ${scaleMax}>,
  "reasoning": "<brief explanation for your score>"
}`
    : `{
  "score": <integer from ${scaleMin} to ${scaleMax}>
}`;

  return `\n\n---\nRate your response on a scale from ${scaleMin} to ${scaleMax}.\n\nRespond with ONLY valid JSON matching this schema:\n${schemaFields}\n\nDo not wrap the JSON in markdown code fences.\n---`;
}

/**
 * Clamp and round a score to the valid range.
 */
export function clampScore(score: number, min: number, max: number): number {
  const rounded = Math.round(score);
  return Math.max(min, Math.min(max, rounded));
}
