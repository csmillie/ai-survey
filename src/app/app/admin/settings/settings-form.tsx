"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { updateSettingAction } from "./actions";

interface ActionResult {
  success: boolean;
  error?: string;
}

function SubmitButton(): React.ReactElement {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving..." : "Save"}
    </Button>
  );
}

interface SettingRowProps {
  settingKey: string;
  value: string;
}

export function SettingRow({
  settingKey,
  value,
}: SettingRowProps): React.ReactElement {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    updateSettingAction,
    null
  );

  return (
    <Card>
      <form action={action}>
        <CardHeader>
          <CardTitle className="text-base font-mono">{settingKey}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {state?.error && (
            <div className="rounded-md bg-[hsl(var(--destructive))]/10 px-3 py-2 text-sm text-[hsl(var(--destructive))]">
              {state.error}
            </div>
          )}
          {state?.success && (
            <div className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              Saved.
            </div>
          )}
          <input type="hidden" name="key" value={settingKey} />
          <div className="space-y-2">
            <Label htmlFor={`setting-${settingKey}`}>Value</Label>
            <Input
              id={`setting-${settingKey}`}
              name="value"
              defaultValue={value}
            />
          </div>
        </CardContent>
        <CardFooter>
          <SubmitButton />
        </CardFooter>
      </form>
    </Card>
  );
}

export function NewSettingForm(): React.ReactElement {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    updateSettingAction,
    null
  );

  return (
    <Card>
      <form action={action}>
        <CardHeader>
          <CardTitle>Add Setting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {state?.error && (
            <div className="rounded-md bg-[hsl(var(--destructive))]/10 px-3 py-2 text-sm text-[hsl(var(--destructive))]">
              {state.error}
            </div>
          )}
          {state?.success && (
            <div className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              Setting saved.
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-setting-key">Key</Label>
              <Input
                id="new-setting-key"
                name="key"
                required
                placeholder="setting.key"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-setting-value">Value</Label>
              <Input
                id="new-setting-value"
                name="value"
                required
                placeholder="value"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <SubmitButton />
        </CardFooter>
      </form>
    </Card>
  );
}
