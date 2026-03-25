"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { importSurveyAction } from "./actions";

export function ImportSurveyButton() {
  const [open, setOpen] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [jsonContent, setJsonContent] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] = useActionState(importSurveyAction, null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileError(null);
    setJsonContent("");

    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setFileError("Please select a .json file");
      return;
    }

    if (file.size > 1_000_000) {
      setFileError("File too large (max 1 MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== "string") {
        setFileError("Could not read file");
        return;
      }

      try {
        JSON.parse(text);
        setJsonContent(text);
        setFileError(null);
      } catch {
        setFileError("File does not contain valid JSON");
      }
    };
    reader.readAsText(file);
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setFileError(null);
      setJsonContent("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const serverError = state?.error;
  const hasFile = jsonContent.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button variant="outline" onClick={() => setOpen(true)}>Import JSON</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Evaluation from JSON</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Upload a benchmark survey JSON file to create a new evaluation with
              all questions pre-configured.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="block w-full text-sm file:mr-4 file:rounded file:border-0 file:bg-[hsl(var(--primary))] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[hsl(var(--primary-foreground))] hover:file:opacity-80"
              aria-label="Select survey JSON file"
            />
            {fileError && (
              <p className="text-sm text-[hsl(var(--destructive))]">{fileError}</p>
            )}
            {serverError && (
              <p className="text-sm text-[hsl(var(--destructive))]">{serverError}</p>
            )}
            {hasFile && !fileError && (
              <p className="text-sm text-green-600 dark:text-green-400">
                File loaded. Ready to import.
              </p>
            )}
          </div>

          <input type="hidden" name="json" value={jsonContent} />

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!hasFile || !!fileError || isPending}
            >
              {isPending ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
