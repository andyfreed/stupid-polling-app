import type { Metadata } from "next";
import "./globals.css";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Poll Aggregator",
  description: "Aggregated polling data from free sources",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4">
          <header className="flex items-center justify-between py-6">
            <a href="/subjects" className="text-lg font-semibold tracking-tight">
              Poll Aggregator
            </a>
            <nav className="text-sm text-zinc-300">
              <a className="hover:text-white" href="/subjects">
                Subjects
              </a>
            </nav>
          </header>
          <main className="flex-1 py-6">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
