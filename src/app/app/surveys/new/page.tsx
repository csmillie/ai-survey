import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createSurveyAction } from "@/app/app/surveys/actions";
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

export default async function NewSurveyPage() {
  await requireSession();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/app/surveys"
          className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          &larr; Back to Surveys
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Survey</CardTitle>
          <CardDescription>
            Create a new AI survey. You can add questions, variables, and
            configure sharing after creation.
          </CardDescription>
        </CardHeader>
        <form action={createSurveyAction as unknown as (formData: FormData) => void}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                placeholder="Enter survey title"
                required
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Optional description of your survey"
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
            <Button type="submit">Create Survey</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
