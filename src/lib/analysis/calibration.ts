// ---------------------------------------------------------------------------
// Confidence calibration scoring and overconfidence detection
// ---------------------------------------------------------------------------

/** Confidence above this value flags a model as overconfident (0-100). */
export const OVERCONFIDENCE_CONFIDENCE_THRESHOLD = 80;

/** Agreement below this value enables overconfidence detection (0-1). */
export const OVERCONFIDENCE_AGREEMENT_THRESHOLD = 0.6;

/** Calibration score below this value triggers a UI warning (0-10). */
export const POOR_CALIBRATION_SCORE_THRESHOLD = 5.0;

export interface CalibrationInput {
  confidence: number; // 0-100
  agreementPercent: number; // 0-1
}

export interface CalibrationResult {
  calibrationScore: number; // 0-10
  avgDelta: number;
}

/**
 * Compute a calibration score measuring how well a model's self-reported
 * confidence tracks actual cross-model agreement.
 *
 * Score 10 = perfect calibration (confidence matches agreement).
 * Lower scores indicate systematic mis-calibration.
 */
export function computeCalibrationScore(
  inputs: CalibrationInput[]
): CalibrationResult {
  if (inputs.length === 0) {
    // No confidence data → return 0 (worst). Call sites must guard on
    // inputs.length > 0 and store null when no data is available rather
    // than persisting this sentinel value.
    return { calibrationScore: 0, avgDelta: 0 };
  }

  const totalDelta = inputs.reduce((sum, { confidence, agreementPercent }) => {
    return sum + Math.abs(confidence - agreementPercent * 100);
  }, 0);

  const avgDelta = totalDelta / inputs.length;
  const calibrationScore = Math.max(0, Math.min(10, 10 - avgDelta / 10));

  return { calibrationScore, avgDelta };
}

// ---------------------------------------------------------------------------
// Overconfidence detection
// ---------------------------------------------------------------------------

export interface OverconfidenceInput {
  modelName: string;
  confidence: number | null;
}

/**
 * Find models that are overconfident on a given question:
 * confidence > 80 when agreement is below 60%.
 */
export function findOverconfidentModels(
  responses: OverconfidenceInput[],
  agreementPercent: number
): string[] {
  if (agreementPercent >= OVERCONFIDENCE_AGREEMENT_THRESHOLD) {
    return [];
  }

  return responses
    .filter((r) => r.confidence !== null && r.confidence > OVERCONFIDENCE_CONFIDENCE_THRESHOLD)
    .map((r) => r.modelName);
}
