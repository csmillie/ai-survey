# ModelTrust Landing Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a public landing page at `/` with hero, features, how-it-works, beta signup form (with DB storage), privacy policy at `/privacy`, and SEO metadata.

**Architecture:** Replace the root redirect with a server-rendered landing page. Beta signup uses a client component form (`useActionState`) that calls a server action to validate (Zod) and store signups in a new `BetaSignup` Prisma model. Privacy policy is a static server component. Use the blog-editor skill for all marketing and policy copy.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS + shadcn/ui, Prisma + MySQL, Zod

**Spec:** `docs/superpowers/specs/2026-03-26-landing-page-design.md`

---

### File Structure

**New files:**

| File | Responsibility |
|------|---------------|
| `src/app/page.tsx` | Landing page server component (replaces redirect). Exports SEO metadata. |
| `src/app/beta-signup-form.tsx` | Client component: beta form with useActionState, success/error states |
| `src/app/actions.ts` | Server action: validate with betaSignupSchema, create BetaSignup, log notification |
| `src/app/privacy/page.tsx` | Privacy policy server component with prose layout. Exports metadata. |
| `public/robots.txt` | Allow all crawlers |

**Modified files:**

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add `SignupStatus` enum + `BetaSignup` model |
| `src/lib/schemas.ts` | Add `betaSignupSchema` |
| `src/lib/env.ts` | Add `getBetaNotifyEmail()` |
| `.env.example` | Add `BETA_NOTIFY_EMAIL` |

---

### Task 1: Database — BetaSignup model + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `.env.example`

- [ ] **Step 1: Add SignupStatus enum and BetaSignup model to schema**

Add at the end of `prisma/schema.prisma`:

```prisma
enum SignupStatus {
  PENDING
  INVITED
  ONBOARDED
}

model BetaSignup {
  id        String       @id @default(uuid())
  email     String       @unique
  name      String
  company   String?
  role      String?
  status    SignupStatus  @default(PENDING)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  @@index([status])
}
```

- [ ] **Step 2: Add BETA_NOTIFY_EMAIL to .env.example**

Add to `.env.example`:
```
# Beta signup notification (optional — logs to console if not set)
BETA_NOTIFY_EMAIL=
```

- [ ] **Step 3: Generate migration**

Run: `pnpm prisma:migrate`
Migration name: `add-beta-signup`
Expected: Migration file created in `prisma/migrations/`

- [ ] **Step 4: Generate Prisma client**

Run: `pnpm prisma:generate`
Expected: Prisma client regenerated

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ .env.example
git commit -m "feat: add BetaSignup model with status enum and migration"
```

---

### Task 2: Zod schema + env accessor

**Files:**
- Modify: `src/lib/schemas.ts`
- Modify: `src/lib/env.ts`

- [ ] **Step 1: Add betaSignupSchema to schemas.ts**

Add after the auth schemas section (after `loginSchema`):

```typescript
// ---------------------------------------------------------------------------
// Beta Signup
// ---------------------------------------------------------------------------

export const betaSignupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  company: z.string().max(200).optional(),
  role: z.string().max(100).optional(),
});

export type BetaSignupInput = z.infer<typeof betaSignupSchema>;
```

- [ ] **Step 2: Add getBetaNotifyEmail to env.ts**

Add to `src/lib/env.ts`:

```typescript
export function getBetaNotifyEmail(): string | undefined {
  const val = optionalEnv("BETA_NOTIFY_EMAIL", "");
  return val || undefined;
}
```

- [ ] **Step 3: Run type check**

Run: `pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/schemas.ts src/lib/env.ts
git commit -m "feat: add betaSignupSchema and getBetaNotifyEmail env accessor"
```

---

### Task 3: Server action for beta signup

**Files:**
- Create: `src/app/actions.ts`

- [ ] **Step 1: Create the server action**

```typescript
"use server";

import { prisma } from "@/lib/db";
import { betaSignupSchema } from "@/lib/schemas";
import { getBetaNotifyEmail } from "@/lib/env";

interface BetaSignupState {
  success?: boolean;
  error?: string;
}

export async function betaSignupAction(
  _prevState: BetaSignupState | null,
  formData: FormData,
): Promise<BetaSignupState> {
  const raw = {
    email: formData.get("email"),
    name: formData.get("name"),
    company: formData.get("company") || undefined,
    role: formData.get("role") || undefined,
  };

  const parsed = betaSignupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    await prisma.betaSignup.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        company: parsed.data.company,
        role: parsed.data.role,
      },
    });
  } catch (err) {
    // Unique constraint violation on email
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint")
    ) {
      return { error: "This email is already on the waitlist." };
    }
    return { error: "Something went wrong. Please try again." };
  }

  const notifyEmail = getBetaNotifyEmail();
  if (notifyEmail) {
    console.log(
      `[beta-signup] New signup: ${parsed.data.email} (${parsed.data.name})` +
        ` — notify: ${notifyEmail}`
    );
  }

  return { success: true };
}
```

- [ ] **Step 2: Run type check**

Run: `pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/actions.ts
git commit -m "feat: add beta signup server action with Zod validation"
```

---

### Task 4: Beta signup form (client component)

**Files:**
- Create: `src/app/beta-signup-form.tsx`

- [ ] **Step 1: Create the form component**

Build `src/app/beta-signup-form.tsx` with:
- `"use client"` directive
- `useActionState<BetaSignupState | null, FormData>` with `betaSignupAction`
- Uses shadcn/ui `Input`, `Label`, `Button` components
- Fields: email (required), name (required), company (optional), role (optional)
- Separate `SubmitButton` using `useFormStatus()` for pending state (matching login page pattern)
- **Success state:** form replaced with a centered confirmation: "You're on the list. We'll be in touch."
- **Error state:** red text above submit button showing `state.error`
- Dark theme styling: zinc-900 card background, zinc-50 text, zinc-800 borders
- Form has `id="beta"` so the hero CTA can smooth-scroll to it

- [ ] **Step 2: Run type check**

Run: `pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/beta-signup-form.tsx
git commit -m "feat: add beta signup form with useActionState"
```

---

### Task 5: Landing page

This is the main page. Use the blog-editor skill for all marketing copy.

**Files:**
- Create: `src/app/page.tsx` (replace existing redirect)

- [ ] **Step 1: Create the landing page**

Build `src/app/page.tsx` as a server component with:

**Metadata export:**
```typescript
export const metadata: Metadata = {
  title: "ModelTrust — AI Model Evaluation & Trust Scoring",
  description: "Compare AI model outputs, measure reliability, detect disagreement, and know when human review is needed. Request beta access today.",
  openGraph: {
    title: "ModelTrust — AI Model Evaluation & Trust Scoring",
    description: "Compare AI model outputs, measure reliability, detect disagreement, and know when human review is needed.",
    type: "website",
    url: "https://modeltrust.ai",
  },
  twitter: {
    card: "summary",
    title: "ModelTrust — AI Model Evaluation & Trust Scoring",
    description: "Compare AI model outputs, measure reliability, detect disagreement, and know when human review is needed.",
  },
  alternates: {
    canonical: "https://modeltrust.ai",
  },
};
```

**Layout structure (all in one file, semantic HTML):**

```
<div className="min-h-screen bg-zinc-950 text-zinc-50">
  <header> — sticky nav bar
  <main>
    <section id="hero"> — headline, subtext, CTA button (href="#beta")
    <section id="features"> — 4 feature cards in responsive grid
    <section id="how-it-works"> — 3 steps with arrows
    <section id="beta"> — heading + <BetaSignupForm />
  </main>
  <footer> — copyright, privacy link, login link
</div>
```

**Nav bar:**
- Sticky: `sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-800`
- Left: "ModelTrust" in `text-lg font-bold`
- Right: anchor links "Features" and "How It Works", "Log In" button (Link to `/login`)

**Hero section:**
- Centered text
- `<h1>` headline: bold, large (`text-5xl sm:text-6xl font-bold tracking-tight`)
- Subtext: `text-lg text-zinc-400 max-w-2xl mx-auto`
- CTA: `<a href="#beta">` styled as white button

**Features section:**
- `<h2>` "Features"
- 4 cards: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6`
- Each card: zinc-900 bg, rounded-lg, p-6, border zinc-800
  1. Multi-Model Evaluation
  2. Benchmark Question Types
  3. Cost & Token Tracking
  4. Side-by-Side Comparison

**How It Works section:**
- `<h2>` "How It Works"
- 3 steps in a flex row (vertical on mobile): number circle, title, description
- Arrow connectors between steps (hidden on mobile)

**Beta section:**
- `<h2>` + subtext
- `<BetaSignupForm />` client component

**Footer:**
- `border-t border-zinc-800`
- Copyright, "Privacy Policy" link to `/privacy`, "Log In" link to `/login`

**Copy:** Use the blog-editor skill to write compelling, concise copy for the headline, subtext, feature descriptions, and how-it-works steps.

- [ ] **Step 2: Run type check and lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add landing page with hero, features, how-it-works, and beta signup"
```

---

### Task 6: Privacy policy page

Use the blog-editor skill for clear, professional privacy policy copy.

**Files:**
- Create: `src/app/privacy/page.tsx`

- [ ] **Step 1: Create the privacy policy page**

Build `src/app/privacy/page.tsx` as a server component with:

**Metadata:**
```typescript
export const metadata: Metadata = {
  title: "Privacy Policy — ModelTrust",
  description: "How ModelTrust collects, uses, and protects your data.",
};
```

**Layout:**
- Same dark theme (zinc-950 bg)
- Nav bar: "ModelTrust" wordmark (link to `/`) + "Back to home" link
- Centered prose container: `max-w-3xl mx-auto px-6 py-16`
- `<h1>` "Privacy Policy"
- Last updated date below heading
- Sections with `<h2>`: Analytics, Beta Program, Accounts & Usage Data, Data Sharing, Contact
- Footer: same as landing page

**Content:** Follow the spec's Section 4 content outlines. Use blog-editor skill to write the prose. Contact email: `privacy@modeltrust.ai` (hardcoded).

- [ ] **Step 2: Run type check and lint**

Run: `pnpm tsc --noEmit && pnpm lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/privacy/page.tsx
git commit -m "feat: add privacy policy page"
```

---

### Task 7: robots.txt + final verification

**Files:**
- Create: `public/robots.txt`

- [ ] **Step 1: Create robots.txt**

```
User-agent: *
Allow: /

Sitemap: https://modeltrust.ai/sitemap.xml
```

- [ ] **Step 2: Run all checks**

Run: `pnpm lint && pnpm tsc --noEmit && pnpm test`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add public/robots.txt
git commit -m "feat: add robots.txt allowing all crawlers"
```

---

### Task 8: Manual testing

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`

- [ ] **Step 2: Test landing page**

Navigate to `http://localhost:3088`:
- Verify dark theme, sticky nav, hero with CTA button
- Click "Features" / "How It Works" anchor links — verify smooth scroll
- Verify 4 feature cards render in grid
- Verify 3 how-it-works steps
- Verify "Log In" links to `/login`

- [ ] **Step 3: Test beta signup**

- Fill in all fields, submit — verify success message
- Try submitting same email again — verify "already on the waitlist" error
- Try submitting with empty email/name — verify validation error
- Check console for `[beta-signup]` notification log

- [ ] **Step 4: Test privacy policy**

Navigate to `/privacy`:
- Verify all sections render
- Verify "Back to home" links to `/`
- Verify footer links work

- [ ] **Step 5: Test responsive**

Resize browser to mobile width:
- Feature grid collapses to single column
- How It Works stacks vertically
- Nav links collapse gracefully
- Beta form is full width

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: polish landing page based on manual testing"
```
