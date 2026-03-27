import Link from "next/link";

interface BlogLayoutProps {
  children: React.ReactNode;
}

export function BlogLayout({ children }: BlogLayoutProps): React.ReactElement {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold hover:text-zinc-300">
            ModelTrust
          </Link>
          <div className="flex items-center gap-6">
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
        <article className="max-w-3xl mx-auto px-6 py-16">
          {children}
        </article>
      </main>

      <footer className="border-t border-zinc-800 py-8">
        <div className="max-w-3xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-zinc-500">
            &copy; 2026 ModelTrust. All rights reserved.
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
