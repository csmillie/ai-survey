import type { Metadata } from "next";
import Link from "next/link";
import BetaSignupForm from "@/app/beta-signup-form";

// ---------------------------------------------------------------------------
// FAQ content (visible on page + used in FAQPage schema)
// ---------------------------------------------------------------------------

const FAQ_ITEMS = [
  {
    question: "What is ModelTrust?",
    answer:
      "ModelTrust is an AI model evaluation platform that lets you run structured questions across multiple language models, compare their outputs, and measure reliability. It helps teams decide which model to trust for specific use cases.",
  },
  {
    question: "How does ModelTrust compare models?",
    answer:
      "You create an evaluation with questions, select the models you want to test, and run them all simultaneously. ModelTrust collects responses, calculates agreement scores, flags disagreements, and identifies when outputs need human review.",
  },
  {
    question: "What models does ModelTrust support?",
    answer:
      "ModelTrust supports OpenAI (GPT-4, GPT-4o), Anthropic (Claude), Google (Gemini), and xAI (Grok). New providers can be added through the adapter system.",
  },
  {
    question: "What is AI model evaluation?",
    answer:
      "AI model evaluation is the process of systematically testing language models against defined questions to measure accuracy, consistency, and reliability. Instead of relying on general benchmarks, ModelTrust lets you test models against your own questions and criteria.",
  },
  {
    question: "What is a trust score?",
    answer:
      "A trust score is a quantified reliability metric calculated from a model's performance across an evaluation. It factors in response consistency, JSON validity rates, calibration accuracy, and agreement with other models. Higher scores indicate more reliable outputs for your specific use case.",
  },
  {
    question: "How much does ModelTrust cost?",
    answer:
      "ModelTrust is currently in private beta and free to use during the beta period. You only pay for the API costs of the models you evaluate (using your own API keys). Pricing for the hosted service will be announced when we launch publicly.",
  },
  {
    question: "Who built ModelTrust?",
    answer:
      "ModelTrust is built by Idea Warehouse, a software company founded by Colin Smillie. Colin is a software engineer and entrepreneur focused on building tools that help teams make better decisions with AI.",
  },
];

// ---------------------------------------------------------------------------
// JSON-LD structured data
// ---------------------------------------------------------------------------

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://modeltrust.app/#website",
      url: "https://modeltrust.app",
      name: "ModelTrust",
      description:
        "AI model evaluation and trust scoring platform. Compare outputs across models, measure reliability, and know when to trust the answer.",
      publisher: {
        "@id": "https://modeltrust.app/#organization",
      },
    },
    {
      "@type": "Organization",
      "@id": "https://modeltrust.app/#organization",
      name: "Idea Warehouse",
      url: "https://modeltrust.app",
      founder: {
        "@type": "Person",
        "@id": "https://colinsmillie.com/#person",
        name: "Colin Smillie",
        url: "https://colinsmillie.com",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://modeltrust.app/#application",
      name: "ModelTrust",
      description:
        "Compare AI model outputs, measure reliability, detect disagreement, and know when human review is needed.",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "https://modeltrust.app",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/PreOrder",
        description: "Free during private beta. API costs for evaluated models are separate.",
      },
      featureList: [
        "Multi-model evaluation across GPT-4, Claude, Gemini, and Grok",
        "Structured benchmark question types (Likert, binary, forced choice, numeric scale)",
        "Cost and token tracking per question and per model",
        "Side-by-side model output comparison with divergence scoring",
        "Reliability and trust scoring for each model",
        "Automatic human review flagging when models disagree",
      ],
      creator: {
        "@id": "https://modeltrust.app/#organization",
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://modeltrust.app/#faq",
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
    {
      "@type": "DefinedTermSet",
      "@id": "https://modeltrust.app/#glossary",
      name: "AI Model Evaluation Glossary",
      hasDefinedTerm: [
        {
          "@type": "DefinedTerm",
          name: "AI Model Evaluation",
          description:
            "The systematic process of testing language models against defined questions to measure accuracy, consistency, and reliability for specific use cases.",
        },
        {
          "@type": "DefinedTerm",
          name: "Trust Score",
          description:
            "A quantified reliability metric calculated from response consistency, output validity, calibration accuracy, and agreement with other models.",
        },
        {
          "@type": "DefinedTerm",
          name: "AI Model Reliability",
          description:
            "The degree to which an AI model produces consistent, well-formed, and accurate outputs across repeated queries.",
        },
        {
          "@type": "DefinedTerm",
          name: "Model Agreement",
          description:
            "When multiple AI models converge on the same answer to a given question, indicating higher confidence in the result.",
        },
        {
          "@type": "DefinedTerm",
          name: "Model Disagreement",
          description:
            "When AI model outputs diverge on the same question, signaling uncertainty that may require human review.",
        },
        {
          "@type": "DefinedTerm",
          name: "Benchmark Evaluation",
          description:
            "A structured evaluation using standardized question types (Likert scales, binary choices, forced comparisons) that produce quantifiable, comparable results.",
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Page metadata
// ---------------------------------------------------------------------------

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
            <a
              href="#faq"
              className="text-sm text-zinc-400 hover:text-zinc-50"
            >
              FAQ
            </a>
            <Link
              href="/blog"
              className="text-sm text-zinc-400 hover:text-zinc-50"
            >
              Blog
            </Link>
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
            <p className="mt-6 text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed">
              ModelTrust is an AI model evaluation platform that runs the same
              questions across GPT-4, Claude, Gemini, and other models
              simultaneously. It uses structured benchmarks (Likert scales,
              binary choices, and forced comparisons) to measure reliability,
              detect disagreement, and track cost per query, so organizations
              can make evidence-based decisions about which AI to deploy.
            </p>
            <a
              href="#beta"
              className="mt-8 inline-block px-8 py-3 rounded-md bg-zinc-50 text-zinc-950 font-medium hover:bg-zinc-200 transition-colors"
            >
              Request Beta Access
            </a>
          </div>
        </section>

        {/* Key Concepts */}
        <section id="concepts" className="py-24 border-t border-zinc-800">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-4">
              The Problem with Trusting AI
            </h2>
            <p className="text-center text-zinc-400 mb-12 max-w-2xl mx-auto">
              Every organization using AI faces the same question: which model
              gives the right answer? Here are the concepts behind how
              ModelTrust helps you find out.
            </p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8">
              <div>
                <dt className="text-lg font-semibold mb-1">AI Model Evaluation</dt>
                <dd className="text-sm text-zinc-400 leading-relaxed">
                  The systematic process of testing language models against
                  defined questions to measure accuracy, consistency, and
                  reliability. Rather than relying on generic benchmarks,
                  model evaluation tests AI against your specific use cases
                  and criteria.
                </dd>
              </div>
              <div>
                <dt className="text-lg font-semibold mb-1">Trust Scoring</dt>
                <dd className="text-sm text-zinc-400 leading-relaxed">
                  A quantified reliability metric calculated from a model&apos;s
                  performance across an evaluation. Trust scores factor in
                  response consistency, output validity, calibration accuracy,
                  and agreement with other models to produce a single number
                  that represents how much you can rely on a model&apos;s outputs.
                </dd>
              </div>
              <div>
                <dt className="text-lg font-semibold mb-1">AI Model Reliability</dt>
                <dd className="text-sm text-zinc-400 leading-relaxed">
                  The degree to which an AI model produces consistent,
                  well-formed, and accurate outputs across repeated queries.
                  Reliable models give similar answers to similar questions,
                  format their outputs correctly, and avoid hallucination.
                  Unreliable models produce inconsistent or contradictory
                  responses that require constant human verification.
                </dd>
              </div>
              <div>
                <dt className="text-lg font-semibold mb-1">Model Agreement and Disagreement</dt>
                <dd className="text-sm text-zinc-400 leading-relaxed">
                  When multiple AI models are asked the same question,
                  agreement means they converge on the same answer.
                  Disagreement means their outputs diverge. High disagreement
                  on a question is a signal that the answer is uncertain and
                  may need human review. ModelTrust measures this
                  automatically for every question in an evaluation.
                </dd>
              </div>
              <div>
                <dt className="text-lg font-semibold mb-1">Benchmark Evaluation</dt>
                <dd className="text-sm text-zinc-400 leading-relaxed">
                  A structured evaluation using standardized question types
                  (Likert scales, binary choices, forced comparisons, numeric
                  scales) that produce quantifiable, comparable results.
                  Benchmark evaluations let you measure model performance
                  with statistical rigor rather than subjective assessment.
                </dd>
              </div>
              <div>
                <dt className="text-lg font-semibold mb-1">Human Review Signals</dt>
                <dd className="text-sm text-zinc-400 leading-relaxed">
                  Automatic flags that indicate when AI outputs should not be
                  trusted without human verification. ModelTrust generates
                  these signals when models disagree, when confidence is low,
                  or when responses contain patterns associated with
                  unreliable outputs. The goal is to focus human attention
                  where it matters most.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Why Structured Evaluation */}
        <section className="py-24 border-t border-zinc-800">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-4">
              Why Not Just Ask ChatGPT?
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-6 max-w-3xl mx-auto">
              Ad hoc testing means asking a model a few questions and eyeballing
              the answers. It feels productive, but it tells you almost nothing.
              You have no baseline, no comparison, and no way to know if the
              answer you got today will be the answer you get tomorrow.
            </p>
            <p className="text-zinc-400 leading-relaxed mb-6 max-w-3xl mx-auto">
              Structured evaluation is different. You define specific questions,
              run them across multiple models simultaneously, and measure the
              results quantitatively. When three models agree on an answer and
              one disagrees, that disagreement is a data point. When a model
              scores 92% reliability on your evaluation but only 64% on
              another, you know exactly where to trust it and where not to.
            </p>
            <p className="text-zinc-400 leading-relaxed max-w-3xl mx-auto">
              ModelTrust exists because choosing an AI model for production
              should be based on evidence, not gut feeling. Generic leaderboard
              benchmarks test general knowledge. Your business needs are
              specific. ModelTrust lets you test what actually matters to you.
            </p>
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

        {/* FAQ */}
        <section id="faq" className="py-24 border-t border-zinc-800">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-12">
              Frequently Asked Questions
            </h2>
            <div className="space-y-8">
              {FAQ_ITEMS.map((item, i) => (
                <div key={i}>
                  <h3 className="text-lg font-semibold mb-2">{item.question}</h3>
                  <p className="text-zinc-400 leading-relaxed">{item.answer}</p>
                </div>
              ))}
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
              href="/blog"
              className="text-sm text-zinc-400 hover:text-zinc-50"
            >
              Blog
            </Link>
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
