// ---------------------------------------------------------------------------
// Confidence calibration scoring and overconfidence detection
// ---------------------------------------------------------------------------

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
  if (agreementPercent >= 0.6) {
    return [];
  }

  return responses
    .filter((r) => r.confidence !== null && r.confidence > 80)
    .map((r) => r.modelName);
}
