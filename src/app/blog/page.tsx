import type { Metadata } from "next";
import Link from "next/link";
import { BlogLayout } from "@/app/blog/blog-layout";
import { BLOG_POSTS } from "@/app/blog/posts";

export const metadata: Metadata = {
  title: "Blog: ModelTrust",
  description:
    "Articles on AI model evaluation, trust scoring, structured benchmarking, and making evidence-based decisions about which AI models to deploy.",
};

export default function BlogIndexPage(): React.ReactElement {
  return (
    <BlogLayout>
      <h1 className="text-4xl font-bold mb-2">Blog</h1>
      <p className="text-zinc-400 mb-12">
        Writing about AI model evaluation, trust, and the tools to measure both.
      </p>

      <div className="space-y-10">
        {BLOG_POSTS.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="block group"
          >
            <article className="rounded-lg border border-zinc-800 p-6 transition-colors hover:border-zinc-600 hover:bg-zinc-900/50">
              <time className="text-xs text-zinc-500">{post.date}</time>
              <h2 className="text-xl font-semibold mt-1 mb-2 group-hover:text-zinc-200">
                {post.title}
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {post.description}
              </p>
              <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
                <span>{post.author}</span>
                <span>{post.readingTime}</span>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </BlogLayout>
  );
}
