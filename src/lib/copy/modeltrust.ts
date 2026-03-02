// ---------------------------------------------------------------------------
// ModelTrust UI Copy
// ---------------------------------------------------------------------------
// Centralized label map for UI terminology. Import from here instead of
// hard-coding strings in components. DB models, API routes, and internal
// variable names remain unchanged — only user-facing text lives here.
// ---------------------------------------------------------------------------

export const COPY = {
  // Brand
  appName: "ModelTrust",
  tagline: "Evaluate which AI models can be trusted in real decision-making.",
  description:
    "ModelTrust compares outputs across models, measures reliability, detects disagreement, and signals when human review is needed.",

  // Navigation & global
  nav: {
    evaluations: "Evaluations",
    settings: "Settings",
    logOut: "Log out",
  },

  // Evaluations (formerly Surveys)
  evaluation: {
    singular: "Evaluation",
    plural: "Evaluations",
    new: "New Evaluation",
    create: "Create Evaluation",
    builder: "Evaluation Builder",
    backToList: "Evaluations",
    backToDetail: "Back to Evaluation",
    run: "Run Evaluation",
    delete: "Delete",
    share: "Share Evaluation",
    titlePlaceholder: "Enter evaluation title",
    descriptionPlaceholder: "Optional description of your evaluation",
    emptyState: "No evaluations yet",
    emptyStateDetail:
      "Create your first evaluation to get started.",
    newDescription:
      "Create a new evaluation. You can add decision prompts, variables, and configure sharing after creation.",
  },

  // Decision Prompts (formerly Questions)
  prompt: {
    singular: "Decision Prompt",
    plural: "Decision Prompts",
    tabLabel: (count: number): string => `Decision Prompts (${count})`,
    add: "Add Prompt",
    addDialogTitle: "Add Decision Prompt",
    type: "Prompt Type",
    promptLabel: "Prompt",
    promptTemplate: "Prompt Template",
    emptyState: "No decision prompts yet. Add your first prompt to get started.",
    description: "Define the prompts that will be sent to AI models.",
    untitled: "Untitled Prompt",
  },

  // Model Outputs (formerly Responses)
  output: {
    singular: "Model Output",
    plural: "Model Outputs",
    count: (n: number): string =>
      `${n} model output${n === 1 ? "" : "s"}`,
    noOutputs: "No model outputs were collected for this run.",
  },

  // Run
  run: {
    singular: "Evaluation Run",
    plural: "Evaluation Runs",
    start: "Start Run",
    starting: "Starting Run...",
    cancel: "Cancel Run",
    cancelling: "Cancelling...",
    configTitle: "Run Evaluation",
    configDescription: (title: string, promptCount: number, varCount: number): string =>
      `Configure and start a new run of ${title}. This evaluation has ${promptCount} prompt${promptCount === 1 ? "" : "s"} and ${varCount} variable${varCount === 1 ? "" : "s"}.`,
    pastRuns: "Run History",
    pastRunsDescription: "Previous runs for this evaluation.",
    selectModels: "Select Models",
    selectModelsDescription: (promptCount: number): string =>
      `Choose which AI models to include in this run. Each model will receive all ${promptCount} prompt${promptCount === 1 ? "" : "s"}.`,
  },

  // Results
  results: {
    pageTitle: "Decision & Reliability Analysis",
    liveTitle: "Decision & Reliability Analysis",
    evaluationLabel: "Evaluation",
    resultsLink: "Results",
    pastResults: "Run History",
    pastResultsDescription: "Past runs and their results.",
  },

  // Sharing
  sharing: {
    tabLabel: (count: number): string => `Sharing (${count})`,
    title: "Sharing",
    description: "Manage who has access to this evaluation.",
    emptyState: "This evaluation is not shared with anyone yet.",
    addCollaborator: "Add Collaborator",
    shareButton: "Share",
  },

  // ModelTrust panel (already branded)
  trust: {
    panelTitle: "ModelTrust",
    panelDescription:
      "Model reliability, cross-model agreement, and performance trends",
    reliability: "Reliability",
    agreement: "Agreement",
    drift: "Drift",
  },

  // Needs Review
  review: {
    flaggedTitle: (count: number): string =>
      `Prompt${count === 1 ? "" : "s"} Flagged for Review`,
    moreFlagged: (count: number): string =>
      `+${count} more flagged prompt${count === 1 ? "" : "s"}`,
  },

  // Metadata
  meta: {
    title: "ModelTrust",
    description:
      "Evaluate which AI models can be trusted in real decision-making. ModelTrust compares outputs across models, measures reliability, detects disagreement, and signals when human review is needed.",
  },
} as const;
