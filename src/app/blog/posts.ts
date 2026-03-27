export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  authorUrl: string;
  readingTime: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "why-ai-models-disagree",
    title: "Why AI Models Disagree (And Why It Matters)",
    description:
      "When you ask GPT-4 and Claude the same question, they often give different answers. Understanding why this happens is the first step toward building AI systems you can trust.",
    date: "2026-03-27",
    author: "Colin Smillie",
    authorUrl: "https://colinsmillie.com",
    readingTime: "6 min read",
  },
  {
    slug: "evaluating-ai-models-for-enterprise",
    title: "How to Evaluate AI Models for Enterprise Use",
    description:
      "Generic benchmarks tell you how a model performs on average. Enterprise deployment requires knowing how it performs on your specific problems.",
    date: "2026-03-27",
    author: "Colin Smillie",
    authorUrl: "https://colinsmillie.com",
    readingTime: "8 min read",
  },
  {
    slug: "structured-ai-benchmarking",
    title: "The Case for Structured AI Benchmarking",
    description:
      "Ad hoc testing feels productive but produces unreliable conclusions. Structured benchmarking with defined question types gives you data you can act on.",
    date: "2026-03-27",
    author: "Colin Smillie",
    authorUrl: "https://colinsmillie.com",
    readingTime: "7 min read",
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
