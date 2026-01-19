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
    <html lang="en" className="dark" style={{ colorScheme: 'dark' }}>
      <head>
        {/* Preconnect to external resources for faster loading */}
        <link rel="preconnect" href="https://rpc.walletconnect.com" />
        <link rel="preconnect" href="https://sepolia.base.org" />
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body className={`${fontBody.variable} ${fontHeading.variable} ${fontMono.variable} antialiased min-h-screen bg-background font-sans`}>
        {/* Skip link for keyboard navigation - hidden until focused */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-100 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-black focus:font-bold focus:rounded-none"
        >
          Skip to main content
        </a>
        <ClientProviders>
          <Navbar />
          <main id="main-content" className="flex-1">
            {children}
          </main>
        </ClientProviders>
      </body>
    </html>
  );
}
