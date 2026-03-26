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
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { rankedConfigSchema } from "@/lib/schemas";
import { deleteSurveyAction } from "@/app/app/surveys/actions";
import {
  updateSurveyAction,
  deleteQuestionAction,
  addVariableAction,
  updateVariableAction,
  deleteVariableAction,
  addShareAction,
  removeShareAction,
} from "./actions";
import { QuestionDialog } from "@/app/app/surveys/[surveyId]/question-dialog";
import type { QuestionData } from "@/app/app/surveys/[surveyId]/question-presets";
import { QUESTION_TYPE_LABELS } from "@/app/app/surveys/[surveyId]/question-presets";

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
  const [editQuestion, setEditQuestion] = useState<QuestionData | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-xl">Decision Prompts</CardTitle>
          <CardDescription>
            Define the prompts that will be sent to AI models.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
          Add Prompt
        </Button>
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
              {questions.map((q, qIdx) => (
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
                        onClick={() => setEditQuestion(q)}
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
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <QuestionDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        surveyId={surveyId}
        existingQuestions={questions}
      />
      <QuestionDialog
        open={!!editQuestion}
        onOpenChange={(open) => { if (!open) setEditQuestion(null); }}
        surveyId={surveyId}
        existingQuestions={questions}
        editQuestion={editQuestion ?? undefined}
      />
    </Card>
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
