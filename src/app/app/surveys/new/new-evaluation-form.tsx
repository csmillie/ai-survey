"use client";

import { useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { createSurveyAction } from "@/app/app/surveys/actions";
import { trackEvaluationCreated } from "@/lib/analytics";

export function NewEvaluationForm(): React.ReactElement {
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData): Promise<void> {
    const result = await createSurveyAction(formData);
    if (result?.error) {
      alert(result.error);
      return;
    }
    // If we reach here without a redirect, the creation succeeded
    trackEvaluationCreated();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Evaluation</CardTitle>
        <CardDescription>
          Create a new evaluation. You can add decision prompts, variables,
          and configure sharing after creation.
        </CardDescription>
      </CardHeader>
      <form ref={formRef} action={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              placeholder="Enter evaluation title"
              required
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Optional description of your evaluation"
              rows={3}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Link href="/app/surveys">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
          <Button type="submit">Create Evaluation</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
