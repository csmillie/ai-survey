import type { Metadata } from "next";
import Link from "next/link";
import { BlogLayout } from "@/app/blog/blog-layout";

export const metadata: Metadata = {
  title: "The Case for Structured AI Benchmarking: ModelTrust",
  description:
    "Ad hoc testing feels productive but produces unreliable conclusions. Structured benchmarking with defined question types gives you data you can act on.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "The Case for Structured AI Benchmarking",
  datePublished: "2026-03-27",
  author: {
    "@type": "Person",
    name: "Colin Smillie",
    url: "https://colinsmillie.com/#person",
  },
  publisher: {
    "@type": "Organization",
    name: "ModelTrust",
  },
};

export default function StructuredAiBenchmarkingPage(): React.ReactElement {
  return (
    <BlogLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="text-4xl font-bold mb-2">
        The Case for Structured AI Benchmarking
      </h1>
      <p className="text-sm text-zinc-500 mb-12">
        March 27, 2026 &middot;{" "}
        <a
          href="https://colinsmillie.com"
          className="hover:text-zinc-300"
          target="_blank"
          rel="noopener noreferrer"
        >
          Colin Smillie
        </a>{" "}
        &middot; 7 min read
      </p>

      <p className="text-zinc-400 leading-relaxed mb-4">
        Here is how most teams pick an AI model: someone on the team opens
        ChatGPT, opens Claude, maybe opens Gemini. They type in a few prompts.
        They read the answers. They say &quot;this one feels better&quot; and
        move on. The decision is made on vibes.
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        This works fine for personal use. It does not work when you are choosing
        a model that will handle customer interactions, generate reports, or
        classify support tickets at scale. At that point, you need evidence. You
        need numbers. You need a process that someone else can reproduce and
        verify.
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        That is what structured benchmarking gives you.
      </p>

      <h2 className="text-xl font-semibold mt-10 mb-4">
        The Problem with Ad Hoc Testing
      </h2>
      <p className="text-zinc-400 leading-relaxed mb-4">
        Ad hoc testing has three failure modes. First, it is not reproducible.
        If you asked five questions last Tuesday and got good results from
        GPT-4o, you cannot go back and compare that against Claude 3.5 Sonnet
        under the same conditions. You probably don&apos;t even remember the
        exact prompts you used.
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        Second, it is subject to confirmation bias. If you already think one
        model is better, you will unconsciously interpret ambiguous answers in
        its favor. Open-ended reading of freeform text is exactly the kind of
        evaluation where bias thrives.
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        Third, it does not scale. You might compare two models on five
        questions. But what about comparing four models on fifty questions
        across three different use cases? Manual reading falls apart. You need
        structure.
      </p>

      <h2 className="text-xl font-semibold mt-10 mb-4">
        What Structured Benchmarking Looks Like
      </h2>
      <p className="text-zinc-400 leading-relaxed mb-4">
        The core idea is simple: instead of asking open-ended questions and
        subjectively judging the answers, you design questions that produce
        quantifiable responses. Each question has a defined type that constrains
        the answer space. The model&apos;s response becomes a data point, not a
        paragraph you have to interpret.
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        This is not a new concept. Survey methodology has been doing this for
        decades. Psychologists, market researchers, and social scientists
        figured out long ago that you get better data from &quot;rate your
        agreement from 1 to 5&quot; than from &quot;tell me how you feel.&quot;
        The same principle applies when the respondent is an LLM.
      </p>

      <h2 className="text-xl font-semibold mt-10 mb-4">
        Choosing the Right Question Type
      </h2>
      <p className="text-zinc-400 leading-relaxed mb-4">
        The question type you choose determines what kind of analysis you can
        do. Each type is suited to a different kind of evaluation.
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        <strong className="text-zinc-200">Likert scales</strong> measure
        degree. &quot;How confident are you in this diagnosis?&quot; on a 1 to 5
        scale gives you a number you can average across runs, compare across
        models, and track over time. Use these when you care about intensity or
        agreement, not just a yes or no.
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        <strong className="text-zinc-200">Binary questions</strong> are for
        classification and factual verification. &quot;Is this email spam? Yes
        or no.&quot; &quot;Does this paragraph contain a factual error? Yes or
        no.&quot; You get accuracy rates, precision, recall. Clean, comparable
        metrics.
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        <strong className="text-zinc-200">Forced choice</strong> questions
        present two specific options: &quot;Which response is more helpful, A or
        B?&quot; This is useful for preference testing and direct comparison. It
        forces a decision and eliminates the hedge of &quot;both are
        good.&quot;
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        <strong className="text-zinc-200">Numeric scales</strong> capture
        magnitude. &quot;On a scale of 0 to 100, how severe is this security
        vulnerability?&quot; Wider ranges give finer granularity than Likert
        scales. Good for risk scoring, priority ranking, or any task where you
        need more resolution.
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        <strong className="text-zinc-200">Single select</strong> handles
        categorical classification. &quot;Classify this support ticket:
        billing, technical, account, other.&quot; You define the categories. The
        model picks one. You get a confusion matrix and classification accuracy.
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        <strong className="text-zinc-200">Open-ended questions</strong> still
        have a place. Some evaluations genuinely require freeform text. &quot;Write
        a summary of this article&quot; or &quot;Draft a reply to this
        complaint.&quot; Use these when no structured type can capture what you
        need, but recognize that comparing open-ended responses across models
        requires more work, often involving a second-pass evaluation with
        structured scoring.
      </p>

      <h2 className="text-xl font-semibold mt-10 mb-4">
        What You Get from Structure
      </h2>
      <p className="text-zinc-400 leading-relaxed mb-4">
        Once your evaluation uses defined question types, several things become
        possible. You can compute means, standard deviations, and confidence
        intervals across models. You can run the same evaluation next month
        when a new model version drops and compare results directly. You can
        show a stakeholder a chart that says &quot;Model A scores 4.2 on
        empathy while Model B scores 3.1&quot; instead of saying &quot;I
        read both and A felt better.&quot;
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        Reproducibility matters more than people realize. Models get updated.
        Providers change pricing. Your requirements evolve. If your evaluation
        is structured, re-running it is trivial. If it was ad hoc, you are
        starting from scratch every time.
      </p>

      <h2 className="text-xl font-semibold mt-10 mb-4">
        A Practical Example: Customer Support
      </h2>
      <p className="text-zinc-400 leading-relaxed mb-4">
        Say you are evaluating models for an AI-assisted customer support tool.
        You want a model that classifies tickets accurately, responds with
        appropriate empathy, and keeps answers concise. Here is how you might
        structure the evaluation.
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        Start with a <strong className="text-zinc-200">single select</strong>{" "}
        question: &quot;Classify this ticket into one of the following
        categories: billing, technical, account access, feature request,
        other.&quot; Run it against 50 sample tickets where you know the correct
        category. You now have a classification accuracy score for each model.
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        Add a <strong className="text-zinc-200">Likert scale</strong> question:
        &quot;Rate the empathy of the following draft response on a scale of 1
        (cold and mechanical) to 5 (warm and understanding).&quot; Feed each
        model a set of customer complaints and have it both draft a response and
        rate the empathy. Cross-reference with human ratings to calibrate.
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        Include a <strong className="text-zinc-200">binary</strong> question:
        &quot;Does this response contain any information not supported by the
        provided knowledge base? Yes or no.&quot; This tests hallucination
        rates. You care a lot about this in customer support, where a wrong
        answer erodes trust fast.
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        Finish with a{" "}
        <strong className="text-zinc-200">numeric scale</strong> question:
        &quot;On a scale of 0 to 100, rate how concise this response is, where
        0 is extremely verbose and 100 is maximally concise while still being
        complete.&quot; This gives finer granularity than a 5-point Likert
        scale.
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        After running four models through this evaluation, you have a table:
        classification accuracy, empathy scores, hallucination rates, and
        conciseness ratings. That table tells you which model to deploy. No
        guesswork required.
      </p>

      <h2 className="text-xl font-semibold mt-10 mb-4">
        Cost Is Part of the Equation
      </h2>
      <p className="text-zinc-400 leading-relaxed mb-4">
        Quality is only half the picture. A model that scores 5% better on
        empathy but costs three times as much per request might not be the right
        choice. Structured evaluation lets you track cost per question per model
        alongside quality scores. You can find the point where you get 90% of
        the quality for 30% of the cost. For high-volume use cases like support
        ticket classification, that cost difference compounds fast.
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        Tracking token usage and cost per response also reveals surprises. Some
        models are consistently verbose, burning tokens on filler. Others are
        terse to the point of being unhelpful. The data shows you these patterns
        across hundreds of responses, not just the handful you happened to read.
      </p>

      <h2 className="text-xl font-semibold mt-10 mb-4">
        Getting Started
      </h2>
      <p className="text-zinc-400 leading-relaxed mb-4">
        You do not need a complex framework to start. Pick a real use case.
        Write ten questions using the types described above. Run two or three
        models through them. Compare the numbers. You will learn more from that
        exercise than from a month of ad hoc testing.
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        <Link
          href="/"
          className="text-zinc-200 underline hover:text-zinc-50"
        >
          ModelTrust
        </Link>{" "}
        supports all of these question types out of the box, with automatic
        statistical comparison and cost tracking across models. If you want a
        tool that handles the infrastructure so you can focus on designing good
        evaluations, it is worth a look.
      </p>
      <p className="text-zinc-400 leading-relaxed mb-4">
        For more on building measurement into AI workflows, see{" "}
        <a
          href="https://colinsmillie.com"
          className="text-zinc-200 underline hover:text-zinc-50"
          target="_blank"
          rel="noopener noreferrer"
        >
          colinsmillie.com
        </a>
        .
      </p>
    </BlogLayout>
  );
}
