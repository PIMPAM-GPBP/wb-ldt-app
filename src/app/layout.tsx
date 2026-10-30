import type { Metadata } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { AppHeader } from "@/components/layout/app-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "Local Development Tracker",
  description:
    "Public municipality-level analytics for maps, scores, and indicator exploration.",
};

const themeInitializer = `
  try {
    // Light first: only a saved choice of dark opens the site dark.
    const theme = window.localStorage.getItem("ldt-theme") === "dark" ? "dark" : "light";
    const isDark = theme === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="font-sans">
      <body className="min-h-screen">
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
        <ThemeProvider>
          <TooltipProvider delay={250}>
            <div className="relative flex min-h-screen flex-col">
              <a
                href="#main-content"
                className="sr-only fixed left-4 top-4 z-[100] rounded-sm bg-[var(--gpb-chrome-bg)] px-4 py-3 text-sm font-semibold text-[var(--gpb-chrome-active)] shadow-float focus:not-sr-only focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--gpb-chrome-focus)]"
              >
                Skip to main content
              </a>
              <AppHeader />
              <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
                {children}
              </div>
              <SiteFooter />
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
