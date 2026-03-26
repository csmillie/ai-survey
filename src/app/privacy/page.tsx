import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy: ModelTrust",
  description: "How ModelTrust collects, uses, and protects your data.",
};

export default function PrivacyPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold">
            ModelTrust
          </Link>
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-zinc-50"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main>
        <article className="max-w-3xl mx-auto px-6 py-16">
          <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-sm text-zinc-500 mb-12">
            Last updated: March 26, 2026
          </p>

          <h2 className="text-xl font-semibold mt-10 mb-4">Analytics</h2>
          <p className="text-zinc-400 leading-relaxed mb-4">
            ModelTrust uses Google Analytics 4 to understand how visitors use
            the site. This collects anonymous data including pages visited,
            browser type, device information, and approximate location. Your IP
            address is anonymized by Google. You can opt out of Google Analytics
            through your browser settings or by using Google&apos;s opt-out
            browser add-on.
          </p>
          <p className="text-zinc-400 leading-relaxed mb-4">
            We also track specific interaction events (like creating an
            evaluation or selecting a question type) to improve the product
            experience. This data is processed by Google under their privacy
            policy.
          </p>

          <h2 className="text-xl font-semibold mt-10 mb-4">Beta Program</h2>
          <p className="text-zinc-400 leading-relaxed mb-4">
            When you sign up for beta access, we collect your email address,
            name, and optionally your company and role. We use this information
            only to manage the beta waitlist and to contact you about product
            access. We do not share this data with third parties. You can
            request removal of your beta signup data at any time by contacting
            us.
          </p>

          <h2 className="text-xl font-semibold mt-10 mb-4">
            Accounts and Usage Data
          </h2>
          <p className="text-zinc-400 leading-relaxed mb-4">
            When you create an account, we collect your email address, name, and
            password. Passwords are hashed using bcrypt and are never stored in
            plain text.
          </p>
          <p className="text-zinc-400 leading-relaxed mb-4">
            Through normal use of ModelTrust, we store the evaluations, question
            configurations, and model responses that you create. Authentication
            uses secure, httpOnly JWT cookies. For security purposes, we log
            login attempts along with IP address and user agent information.
          </p>

          <h2 className="text-xl font-semibold mt-10 mb-4">Data Sharing</h2>
          <p className="text-zinc-400 leading-relaxed mb-4">
            We do not sell your personal data. We do not share personal data
            with third parties, except as needed to operate the service
            (specifically Google Analytics for usage data) or as required by
            law.
          </p>

          <h2 className="text-xl font-semibold mt-10 mb-4">Contact</h2>
          <p className="text-zinc-400 leading-relaxed mb-4">
            For privacy questions or data removal requests, contact us at{" "}
            <a
              href="mailto:privacy@modeltrust.ai"
              className="text-zinc-50 underline hover:text-zinc-300"
            >
              privacy@modeltrust.ai
            </a>
            .
          </p>
        </article>
      </main>

      <footer className="border-t border-zinc-800 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-zinc-500">
            © 2026 ModelTrust. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <span className="text-sm text-zinc-50">Privacy Policy</span>
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
