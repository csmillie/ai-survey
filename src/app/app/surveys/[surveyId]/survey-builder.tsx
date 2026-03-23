"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectOption } from "@/components/ui/select";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SCALE_PRESETS, rankedConfigSchema } from "@/lib/schemas";
import { deleteSurveyAction } from "@/app/app/surveys/actions";
import {
  updateSurveyAction,
  addQuestionAction,
  updateQuestionAction,
  deleteQuestionAction,
  addVariableAction,
  updateVariableAction,
  deleteVariableAction,
  addShareAction,
  removeShareAction,
} from "./actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuestionData {
  id: string;
  title: string;
  promptTemplate: string;
  mode: string;
  threadKey: string | null;
  order: number;
  type: string;
  configJson: Record<string, unknown> | null;
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  OPEN_ENDED: "Open Ended",
  RANKED: "Ranked",
  SINGLE_SELECT: "Single Select",
  BINARY: "Binary",
  FORCED_CHOICE: "Forced Choice",
  LIKERT: "Likert",
  NUMERIC_SCALE: "Numeric Scale",
  MATRIX_LIKERT: "Matrix Likert",
};

const ALL_TYPES = Object.keys(QUESTION_TYPE_LABELS);

interface VariableData {
  id: string;
  key: string;
  label: string | null;
  defaultValue: string | null;
}

interface ShareData {
  id: string;
  userId: string;
  email: string;
  role: string;
}

interface RunData {
  id: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  createdByEmail: string;
  responseCount: number;
}

interface SurveyBuilderProps {
  surveyId: string;
  title: string;
  description: string | null;
  questions: QuestionData[];
  variables: VariableData[];
  shares: ShareData[];
  isOwner: boolean;
  runs: RunData[];
}

// ---------------------------------------------------------------------------
// Survey Builder
// ---------------------------------------------------------------------------

export function SurveyBuilder({
  surveyId,
  title,
  description,
  questions,
  variables,
  shares,
  isOwner,
  runs,
}: SurveyBuilderProps) {
  return (
    <div className="space-y-6">
      <SurveyHeader
        surveyId={surveyId}
        title={title}
        description={description}
      />

      {/* Tabs */}
      <Tabs defaultValue="questions">
        <TabsContent value="questions">
          <QuestionsTab surveyId={surveyId} questions={questions} />
        </TabsContent>

        <TabsContent value="variables">
          <VariablesTab surveyId={surveyId} variables={variables} />
        </TabsContent>

        <TabsContent value="sharing">
          <SharingTab
            surveyId={surveyId}
            shares={shares}
            isOwner={isOwner}
          />
        </TabsContent>
      </Tabs>

      {/* Results */}
      {runs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Run History</CardTitle>
            <CardDescription>
              Past runs and their results.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Responses</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <Badge
                        variant={
                          run.status === "COMPLETED"
                            ? "default"
                            : run.status === "FAILED"
                              ? "destructive"
                              : run.status === "CANCELLED"
                                ? "outline"
                                : "secondary"
                        }
                      >
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-[hsl(var(--muted-foreground))]" suppressHydrationWarning>
                      {run.completedAt
                        ? new Date(run.completedAt).toLocaleString()
                        : run.status === "QUEUED" || run.status === "RUNNING"
                          ? "In progress..."
                          : "--"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {run.createdByEmail}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {run.responseCount}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/app/runs/${run.id}`}
                        className="text-sm font-medium text-[hsl(var(--primary))] hover:underline"
                      >
                        Analysis
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Danger zone */}
      {isOwner && (
        <DeleteEvaluationDialog surveyId={surveyId} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Evaluation Dialog
// ---------------------------------------------------------------------------

function DeleteEvaluationDialog({ surveyId }: { surveyId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex justify-end border-t border-[hsl(var(--border))] pt-6">
        <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
          Delete Evaluation
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Evaluation?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            This will permanently delete the evaluation and all of its prompts,
            runs, and results. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <form action={deleteSurveyAction as unknown as (formData: FormData) => void}>
              <input type="hidden" name="surveyId" value={surveyId} />
              <Button type="submit" variant="destructive">
                Delete
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Survey Header (title + description with inline edit)
// ---------------------------------------------------------------------------

function SurveyHeader({
  surveyId,
  title,
  description,
}: {
  surveyId: string;
  title: string;
  description: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const boundUpdateSurvey = updateSurveyAction.bind(null, surveyId);

  async function handleSave(formData: FormData) {
    const result = await boundUpdateSurvey(formData);
    if (result && !result.success) {
      alert(result.error);
      return;
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <form action={handleSave} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="survey-title">Title</Label>
          <Input
            id="survey-title"
            name="title"
            defaultValue={title}
            required
            maxLength={200}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="survey-description">Description</Label>
          <Textarea
            id="survey-description"
            name="description"
            defaultValue={description ?? ""}
            rows={2}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm">
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-[hsl(var(--muted-foreground))]">
            {description}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setEditing(true)}
      >
        Edit
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Questions Tab
// ---------------------------------------------------------------------------

function QuestionsTab({
  surveyId,
  questions,
}: {
  surveyId: string;
  questions: QuestionData[];
}) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const addFormRef = useRef<HTMLFormElement>(null);
  const [configValid, setConfigValid] = useState(true);

  const [questionType, setQuestionType] = useState<string>("OPEN_ENDED");
  const [scalePreset, setScalePreset] = useState<string>("0-5");
  const [scaleMin, setScaleMin] = useState(0);
  const [scaleMax, setScaleMax] = useState(5);
  const [includeReasoning, setIncludeReasoning] = useState(true);
  const [questionMode, setQuestionMode] = useState<"STATELESS" | "THREADED">("STATELESS");
  const [creatingNewThread, setCreatingNewThread] = useState(false);
  const [threadKeySelection, setThreadKeySelection] = useState<string>("");
  const [newThreadKey, setNewThreadKey] = useState("");

  // Collect existing thread keys from all threaded questions
  const existingThreadKeys = Array.from(
    new Set(
      questions
        .filter((q) => q.mode === "THREADED" && q.threadKey)
        .map((q) => q.threadKey!)
    )
  );

  const boundAddQuestion = addQuestionAction.bind(null, surveyId);

  // Generate a default thread key name
  function generateThreadKey(): string {
    for (let i = 1; ; i++) {
      const candidate = `thread-${i}`;
      if (!existingThreadKeys.includes(candidate)) return candidate;
    }
  }

  async function handleAddQuestion(formData: FormData) {
    const result = await boundAddQuestion(formData);
    if (result && !result.success) {
      alert(result.error);
      return;
    }
    addFormRef.current?.reset();
    setQuestionType("OPEN_ENDED");
    setScalePreset("0-5");
    setScaleMin(0);
    setScaleMax(5);
    setIncludeReasoning(true);
    setQuestionMode("STATELESS");
    setCreatingNewThread(false);
    setThreadKeySelection("");
    setNewThreadKey("");
    setAddDialogOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-xl">Decision Prompts</CardTitle>
          <CardDescription>
            Define the prompts that will be sent to AI models.
          </CardDescription>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger>
            <Button variant="outline" size="sm">Add Prompt</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Decision Prompt</DialogTitle>
            </DialogHeader>
            <form ref={addFormRef} action={handleAddQuestion} className="space-y-4">
              {/* Question Type Selector */}
              <div className="space-y-2">
                <Label>Prompt Type</Label>
                <Select
                  value={questionType}
                  onChange={(e) => {
                    setQuestionType(e.target.value);
                    setConfigValid(true);
                  }}
                >
                  {ALL_TYPES.map((t) => (
                    <SelectOption key={t} value={t}>
                      {QUESTION_TYPE_LABELS[t]}
                    </SelectOption>
                  ))}
                </Select>
                <input type="hidden" name="type" value={questionType} />
              </div>

              {/* Prompt Template */}
              <div className="space-y-2">
                <Label htmlFor="q-prompt">Prompt</Label>
                <Textarea
                  id="q-prompt"
                  name="promptTemplate"
                  placeholder={
                    questionType === "RANKED"
                      ? `e.g., How would you rate {{brand}}?`
                      : "e.g., What do you think about {{brand}}?"
                  }
                  rows={4}
                  required
                />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Use {"{{variable_name}}"} syntax for variable substitution.
                </p>
              </div>

              {/* Ranked Configuration */}
              {questionType === "RANKED" && (
                <div className="space-y-3 rounded-lg border p-3">
                  <h4 className="text-sm font-medium">Scale Configuration</h4>
                  <div className="space-y-2">
                    <Label htmlFor="q-scalePreset">Scale Preset</Label>
                    <Select
                      id="q-scalePreset"
                      value={scalePreset}
                      onChange={(e) => {
                        const preset = e.target.value;
                        setScalePreset(preset);
                        const defaults = SCALE_PRESETS[preset as keyof typeof SCALE_PRESETS];
                        if (defaults) {
                          setScaleMin(defaults.min);
                          setScaleMax(defaults.max);
                        }
                      }}
                    >
                      <SelectOption value="0-5">0 to 5</SelectOption>
                      <SelectOption value="0-10">0 to 10</SelectOption>
                      <SelectOption value="0-100">0 to 100</SelectOption>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="q-scaleMin">Min</Label>
                      <Input
                        id="q-scaleMin"
                        type="number"
                        value={scaleMin}
                        onChange={(e) => setScaleMin(Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="q-scaleMax">Max</Label>
                      <Input
                        id="q-scaleMax"
                        type="number"
                        value={scaleMax}
                        onChange={(e) => setScaleMax(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="q-includeReasoning"
                      type="checkbox"
                      checked={includeReasoning}
                      onChange={(e) => setIncludeReasoning(e.target.checked)}
                      className="h-4 w-4 rounded border-[hsl(var(--border))]"
                    />
                    <Label htmlFor="q-includeReasoning" className="text-sm font-normal">
                      Include reasoning in output
                    </Label>
                  </div>
                  <input
                    type="hidden"
                    name="configJson"
                    value={JSON.stringify({ scalePreset, scaleMin, scaleMax, includeReasoning })}
                  />
                </div>
              )}

              {/* Benchmark Configuration (JSON editor for new types) */}
              {["SINGLE_SELECT", "BINARY", "FORCED_CHOICE", "LIKERT", "NUMERIC_SCALE", "MATRIX_LIKERT"].includes(questionType) && (
                <BenchmarkConfigEditor key={questionType} questionType={questionType} onValidChange={setConfigValid} />
              )}

              {/* Mode */}
              <div className="space-y-2">
                <Label htmlFor="q-mode">Mode</Label>
                <Select
                  id="q-mode"
                  name="mode"
                  value={questionMode}
                  onChange={(e) => {
                    const mode = e.target.value as "STATELESS" | "THREADED";
                    setQuestionMode(mode);
                    if (mode === "THREADED") {
                      if (existingThreadKeys.length > 0) {
                        setThreadKeySelection(existingThreadKeys[existingThreadKeys.length - 1]);
                        setCreatingNewThread(false);
                      } else {
                        setCreatingNewThread(true);
                        setNewThreadKey(generateThreadKey());
                      }
                    }
                  }}
                >
                  <SelectOption value="STATELESS">Stateless</SelectOption>
                  <SelectOption value="THREADED">Threaded</SelectOption>
                </Select>
              </div>

              {/* Thread Key (only shown when THREADED) */}
              {questionMode === "THREADED" && (
                <div className="space-y-2">
                  <Label>Thread</Label>
                  {creatingNewThread ? (
                    <>
                      <Input
                        value={newThreadKey}
                        onChange={(e) => setNewThreadKey(e.target.value)}
                        placeholder="e.g., main-thread"
                        autoFocus
                      />
                      {existingThreadKeys.length > 0 && (
                        <button
                          type="button"
                          className="text-xs text-[hsl(var(--primary))] hover:underline"
                          onClick={() => {
                            setCreatingNewThread(false);
                            setThreadKeySelection(existingThreadKeys[existingThreadKeys.length - 1]);
                          }}
                        >
                          Use existing thread
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <Select
                        value={threadKeySelection}
                        onChange={(e) => setThreadKeySelection(e.target.value)}
                      >
                        {existingThreadKeys.map((key) => (
                          <SelectOption key={key} value={key}>{key}</SelectOption>
                        ))}
                      </Select>
                      <button
                        type="button"
                        className="text-xs text-[hsl(var(--primary))] hover:underline"
                        onClick={() => {
                          setCreatingNewThread(true);
                          if (!newThreadKey) setNewThreadKey(generateThreadKey());
                        }}
                      >
                        + New thread
                      </button>
                    </>
                  )}
                  <input
                    type="hidden"
                    name="threadKey"
                    value={creatingNewThread ? newThreadKey : threadKeySelection}
                  />
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Prompts with the same thread share conversation history.
                  </p>
                </div>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!configValid}>Add Prompt</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {questions.length === 0 ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No decision prompts yet. Add your first prompt to get started.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Prompt Preview</TableHead>
                <TableHead className="text-center">Type</TableHead>
                <TableHead className="text-center">Mode</TableHead>
                <TableHead className="w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((q, qIdx) =>
                editingId === q.id ? (
                  <QuestionEditRow
                    key={q.id}
                    surveyId={surveyId}
                    question={q}
                    questions={questions}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <TableRow key={q.id}>
                    <TableCell className="text-[hsl(var(--muted-foreground))]">
                      {qIdx + 1}
                    </TableCell>
                    <TableCell className="font-medium">{q.title}</TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">
                        {q.promptTemplate}
                      </p>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {(() => {
                          if (q.type === "RANKED" && q.configJson) {
                            const rc = rankedConfigSchema.safeParse(q.configJson);
                            if (rc.success) return `Ranked ${rc.data.scaleMin}-${rc.data.scaleMax}`;
                          }
                          return QUESTION_TYPE_LABELS[q.type] ?? q.type;
                        })()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          q.mode === "THREADED" ? "default" : "secondary"
                        }
                      >
                        {q.mode === "THREADED" && q.threadKey
                          ? `THREADED · ${q.threadKey}`
                          : q.mode}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(q.id)}
                        >
                          Edit
                        </Button>
                        <DeleteQuestionButton
                          surveyId={surveyId}
                          questionId={q.id}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function QuestionEditRow({
  surveyId,
  question,
  questions,
  onDone,
}: {
  surveyId: string;
  question: QuestionData;
  questions: QuestionData[];
  onDone: () => void;
}) {
  const boundUpdate = updateQuestionAction.bind(null, surveyId, question.id);
  const [editConfigValid, setEditConfigValid] = useState(true);

  const [editType, setEditType] = useState<string>(question.type);
  const rankedResult = question.type === "RANKED" ? rankedConfigSchema.safeParse(question.configJson) : null;
  const rankedConfig = rankedResult?.success ? rankedResult.data : null;
  const [editScalePreset, setEditScalePreset] = useState<string>(
    rankedConfig?.scalePreset ?? "0-5"
  );
  const [editScaleMin, setEditScaleMin] = useState(
    rankedConfig?.scaleMin ?? 0
  );
  const [editScaleMax, setEditScaleMax] = useState(
    rankedConfig?.scaleMax ?? 5
  );
  const [editIncludeReasoning, setEditIncludeReasoning] = useState(
    rankedConfig?.includeReasoning ?? true
  );
  const [editMode, setEditMode] = useState<"STATELESS" | "THREADED">(
    question.mode === "THREADED" ? "THREADED" : "STATELESS"
  );

  // Collect existing thread keys from other threaded questions
  const existingThreadKeys = Array.from(
    new Set(
      questions
        .filter((q) => q.mode === "THREADED" && q.threadKey && q.id !== question.id)
        .map((q) => q.threadKey!)
    )
  );

  // Determine if the question's current thread key is one of the shared keys or a unique one
  const currentKeyIsShared = question.threadKey != null && existingThreadKeys.includes(question.threadKey);
  const currentKeyIsOwn = question.threadKey != null && !currentKeyIsShared;

  const [editCreatingNewThread, setEditCreatingNewThread] = useState(
    // Creating new if: no thread key, or it's a unique key not shared with others
    question.mode !== "THREADED" || !question.threadKey || currentKeyIsOwn
  );
  const [editThreadKeySelection, setEditThreadKeySelection] = useState<string>(
    currentKeyIsShared ? question.threadKey! : (existingThreadKeys[existingThreadKeys.length - 1] ?? "")
  );
  const [editNewThreadKey, setEditNewThreadKey] = useState(
    currentKeyIsOwn ? question.threadKey! : ""
  );

  async function handleSubmit(formData: FormData) {
    const result = await boundUpdate(formData);
    if (result && !result.success) {
      alert(result.error);
      return;
    }
    onDone();
  }

  return (
    <TableRow>
      <TableCell colSpan={6}>
        <form action={handleSubmit} className="space-y-3 py-2">
          {/* Type Selector */}
          <div className="space-y-1">
            <Label>Question Type</Label>
            <Select
              value={editType}
              onChange={(e) => setEditType(e.target.value)}
            >
              {ALL_TYPES.map((t) => (
                <SelectOption key={t} value={t}>
                  {QUESTION_TYPE_LABELS[t]}
                </SelectOption>
              ))}
            </Select>
            <input type="hidden" name="type" value={editType} />
          </div>

          <input type="hidden" name="title" value={question.title} />
          <div className="space-y-1">
            <Label htmlFor={`edit-q-mode-${question.id}`}>Mode</Label>
            <Select
              id={`edit-q-mode-${question.id}`}
              name="mode"
              value={editMode}
              onChange={(e) => setEditMode(e.target.value as "STATELESS" | "THREADED")}
            >
              <SelectOption value="STATELESS">Stateless</SelectOption>
              <SelectOption value="THREADED">Threaded</SelectOption>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`edit-q-prompt-${question.id}`}>
              Prompt Template
            </Label>
            <Textarea
              id={`edit-q-prompt-${question.id}`}
              name="promptTemplate"
              defaultValue={question.promptTemplate}
              rows={3}
              required
            />
          </div>

          {/* Ranked Configuration */}
          {editType === "RANKED" && (
            <div className="space-y-3 rounded-lg border p-3">
              <h4 className="text-sm font-medium">Scale Configuration</h4>
              <div className="space-y-2">
                <Label htmlFor={`edit-q-scalePreset-${question.id}`}>Scale Preset</Label>
                <Select
                  id={`edit-q-scalePreset-${question.id}`}
                  value={editScalePreset}
                  onChange={(e) => {
                    const preset = e.target.value;
                    setEditScalePreset(preset);
                    const defaults = SCALE_PRESETS[preset as keyof typeof SCALE_PRESETS];
                    if (defaults) {
                      setEditScaleMin(defaults.min);
                      setEditScaleMax(defaults.max);
                    }
                  }}
                >
                  <SelectOption value="0-5">0 to 5</SelectOption>
                  <SelectOption value="0-10">0 to 10</SelectOption>
                  <SelectOption value="0-100">0 to 100</SelectOption>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`edit-q-scaleMin-${question.id}`}>Min</Label>
                  <Input
                    id={`edit-q-scaleMin-${question.id}`}
                    type="number"
                    value={editScaleMin}
                    onChange={(e) => setEditScaleMin(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`edit-q-scaleMax-${question.id}`}>Max</Label>
                  <Input
                    id={`edit-q-scaleMax-${question.id}`}
                    type="number"
                    value={editScaleMax}
                    onChange={(e) => setEditScaleMax(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id={`edit-q-includeReasoning-${question.id}`}
                  type="checkbox"
                  checked={editIncludeReasoning}
                  onChange={(e) => setEditIncludeReasoning(e.target.checked)}
                  className="h-4 w-4 rounded border-[hsl(var(--border))]"
                />
                <Label htmlFor={`edit-q-includeReasoning-${question.id}`} className="text-sm font-normal">
                  Include reasoning in response
                </Label>
              </div>
              <input
                type="hidden"
                name="configJson"
                value={JSON.stringify({
                  scalePreset: editScalePreset,
                  scaleMin: editScaleMin,
                  scaleMax: editScaleMax,
                  includeReasoning: editIncludeReasoning,
                })}
              />
            </div>
          )}

          {/* Benchmark Configuration (edit) */}
          {["SINGLE_SELECT", "BINARY", "FORCED_CHOICE", "LIKERT", "NUMERIC_SCALE", "MATRIX_LIKERT"].includes(editType) && (
            <BenchmarkConfigEditor
              key={editType}
              questionType={editType}
              initialConfig={question.configJson ?? undefined}
              onValidChange={setEditConfigValid}
            />
          )}

          {/* Thread Key (only shown when THREADED) */}
          {editMode === "THREADED" && (
            <div className="space-y-1">
              <Label>Thread</Label>
              {editCreatingNewThread ? (
                <>
                  <Input
                    value={editNewThreadKey}
                    onChange={(e) => setEditNewThreadKey(e.target.value)}
                    placeholder="e.g., main-thread"
                  />
                  {existingThreadKeys.length > 0 && (
                    <button
                      type="button"
                      className="text-xs text-[hsl(var(--primary))] hover:underline"
                      onClick={() => {
                        setEditCreatingNewThread(false);
                        if (!editThreadKeySelection) {
                          setEditThreadKeySelection(existingThreadKeys[existingThreadKeys.length - 1]);
                        }
                      }}
                    >
                      Use existing thread
                    </button>
                  )}
                </>
              ) : (
                <>
                  <Select
                    value={editThreadKeySelection}
                    onChange={(e) => setEditThreadKeySelection(e.target.value)}
                  >
                    {existingThreadKeys.map((key) => (
                      <SelectOption key={key} value={key}>{key}</SelectOption>
                    ))}
                  </Select>
                  <button
                    type="button"
                    className="text-xs text-[hsl(var(--primary))] hover:underline"
                    onClick={() => {
                      setEditCreatingNewThread(true);
                      if (!editNewThreadKey) {
                        // Generate a unique thread key
                        for (let i = 1; ; i++) {
                          const candidate = `thread-${i}`;
                          if (!existingThreadKeys.includes(candidate)) {
                            setEditNewThreadKey(candidate);
                            break;
                          }
                        }
                      }
                    }}
                  >
                    + New thread
                  </button>
                </>
              )}
              <input
                type="hidden"
                name="threadKey"
                value={editCreatingNewThread ? editNewThreadKey : editThreadKeySelection}
              />
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Questions with the same thread share conversation history.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!editConfigValid}>
              Save
            </Button>
          </div>
        </form>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Benchmark Config Editor — JSON-based config for benchmark question types
// ---------------------------------------------------------------------------

const DEFAULT_CONFIGS: Record<string, Record<string, unknown>> = {
  SINGLE_SELECT: {
    type: "SINGLE_SELECT",
    options: [
      { label: "Option A", value: "option_a" },
      { label: "Option B", value: "option_b" },
    ],
  },
  BINARY: {
    type: "BINARY",
    options: [
      { label: "Yes", value: "yes", numericValue: 1 },
      { label: "No", value: "no", numericValue: 0 },
    ],
  },
  FORCED_CHOICE: {
    type: "FORCED_CHOICE",
    options: [
      { label: "Position A", value: "a" },
      { label: "Position B", value: "b" },
    ],
  },
  LIKERT: {
    type: "LIKERT",
    points: 5,
    options: [
      { label: "Strongly agree", value: "strongly_agree", numericValue: 5 },
      { label: "Agree", value: "agree", numericValue: 4 },
      { label: "Neither agree nor disagree", value: "neither", numericValue: 3 },
      { label: "Disagree", value: "disagree", numericValue: 2 },
      { label: "Strongly disagree", value: "strongly_disagree", numericValue: 1 },
    ],
  },
  NUMERIC_SCALE: {
    type: "NUMERIC_SCALE",
    min: 0,
    max: 10,
    minLabel: "",
    maxLabel: "",
  },
  MATRIX_LIKERT: {
    type: "MATRIX_LIKERT",
    stem: "Rate the following items:",
    options: [
      { label: "A great deal", value: "great_deal", numericValue: 3 },
      { label: "Only some", value: "only_some", numericValue: 2 },
      { label: "Hardly any", value: "hardly_any", numericValue: 1 },
    ],
  },
};

function BenchmarkConfigEditor({
  questionType,
  initialConfig,
  onValidChange,
}: {
  questionType: string;
  initialConfig?: Record<string, unknown>;
  onValidChange?: (valid: boolean) => void;
}) {
  const defaultConfig = DEFAULT_CONFIGS[questionType];
  const existingType = typeof initialConfig?.["type"] === "string" ? initialConfig["type"] : undefined;
  const configToUse = existingType === questionType ? initialConfig : defaultConfig;

  // Key state by questionType so React resets it when type changes
  const [configText, setConfigText] = useState(
    JSON.stringify(configToUse, null, 2)
  );
  const [parseError, setParseError] = useState<string | null>(null);

  function handleChange(value: string) {
    setConfigText(value);
    try {
      JSON.parse(value);
      setParseError(null);
      onValidChange?.(true);
    } catch {
      setParseError("Invalid JSON");
      onValidChange?.(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <h4 className="text-sm font-medium">
        {QUESTION_TYPE_LABELS[questionType]} Configuration
      </h4>
      <Textarea
        value={configText}
        onChange={(e) => handleChange(e.target.value)}
        rows={8}
        className="font-mono text-xs"
        aria-label={`${QUESTION_TYPE_LABELS[questionType]} configuration JSON`}
      />
      {parseError && (
        <p className="text-xs text-[hsl(var(--destructive))]">{parseError}</p>
      )}
      <input
        type="hidden"
        name="configJson"
        value={parseError ? "" : configText}
      />
    </div>
  );
}

function DeleteQuestionButton({
  surveyId,
  questionId,
}: {
  surveyId: string;
  questionId: string;
}) {
  const router = useRouter();
  const boundDelete = deleteQuestionAction.bind(null, surveyId, questionId);

  async function handleDelete() {
    await boundDelete();
    router.refresh();
  }

  return (
    <form action={handleDelete}>
      <Button type="submit" variant="ghost" size="sm" className="text-[hsl(var(--destructive))]">
        Delete
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Variables Tab
// ---------------------------------------------------------------------------

function VariablesTab({
  surveyId,
  variables,
}: {
  surveyId: string;
  variables: VariableData[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const addFormRef = useRef<HTMLFormElement>(null);

  const boundAddVariable = addVariableAction.bind(null, surveyId);

  async function handleAddVariable(formData: FormData) {
    const result = await boundAddVariable(formData);
    if (result && !result.success) {
      alert(result.error);
      return;
    }
    addFormRef.current?.reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Variables</CardTitle>
        <CardDescription>
          Define variables that can be substituted into prompt templates using{" "}
          {"{{key}}"} syntax.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Variable list */}
        {variables.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Default Value</TableHead>
                <TableHead className="w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variables.map((v) =>
                editingId === v.id ? (
                  <VariableEditRow
                    key={v.id}
                    surveyId={surveyId}
                    variable={v}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <TableRow key={v.id}>
                    <TableCell>
                      <code className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-sm">
                        {v.key}
                      </code>
                    </TableCell>
                    <TableCell>
                      {v.label || (
                        <span className="text-[hsl(var(--muted-foreground))]">
                          --
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {v.defaultValue || (
                        <span className="text-[hsl(var(--muted-foreground))]">
                          --
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(v.id)}
                        >
                          Edit
                        </Button>
                        <DeleteVariableButton
                          surveyId={surveyId}
                          variableId={v.id}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        )}

        {variables.length === 0 && (
          <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No variables defined yet.
          </p>
        )}

        {/* Add variable form */}
        <div className="rounded-lg border p-4">
          <h4 className="mb-3 text-sm font-medium">Add Variable</h4>
          <form
            ref={addFormRef}
            action={handleAddVariable}
            className="grid grid-cols-3 gap-3"
          >
            <div className="space-y-1">
              <Label htmlFor="var-key">Key</Label>
              <Input
                id="var-key"
                name="key"
                placeholder="e.g., brand_name"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="var-label">Label</Label>
              <Input
                id="var-label"
                name="label"
                placeholder="e.g., Brand Name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="var-default">Default Value</Label>
              <div className="flex gap-2">
                <Input
                  id="var-default"
                  name="defaultValue"
                  placeholder="Optional default"
                />
                <Button type="submit" size="sm">
                  Add
                </Button>
              </div>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

function VariableEditRow({
  surveyId,
  variable,
  onDone,
}: {
  surveyId: string;
  variable: VariableData;
  onDone: () => void;
}) {
  const boundUpdate = updateVariableAction.bind(null, surveyId, variable.id);

  async function handleSubmit(formData: FormData) {
    const result = await boundUpdate(formData);
    if (result && !result.success) {
      alert(result.error);
      return;
    }
    onDone();
  }

  return (
    <TableRow>
      <TableCell colSpan={4}>
        <form
          action={handleSubmit}
          className="grid grid-cols-3 gap-3 py-2"
        >
          <div className="space-y-1">
            <Label htmlFor={`edit-var-key-${variable.id}`}>Key</Label>
            <Input
              id={`edit-var-key-${variable.id}`}
              name="key"
              defaultValue={variable.key}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`edit-var-label-${variable.id}`}>Label</Label>
            <Input
              id={`edit-var-label-${variable.id}`}
              name="label"
              defaultValue={variable.label ?? ""}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`edit-var-default-${variable.id}`}>
              Default Value
            </Label>
            <div className="flex gap-2">
              <Input
                id={`edit-var-default-${variable.id}`}
                name="defaultValue"
                defaultValue={variable.defaultValue ?? ""}
              />
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDone}
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </TableCell>
    </TableRow>
  );
}

function DeleteVariableButton({
  surveyId,
  variableId,
}: {
  surveyId: string;
  variableId: string;
}) {
  const boundDelete = deleteVariableAction.bind(null, surveyId, variableId);

  async function handleDelete() {
    await boundDelete();
  }

  return (
    <form action={handleDelete}>
      <Button type="submit" variant="ghost" size="sm" className="text-[hsl(var(--destructive))]">
        Delete
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Sharing Tab
// ---------------------------------------------------------------------------

function SharingTab({
  surveyId,
  shares,
  isOwner,
}: {
  surveyId: string;
  shares: ShareData[];
  isOwner: boolean;
}) {
  const addFormRef = useRef<HTMLFormElement>(null);

  const boundAddShare = addShareAction.bind(null, surveyId);

  async function handleAddShare(formData: FormData) {
    const result = await boundAddShare(formData);
    if (result && !result.success) {
      alert(result.error);
      return;
    }
    addFormRef.current?.reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Sharing</CardTitle>
        <CardDescription>
          Manage who has access to this evaluation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Share list */}
        {shares.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shares.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={s.role === "EDIT" ? "default" : "secondary"}
                    >
                      {s.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {isOwner && (
                      <RemoveShareButton
                        surveyId={surveyId}
                        shareId={s.id}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
            This evaluation is not shared with anyone yet.
          </p>
        )}

        {/* Add share form */}
        {isOwner && (
          <div className="rounded-lg border p-4">
            <h4 className="mb-3 text-sm font-medium">Add Collaborator</h4>
            <form
              ref={addFormRef}
              action={handleAddShare}
              className="flex items-end gap-3"
            >
              <div className="flex-1 space-y-1">
                <Label htmlFor="share-email">Email</Label>
                <Input
                  id="share-email"
                  name="email"
                  type="email"
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="w-[140px] space-y-1">
                <Label htmlFor="share-role">Role</Label>
                <Select id="share-role" name="role" defaultValue="EDIT">
                  <SelectOption value="VIEW">View</SelectOption>
                  <SelectOption value="EDIT">Edit</SelectOption>
                </Select>
              </div>
              <Button type="submit" size="sm">
                Share
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RemoveShareButton({
  surveyId,
  shareId,
}: {
  surveyId: string;
  shareId: string;
}) {
  const boundRemove = removeShareAction.bind(null, surveyId, shareId);

  async function handleRemove() {
    await boundRemove();
  }

  return (
    <form action={handleRemove}>
      <Button type="submit" variant="ghost" size="sm" className="text-[hsl(var(--destructive))]">
        Remove
      </Button>
    </form>
  );
}
