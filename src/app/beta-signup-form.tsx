"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { betaSignupAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BetaSignupState {
  success?: boolean;
  error?: string;
}

function SubmitButton(): React.ReactElement {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className="w-full bg-white text-zinc-900 hover:bg-zinc-200"
      disabled={pending}
    >
      {pending ? "Joining..." : "Request beta access"}
    </Button>
  );
}

const inputClassName =
  "bg-zinc-900 border-zinc-800 text-zinc-50 placeholder:text-zinc-500 focus-visible:ring-zinc-600";

export default function BetaSignupForm(): React.ReactElement {
  const [state, formAction] = useActionState<BetaSignupState | null, FormData>(
    betaSignupAction,
    null,
  );

  if (state?.success) {
    return (
      <div
        id="beta"
        className="bg-zinc-900 rounded-lg border border-zinc-800 p-8 max-w-xl mx-auto text-center"
      >
        <p className="text-xl font-semibold text-zinc-50">
          You&apos;re on the list.
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          We&apos;ll be in touch when beta access is available.
        </p>
      </div>
    );
  }

  return (
    <div
      id="beta"
      className="bg-zinc-900 rounded-lg border border-zinc-800 p-8 max-w-xl mx-auto"
    >
      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-zinc-300">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              required
              className={inputClassName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name" className="text-zinc-300">
              Name
            </Label>
            <Input
              id="name"
              name="name"
              placeholder="Your name"
              autoComplete="name"
              required
              className={inputClassName}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="company" className="text-zinc-300">
              Company
            </Label>
            <Input
              id="company"
              name="company"
              placeholder="Company (optional)"
              autoComplete="organization"
              className={inputClassName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role" className="text-zinc-300">
              Role
            </Label>
            <Input
              id="role"
              name="role"
              placeholder="Role (optional)"
              autoComplete="organization-title"
              className={inputClassName}
            />
          </div>
        </div>

        {state?.error && (
          <p className="text-sm text-red-400">{state.error}</p>
        )}

        <SubmitButton />
      </form>
    </div>
  );
}
