import { db } from "@/db";
import { requirePageUser } from "@/lib/authz";
import { getTheme, THEMES } from "@/lib/theme";
import { Card, PageHeader } from "@/components/ui";
import { ThemePicker } from "@/components/theme-picker";
import { updateThemeAction } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePageUser("admin", "/admin/settings");
  const theme = await getTheme(db);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Site-wide options for this team." />
      <Card title="Theme" description="Changes the header and accent color for everyone.">
        <ThemePicker action={updateThemeAction} current={theme} options={THEMES} />
      </Card>
    </div>
  );
}
