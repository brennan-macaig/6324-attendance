import type { Metadata, Viewport } from "next";
import "./globals.css";
import { db } from "@/db";
import { getTheme, THEMES } from "@/lib/theme";
import { Nav } from "@/components/nav";

// Every page is per-user and reads the session + database: never prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: `${process.env.TEAM_NAME || "FRC Team"} Attendance`, template: `%s · ${process.env.TEAM_NAME || "FRC Team"}` },
  description: "Attendance and hours tracking",
  robots: { index: false, follow: false },
};

// The header color (and so the browser chrome color) depends on the admin-chosen theme.
export async function generateViewport(): Promise<Viewport> {
  const theme = await getTheme(db);
  const header = THEMES.find((t) => t.id === theme)?.header ?? THEMES[0].header;
  return { width: "device-width", initialScale: 1, themeColor: header };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await getTheme(db);
  return (
    <html lang="en" className="h-full antialiased" data-theme={theme === "navy" ? undefined : theme}>
      <body className="flex min-h-full flex-col overflow-x-clip bg-canvas text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-pop"
        >
          Skip to content
        </a>
        <Nav />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
          {children}
        </main>
      </body>
    </html>
  );
}
