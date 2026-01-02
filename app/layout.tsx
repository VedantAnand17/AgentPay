import type { Metadata } from "next";
import "./globals.css";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono } from "next/font/google";
import { Navbar } from "@/components/ui/navbar";
import { ClientProviders } from "./client-providers";

const fontHeading = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-heading",
});

const fontBody = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "AgentPay Relay",
  description: "Execute AI-powered spot trades on Uniswap with one-time x402 payments. No API keys. No custody.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fontBody.variable} ${fontHeading.variable} ${fontMono.variable} antialiased min-h-screen bg-background font-sans`}>
        <ClientProviders>
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
        </ClientProviders>
      </body>
    </html>
  );
}
