// Google Analytics event tracking utility
// Measurement ID: G-04WT0TYQDD

type GtagEvent = {
  action: string;
  category: string;
  label?: string;
  value?: number;
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent({ action, category, label, value }: GtagEvent): void {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", action, {
      event_category: category,
      event_label: label,
      value,
    });
  }
}

export function trackEvaluationCreated(): void {
  trackEvent({
    action: "create_evaluation",
    category: "evaluation",
  });
}

export function trackQuestionCreated(questionType: string): void {
  trackEvent({
    action: "create_question",
    category: "question",
    label: questionType,
  });
}

export function trackQuestionTypeSelected(questionType: string): void {
  trackEvent({
    action: "select_question_type",
    category: "question",
    label: questionType,
  });
}
