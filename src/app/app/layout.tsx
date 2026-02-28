import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { logoutAction } from "@/app/app/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/app/surveys" className="text-lg font-semibold">
              AI Survey Platform
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/app/surveys"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Surveys
              </Link>
              {session.role === "ADMIN" && (
                <Link
                  href="/app/admin/users"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Admin
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/app/settings"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Settings
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </>
  );
}
