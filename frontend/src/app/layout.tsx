import type { Metadata } from "next";
import { EB_Garamond, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const garamond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-garamond",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NERM Assistant | The University of Chicago",
  description:
    "An assistant for University of Chicago Non-Employee Risk Management (NERM) documentation and workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${garamond.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="bg-maroon text-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
            <span className="font-serif text-lg tracking-wide">
              The University of Chicago
            </span>
            <span className="hidden text-xs font-medium uppercase tracking-[0.2em] text-white/80 sm:inline">
              Non-Employee Risk Management
            </span>
          </div>
        </header>

        {children}

        <footer className="border-t border-greystone bg-white">
          <p className="mx-auto max-w-5xl px-4 py-4 text-xs leading-5 text-greystone-dark sm:px-6">
            Answers are generated from approved UChicago NERM documentation and
            may be incomplete. Confirm details in NERM before taking action.
          </p>
        </footer>
      </body>
    </html>
  );
}
