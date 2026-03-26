# ModelTrust Landing Page & Privacy Policy

**Date:** 2026-03-26
**Status:** Approved
**Goal:** Create a public landing page at `/` describing ModelTrust's value proposition, a beta signup form with database storage and email notification, and a privacy policy at `/privacy`.

---

## 1. Page Structure & Route

Replace the current `src/app/page.tsx` redirect with a public landing page. Route: `/`. No authentication required — middleware only guards `/app/*`.

**Dark theme** throughout: zinc-950 background, zinc-50 text, matching the existing dark mode palette. Minimal and clean — typography-driven, generous whitespace, Inter font (already loaded).

### Sections (single-page scroll):

1. **Nav bar** — "ModelTrust" wordmark (left), anchor links "Features" and "How It Works" (center-right), "Log In" button linking to `/login` (right). Sticky on scroll with static border-bottom.
2. **Hero** — centered headline, subheading, primary CTA button "Request Beta Access" (smooth-scrolls to signup form).
3. **Features** — 4 cards in a row: Multi-Model Evaluation, Benchmark Question Types, Cost & Token Tracking, Side-by-Side Comparison. Each card: title, 1-2 sentence description.
4. **How It Works** — 3 steps in a horizontal flow: Create Evaluation → Select Models → Analyze Results. Each step: number, title, short description. Connected by arrow/line indicators.
5. **Beta Signup Form** — heading, subtext, form fields (email, name, company, role), submit button. Success/error states.
6. **Footer** — copyright, "Privacy Policy" link to `/privacy`, "Log In" link to `/login`.

### SEO & Crawlability

- Server component — full HTML rendered server-side, no client JS required for content
- Metadata export: title ("ModelTrust — AI Model Evaluation & Trust Scoring"), description, Open Graph tags (og:title, og:description, og:type, og:url), Twitter card tags (twitter:card, twitter:title, twitter:description)
- `og:image` and `twitter:image` are out of scope for v1 — no OG image asset exists yet. Can be added later as `public/og-image.png` (recommended 1200x630px).
- Semantic HTML: `<header>`, `<main>`, `<section>` with ids for anchor links, `<footer>`
- Single `<h1>` (hero headline), `<h2>` for section titles
- `public/robots.txt` allowing all crawlers
- Canonical URL via metadata

## 2. Component Architecture

### New files

| File | Type | Purpose |
|------|------|---------|
| `src/app/page.tsx` | Server component | Landing page — replaces redirect. Renders all sections. Exports metadata. |
| `src/app/privacy/page.tsx` | Server component | Privacy policy prose page. Exports metadata. |
| `src/app/beta-signup-form.tsx` | Client component | Beta form with useActionState, success/error states. |
| `src/app/actions.ts` | Server action | Validate input (via betaSignupSchema from @/lib/schemas), store BetaSignup, log notification. |
| `public/robots.txt` | Static file | Allow all crawlers. |

### Modified files

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add `SignupStatus` enum and `BetaSignup` model |
| `prisma/migrations/` | New migration for BetaSignup table (via `pnpm prisma:migrate`) |
| `src/lib/schemas.ts` | Add `betaSignupSchema` Zod schema |
| `src/lib/env.ts` | Add `getBetaNotifyEmail()` optional accessor |
| `.env.example` | Add `BETA_NOTIFY_EMAIL` variable |

### What stays unchanged

- `src/app/layout.tsx` — root layout already has Inter font, dark mode script, base metadata
- `src/middleware.ts` — already only guards `/app/*`
- `src/app/login/page.tsx` — untouched

## 3. Beta Signup — Database & Server Action

### Prisma model

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

### Zod schema (in `src/lib/schemas.ts`)

```typescript
export const betaSignupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  company: z.string().max(200).optional(),
  role: z.string().max(100).optional(),
});
```

### Env accessor (in `src/lib/env.ts`)

```typescript
export function getBetaNotifyEmail(): string | undefined {
  const val = optionalEnv("BETA_NOTIFY_EMAIL");
  return val || undefined;
}
```

### Server action (`src/app/actions.ts`)

- `"use server"` directive
- Imports `betaSignupSchema` from `@/lib/schemas`
- Imports `getBetaNotifyEmail` from `@/lib/env`
- Validates input with `betaSignupSchema.safeParse()`
- Creates `BetaSignup` row via Prisma
- Catches unique constraint on email — returns `{ success: false, error: "This email is already on the waitlist." }`
- Sends notification: if `getBetaNotifyEmail()` returns a value, logs to console for v1 (hook point for Resend/SendGrid/SES later)
- Returns `{ success: true }` or `{ success: false, error: string }`

### Form component (`src/app/beta-signup-form.tsx`)

- `"use client"` with `useActionState` (same pattern as login page)
- Fields: email (required), name (required), company (optional), role (optional)
- Submit button with loading/disabled state via `useFormStatus` or pending state
- **Default state:** form visible
- **Success state:** form replaced with confirmation message ("You're on the list. We'll be in touch.")
- **Error state:** inline red error text above submit button
- All inputs use existing shadcn/ui `Input` and `Label` components
- Validation is server-side only (matching the login page pattern). No client-side Zod import — avoids bundling Zod into the client and keeps the pattern consistent.

## 4. Privacy Policy

Route: `/privacy`. Server component. Same dark theme as landing page.

**Layout:** Nav bar (ModelTrust wordmark + "Back to home" link), prose content in a centered max-width container (~prose width), footer.

**Last updated date** displayed at the top.

### Content sections:

**Google Analytics** (already implemented in `src/app/layout.tsx` via PR #58)
- ModelTrust uses Google Analytics 4 (measurement ID: G-04WT0TYQDD) to understand how visitors use the site
- Data collected: pages visited, interaction events (evaluation creation, question type selection), browser type, device information, approximate location
- IP addresses are anonymized by Google Analytics
- Data is processed by Google under their privacy policy
- Users can opt out via browser settings or Google's opt-out browser add-on

**Beta Program**
- When you sign up for beta access, we collect your email address, name, and optionally your company and role
- This information is used solely to manage the beta waitlist and communicate about product access
- We store this data in our database and do not share it with third parties
- You can request removal of your beta signup data by contacting us

**Accounts & Usage Data**
- When you create an account, we collect your email address, name, and password
- Passwords are hashed using bcrypt and never stored in plain text
- We store evaluation data, question configurations, and model responses that you create through the platform
- Authentication uses secure httpOnly JWT cookies
- For security, we log login attempts including IP address and user agent in our audit system

**Data Sharing**
- We do not sell personal data
- We do not share personal data with third parties except as required to operate the service (Google Analytics) or as required by law

**Contact**
- For privacy questions or data removal requests, email: privacy@modeltrust.ai (hardcoded in the page — no env var needed for a static page)

### Copy quality

Use the blog-editor skill during implementation to ensure the privacy policy copy is clear, concise, and professionally written. Same for all landing page marketing copy (hero, features, how it works).

## 5. Visual Design Details

### Color palette (dark theme)

- Background: `zinc-950` (#09090b)
- Surface/cards: `zinc-900` (#18181b)
- Borders: `zinc-800` (#27272a)
- Primary text: `zinc-50` (#fafafa)
- Secondary text: `zinc-400` (#a1a1aa)
- Muted text: `zinc-500` (#71717a)
- CTA button: white background (#fafafa), dark text (#09090b)
- CTA hover: `zinc-200`

### Typography

- Hero headline: `text-5xl sm:text-6xl font-bold tracking-tight`
- Section headings: `text-3xl font-bold`
- Body: `text-lg` for hero subtext, `text-base` elsewhere
- All Inter font (already loaded in root layout)

### Spacing

- Sections separated by `py-24` or `py-32`
- Max content width: `max-w-6xl mx-auto px-6`
- Feature cards: `gap-6` in a responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`)

### Nav bar

- Sticky: `sticky top-0 z-40`
- Background with blur: `bg-zinc-950/80 backdrop-blur-sm`
- Always show a subtle `border-b border-zinc-800` — no scroll detection needed. Keeps the nav as a server component.

### Responsive

- Hero stacks naturally (centered text)
- Feature grid: 1 column on mobile, 2 on tablet, 4 on desktop
- How It Works: horizontal on desktop, vertical stack on mobile
- Beta form: single column, full width on mobile

## 6. Out of Scope

- Email transport implementation (console.log placeholder for v1; hook point for Resend/SES later)
- Admin interface for managing beta signups (query DB directly for now)
- A/B testing or analytics event tracking on the landing page
- Animated transitions or scroll-triggered effects
- Blog or additional marketing pages
- Cookie consent banner (can be added later if required by jurisdiction)
