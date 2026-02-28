"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  updateProfileAction,
  changePasswordAction,
  disableAccountAction,
} from "./actions";
import { ThemeToggle } from "./theme-toggle";

interface ActionResult {
  success: boolean;
  error?: string;
}

interface SettingsFormProps {
  name: string | null;
  email: string;
}

function SubmitButton({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "destructive" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? "Saving..." : children}
    </Button>
  );
}

function StatusMessage({ state }: { state: ActionResult | null }) {
  if (!state) return null;

  if (state.error) {
    return (
      <div className="rounded-md bg-[hsl(var(--destructive))]/10 px-3 py-2 text-sm text-[hsl(var(--destructive))]">
        {state.error}
      </div>
    );
  }

  if (state.success) {
    return (
      <div className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
        Saved successfully.
      </div>
    );
  }

  return null;
}

export function SettingsForm({ name, email }: SettingsFormProps): React.ReactElement {
  const [profileState, profileAction] = useActionState<ActionResult | null, FormData>(
    updateProfileAction,
    null
  );

  const [passwordState, passwordAction] = useActionState<ActionResult | null, FormData>(
    changePasswordAction,
    null
  );

  const [disableState, disableAction] = useActionState<ActionResult | null, FormData>(
    disableAccountAction,
    null
  );

  const passwordFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (passwordState?.success) {
      passwordFormRef.current?.reset();
    }
  }, [passwordState]);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your display name.</CardDescription>
        </CardHeader>
        <form action={profileAction}>
          <CardContent className="space-y-4">
            <StatusMessage state={profileState} />
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                defaultValue={name ?? ""}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-display">Email</Label>
              <Input
                id="email-display"
                type="email"
                value={email}
                disabled
                className="opacity-60"
              />
            </div>
          </CardContent>
          <CardFooter>
            <SubmitButton>Save Profile</SubmitButton>
          </CardFooter>
        </form>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your password. Must be at least 8 characters.</CardDescription>
        </CardHeader>
        <form ref={passwordFormRef} action={passwordAction}>
          <CardContent className="space-y-4">
            <StatusMessage state={passwordState} />
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          </CardContent>
          <CardFooter>
            <SubmitButton>Change Password</SubmitButton>
          </CardFooter>
        </form>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose your preferred theme.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      {/* Disable Account */}
      <Card className="border-[hsl(var(--destructive))]/30">
        <CardHeader>
          <CardTitle>Disable Account</CardTitle>
          <CardDescription>
            Once disabled, you will be logged out and unable to sign in. This cannot be undone from the UI.
          </CardDescription>
        </CardHeader>
        <form
          action={disableAction}
          onSubmit={(e) => {
            if (!window.confirm("Are you sure you want to disable your account? This cannot be undone from the UI.")) {
              e.preventDefault();
            }
          }}
        >
          <CardContent className="space-y-4">
            <StatusMessage state={disableState} />
            <div className="space-y-2">
              <Label htmlFor="disablePassword">Confirm Password</Label>
              <Input
                id="disablePassword"
                name="confirmPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
          </CardContent>
          <CardFooter>
            <SubmitButton variant="destructive">Disable Account</SubmitButton>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
