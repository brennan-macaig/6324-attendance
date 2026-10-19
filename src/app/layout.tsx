import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";

// Every page is per-user and reads the session + database: never prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: `${process.env.TEAM_NAME || "FRC Team"} Attendance`, template: `%s · ${process.env.TEAM_NAME || "FRC Team"}` },
  description: "Attendance and hours tracking",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The app header is navy in both color schemes.
  themeColor: "#0b1f3a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
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
