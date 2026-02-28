"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { createUserAction } from "./actions";

interface ActionResult {
  success: boolean;
  error?: string;
}

function SubmitButton(): React.ReactElement {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating..." : "Create User"}
    </Button>
  );
}

export function CreateUserForm(): React.ReactElement {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    createUserAction,
    null
  );

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create User</CardTitle>
        <CardDescription>Add a new user to the platform.</CardDescription>
      </CardHeader>
      <form ref={formRef} action={action}>
        <CardContent className="space-y-4">
          {state?.error && (
            <div className="rounded-md bg-[hsl(var(--destructive))]/10 px-3 py-2 text-sm text-[hsl(var(--destructive))]">
              {state.error}
            </div>
          )}
          {state?.success && (
            <div className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              User created successfully.
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                name="email"
                type="email"
                required
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Temporary Password</Label>
              <Input
                id="create-password"
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="Min 8 characters"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Name (optional)</Label>
              <Input
                id="create-name"
                name="name"
                type="text"
                placeholder="Display name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role">Role</Label>
              <Select id="create-role" name="role" defaultValue="USER">
                <SelectOption value="USER">User</SelectOption>
                <SelectOption value="ADMIN">Admin</SelectOption>
              </Select>
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
