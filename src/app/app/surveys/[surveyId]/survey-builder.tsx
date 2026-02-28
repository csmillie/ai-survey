"use client";

import Link from "next/link";
import { useRef, useState } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
}

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
  succeededJobs: number;
  totalJobs: number;
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
        <TabsList>
          <TabsTrigger value="questions">
            Questions ({questions.length})
          </TabsTrigger>
          <TabsTrigger value="variables">
            Variables ({variables.length})
          </TabsTrigger>
          <TabsTrigger value="sharing">
            Sharing ({shares.length})
          </TabsTrigger>
        </TabsList>

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
            <CardTitle className="text-xl">Results</CardTitle>
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
                  <TableHead className="text-right">Jobs</TableHead>
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
                    <TableCell className="text-sm text-[hsl(var(--muted-foreground))]">
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
                      {run.succeededJobs}/{run.totalJobs}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/app/runs/${run.id}`}
                        className="text-sm font-medium text-[hsl(var(--primary))] hover:underline"
                      >
                        Results
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
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

  const boundAddQuestion = addQuestionAction.bind(null, surveyId);

  async function handleAddQuestion(formData: FormData) {
    const result = await boundAddQuestion(formData);
    if (result && !result.success) {
      alert(result.error);
      return;
    }
    addFormRef.current?.reset();
    setAddDialogOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-xl">Questions</CardTitle>
          <CardDescription>
            Define the questions that will be sent to AI models.
          </CardDescription>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger>
            <Button size="sm">Add Question</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Question</DialogTitle>
            </DialogHeader>
            <form ref={addFormRef} action={handleAddQuestion} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="q-prompt">Question</Label>
                <Textarea
                  id="q-prompt"
                  name="promptTemplate"
                  placeholder="e.g., What do you think about {{brand}}?"
                  rows={4}
                  required
                />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Use {"{{variable_name}}"} syntax for variable substitution.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-mode">Mode</Label>
                <Select id="q-mode" name="mode" defaultValue="STATELESS">
                  <SelectOption value="STATELESS">Stateless</SelectOption>
                  <SelectOption value="THREADED">Threaded</SelectOption>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-threadKey">Thread Key (optional)</Label>
                <Input
                  id="q-threadKey"
                  name="threadKey"
                  placeholder="e.g., main-thread"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Add Question</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {questions.length === 0 ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No questions yet. Add your first question to get started.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Prompt Preview</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((q) =>
                editingId === q.id ? (
                  <QuestionEditRow
                    key={q.id}
                    surveyId={surveyId}
                    question={q}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <TableRow key={q.id}>
                    <TableCell className="text-[hsl(var(--muted-foreground))]">
                      {q.order + 1}
                    </TableCell>
                    <TableCell className="font-medium">{q.title}</TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">
                        {q.promptTemplate}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          q.mode === "THREADED" ? "default" : "secondary"
                        }
                      >
                        {q.mode}
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
  onDone,
}: {
  surveyId: string;
  question: QuestionData;
  onDone: () => void;
}) {
  const boundUpdate = updateQuestionAction.bind(null, surveyId, question.id);

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
      <TableCell colSpan={5}>
        <form action={handleSubmit} className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor={`edit-q-title-${question.id}`}>Title</Label>
              <Input
                id={`edit-q-title-${question.id}`}
                name="title"
                defaultValue={question.title}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`edit-q-mode-${question.id}`}>Mode</Label>
              <Select
                id={`edit-q-mode-${question.id}`}
                name="mode"
                defaultValue={question.mode}
              >
                <SelectOption value="STATELESS">Stateless</SelectOption>
                <SelectOption value="THREADED">Threaded</SelectOption>
              </Select>
            </div>
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
          <div className="space-y-1">
            <Label htmlFor={`edit-q-threadKey-${question.id}`}>
              Thread Key
            </Label>
            <Input
              id={`edit-q-threadKey-${question.id}`}
              name="threadKey"
              defaultValue={question.threadKey ?? ""}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save
            </Button>
          </div>
        </form>
      </TableCell>
    </TableRow>
  );
}

function DeleteQuestionButton({
  surveyId,
  questionId,
}: {
  surveyId: string;
  questionId: string;
}) {
  const boundDelete = deleteQuestionAction.bind(null, surveyId, questionId);

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
          Manage who has access to this survey.
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
            This survey is not shared with anyone yet.
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
