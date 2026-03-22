import type {
  SingleSelectConfig,
  BinaryConfig,
  ForcedChoiceConfig,
  LikertConfig,
  NumericScaleConfig,
  MatrixLikertConfig,
  BenchmarkQuestionConfig,
  BenchmarkOption,
} from "@/lib/benchmark-types";

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

export function buildBenchmarkSystemPrompt(): string {
  return "You are a survey respondent. You will be asked a structured survey question. Respond ONLY with valid JSON in the exact format specified. Do not include any text outside the JSON.";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatOptionList(options: BenchmarkOption[]): string {
  return options.map((o) => `  - "${o.value}" = ${o.label}`).join("\n");
}

function categoricalJsonSchema(): string {
  return `{
  "selectedValue": "<one of the listed option values>",
  "confidence": <integer 0-100>
}`;
}

function numericJsonSchema(min: number, max: number): string {
  return `{
  "score": <number from ${min} to ${max}>,
  "confidence": <integer 0-100>
}`;
}

// ---------------------------------------------------------------------------
// Per-Type Enforcement Block Builders
// ---------------------------------------------------------------------------

export function buildSingleSelectEnforcement(config: SingleSelectConfig): string {
  const optionList = formatOptionList(config.options);
  const dontKnow = config.allowDontKnow
    ? '\nIf you genuinely cannot answer, select "dont_know".'
    : "";

  return `\n\n---
Choose exactly ONE of the following options:
${optionList}${dontKnow}

Respond with ONLY valid JSON matching this schema:
${categoricalJsonSchema()}

Do not wrap the JSON in markdown code fences.
---`;
}

export function buildBinaryEnforcement(config: BinaryConfig): string {
  const optionList = formatOptionList(config.options);

  return `\n\n---
Choose exactly ONE of the following two options:
${optionList}

Respond with ONLY valid JSON matching this schema:
${categoricalJsonSchema()}

Do not wrap the JSON in markdown code fences.
---`;
}

export function buildForcedChoiceEnforcement(config: ForcedChoiceConfig): string {
  const labels: string[] = [];
  if (config.poleALabel) labels.push(`Pole A: ${config.poleALabel}`);
  if (config.poleBLabel) labels.push(`Pole B: ${config.poleBLabel}`);
  const poleContext = labels.length > 0 ? `\n${labels.join("\n")}` : "";

  const optionList = formatOptionList(config.options);

  return `\n\n---
You must choose between these two positions:${poleContext}
${optionList}

Respond with ONLY valid JSON matching this schema:
${categoricalJsonSchema()}

Do not wrap the JSON in markdown code fences.
---`;
}

export function buildLikertEnforcement(config: LikertConfig): string {
  const optionList = formatOptionList(config.options);

  return `\n\n---
Rate your agreement using this ${config.points}-point scale:
${optionList}

Respond with ONLY valid JSON matching this schema:
${categoricalJsonSchema()}

Do not wrap the JSON in markdown code fences.
---`;
}

export function buildNumericScaleEnforcement(config: NumericScaleConfig): string {
  const anchors: string[] = [];
  if (config.minLabel) anchors.push(`${config.min} = ${config.minLabel}`);
  if (config.maxLabel) anchors.push(`${config.max} = ${config.maxLabel}`);
  const anchorText = anchors.length > 0 ? `\nAnchors:\n${anchors.map((a) => `  - ${a}`).join("\n")}` : "";

  return `\n\n---
Provide a numeric rating from ${config.min} to ${config.max}.${anchorText}

Respond with ONLY valid JSON matching this schema:
${numericJsonSchema(config.min, config.max)}

Do not wrap the JSON in markdown code fences.
---`;
}

export function buildMatrixLikertRowEnforcement(
  config: MatrixLikertConfig,
  row: { rowKey: string; label: string },
): string {
  const optionList = formatOptionList(config.options);

  return `\n\n---
${config.stem}

For the item: "${row.label}"

Rate using this scale:
${optionList}

Respond with ONLY valid JSON matching this schema:
${categoricalJsonSchema()}

Do not wrap the JSON in markdown code fences.
---`;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function buildBenchmarkEnforcementBlock(
  config: BenchmarkQuestionConfig,
  matrixRow?: { rowKey: string; label: string },
): string {
  switch (config.type) {
    case "SINGLE_SELECT":
      return buildSingleSelectEnforcement(config);
    case "BINARY":
      return buildBinaryEnforcement(config);
    case "FORCED_CHOICE":
      return buildForcedChoiceEnforcement(config);
    case "LIKERT":
      return buildLikertEnforcement(config);
    case "NUMERIC_SCALE":
      return buildNumericScaleEnforcement(config);
    case "MATRIX_LIKERT":
      // TODO: Phase 2 — consider a separate typed entry point for matrix rows
      // to make the matrixRow requirement visible at compile time.
      if (!matrixRow) {
        throw new Error("matrixRow is required for MATRIX_LIKERT enforcement blocks");
      }
      return buildMatrixLikertRowEnforcement(config, matrixRow);
  }
}
