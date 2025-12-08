import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentPay Relay",
  description: "Execute AI-powered perp trades with one-time x402 payments. No API keys. No custody.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

