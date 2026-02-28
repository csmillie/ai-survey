import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage(): Promise<React.ReactElement> {
  const session = await requireSession();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { name: true, email: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsForm name={user.name} email={user.email} />
    </div>
  );
}
