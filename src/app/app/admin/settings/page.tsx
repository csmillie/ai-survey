import { prisma } from "@/lib/db";
import { SettingRow, NewSettingForm } from "./settings-form";

export default async function AdminSettingsPage(): Promise<React.ReactElement> {
  const settings = await prisma.systemSetting.findMany({
    orderBy: { key: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>

      {settings.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          No settings configured yet. Add one below.
        </p>
      ) : (
        <div className="space-y-4 max-w-2xl">
          {settings.map((s) => (
            <SettingRow key={s.id} settingKey={s.key} value={s.value} />
          ))}
        </div>
      )}

      <div className="max-w-2xl">
        <NewSettingForm />
      </div>
    </div>
  );
}
