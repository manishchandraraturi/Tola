import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const patrickHand = localFont({
  src: "../../public/fonts/patrick-hand-400.ttf",
  variable: "--font-hand",
  display: "swap",
});

const comicNeue = localFont({
  src: [
    { path: "../../public/fonts/comic-neue-400.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/comic-neue-700.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-sketch",
  display: "swap",
});

const caveat = localFont({
  src: "../../public/fonts/caveat-700.ttf",
  variable: "--font-caveat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tola — gold accounts that both sides trust",
  description:
    "Tola keeps one shared gold record for jeweller and karigar: issue slips on both phones, live gold balance, fair wastage, on-time UPI settlement. Tech4Bharat 2026 | Problem 2.2.",
  keywords: ["Tola", "gold", "karigar", "jeweller", "job work", "agentic AI", "Tech4Bharat"],
  authors: [{ name: "Team Tola — Tech4Bharat 2026" }],
};

export const viewport: Viewport = {
  themeColor: "#FBF3E2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${patrickHand.variable} ${comicNeue.variable} ${caveat.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
