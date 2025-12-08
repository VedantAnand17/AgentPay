// Landing page
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-4">AgentPay Relay</h1>
        <p className="text-xl text-center mb-8 text-gray-600 dark:text-gray-400">
          Execute AI-powered perp trades with one-time x402 payments. No API keys. No custody.
        </p>
        <div className="flex justify-center">
          <Link
            href="/trade"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Trade Console
          </Link>
        </div>
      </div>
    </main>
  );
}

