import type { Metadata } from "next";
import Link from "next/link";
import BetaSignupForm from "@/app/beta-signup-form";

export const metadata: Metadata = {
  title: "ModelTrust: AI Model Evaluation & Trust Scoring",
  description:
    "Compare AI model outputs, measure reliability, detect disagreement, and know when human review is needed.",
  openGraph: {
    title: "ModelTrust: AI Model Evaluation & Trust Scoring",
    description:
      "Compare AI model outputs, measure reliability, detect disagreement, and know when human review is needed.",
    type: "website",
    url: "https://modeltrust.app",
  },
  twitter: {
    card: "summary",
    title: "ModelTrust: AI Model Evaluation & Trust Scoring",
    description:
      "Compare AI model outputs, measure reliability, detect disagreement, and know when human review is needed.",
  },
  alternates: {
    canonical: "https://modeltrust.app",
  },
};

export default function HomePage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-lg font-bold">ModelTrust</span>
          <div className="flex items-center gap-6">
            <a
              href="#features"
              className="text-sm text-zinc-400 hover:text-zinc-50"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm text-zinc-400 hover:text-zinc-50"
            >
              How It Works
            </a>
            <Link
              href="/login"
              className="text-sm px-4 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700"
            >
              Log In
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section id="hero" className="py-24 sm:py-32">
          <div className="max-w-3xl mx-auto text-center px-6">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
              Which AI model can you actually trust?
            </h1>
            <p className="mt-6 text-lg text-zinc-400 max-w-2xl mx-auto">
              Run the same questions across multiple AI models. See where they
              agree, where they diverge, and decide which one earns your
              confidence.
            </p>
            <a
              href="#beta"
              className="mt-8 inline-block px-8 py-3 rounded-md bg-zinc-50 text-zinc-950 font-medium hover:bg-zinc-200 transition-colors"
            >
              Request Beta Access
            </a>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 border-t border-zinc-800">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
                <h3 className="text-lg font-semibold mb-2">
                  Multi-Model Evaluation
                </h3>
                <p className="text-sm text-zinc-400">
                  Run the same questions across GPT-4, Claude, Gemini, and
                  others. See how each model handles your specific use case.
                </p>
              </div>
              <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
                <h3 className="text-lg font-semibold mb-2">
                  Benchmark Question Types
                </h3>
                <p className="text-sm text-zinc-400">
                  Structured evaluations with Likert scales, binary choices,
                  forced comparisons, and more. Not just vibes, real data.
                </p>
              </div>
              <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
                <h3 className="text-lg font-semibold mb-2">
                  Cost & Token Tracking
                </h3>
                <p className="text-sm text-zinc-400">
                  See exactly what each model costs per question. Compare
                  quality against price to find the best value.
                </p>
              </div>
              <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
                <h3 className="text-lg font-semibold mb-2">
                  Side-by-Side Comparison
                </h3>
                <p className="text-sm text-zinc-400">
                  Put model outputs next to each other. Spot differences,
                  measure divergence, and identify which models agree.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-24 border-t border-zinc-800">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-12">
              How It Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-0 max-w-4xl mx-auto items-start">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold mx-auto mb-4">
                  1
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Create an Evaluation
                </h3>
                <p className="text-sm text-zinc-400">
                  Define the questions you want to test. Pick from structured
                  question types or write open-ended prompts.
                </p>
              </div>

              <div className="hidden md:flex items-center justify-center pt-3">
                <span className="text-zinc-600 text-2xl" aria-hidden="true">
                  →
                </span>
              </div>

              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold mx-auto mb-4">
                  2
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Select Your Models
                </h3>
                <p className="text-sm text-zinc-400">
                  Choose which AI models to evaluate. Run them all against the
                  same questions simultaneously.
                </p>
              </div>

              <div className="hidden md:flex items-center justify-center pt-3">
                <span className="text-zinc-600 text-2xl" aria-hidden="true">
                  →
                </span>
              </div>

              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold mx-auto mb-4">
                  3
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Analyze the Results
                </h3>
                <p className="text-sm text-zinc-400">
                  Compare outputs, review reliability scores, and identify where
                  models disagree. Know when to trust the answer.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Beta Signup */}
        <section id="beta" className="py-24 border-t border-zinc-800">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-4">
              Get Early Access
            </h2>
            <p className="text-center text-zinc-400 mb-8 max-w-lg mx-auto">
              ModelTrust is in private beta. Sign up to be among the first to
              evaluate AI models with confidence.
            </p>
            <BetaSignupForm />
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-zinc-500">
            © 2026 ModelTrust. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="text-sm text-zinc-400 hover:text-zinc-50"
            >
              Privacy Policy
            </Link>
            <Link
              href="/login"
              className="text-sm text-zinc-400 hover:text-zinc-50"
            >
              Log In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
