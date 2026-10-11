import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Ingrivo — Know what you eat. Understand what you buy.",
  description:
    "Packaged food and beverage intelligence powered by Open Food Facts, barcode scanning, label OCR, and educational AI explanations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#FBF8F2] text-[#1B2A22]">
        {/* Accessible skip link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#1E5B45] focus:text-white focus:rounded-md focus:shadow-md focus:outline-none"
        >
          Skip to main content
        </a>
        <Suspense fallback={<div className="h-16 w-full bg-[#FBF8F2]" />}>
          <Header />
        </Suspense>
        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
