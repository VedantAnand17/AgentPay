import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Terminal, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service | AgentPay Relay",
  description: "Terms of Service for AgentPay Relay",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background pt-32 pb-24">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <Button asChild variant="outline" className="rounded-none border-white/10 hover:bg-white/5 mb-8 font-mono text-xs uppercase tracking-wider">
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              RETURN
            </Link>
          </Button>
        </div>

        <div className="border border-white/10 bg-black/40 p-8 md:p-12 space-y-8 font-mono">
          <div className="flex items-center gap-3 mb-8">
            <Terminal className="h-8 w-8 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight">Terms of Service</h1>
          </div>

          <div className="text-muted-foreground space-y-6 text-sm leading-relaxed">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground/60 mb-2">Last Updated: {new Date().toLocaleDateString()}</p>
            </div>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">1. Protocol Access</h2>
              <p>
                AgentPay Relay (&quot;the Protocol&quot;) provides a permissionless relay service for executing spot trades on Uniswap via x402-native AI agents.
                Access to the Protocol is granted without registration, KYC, or approval processes.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">2. Zero-Custody Architecture</h2>
              <p>
                The Protocol operates as a non-custodial relay. We do not hold, store, or have access to your private keys, API keys, or funds.
                All trades are executed directly through your connected wallet via one-time, cryptographically signed intents.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">3. Agent Responsibility</h2>
              <p>
                You are solely responsible for the actions of any AI agents or automated systems that interact with the Protocol.
                The Protocol does not validate, approve, or monitor agent behavior. All trade intents are executed as submitted.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">4. No Warranties</h2>
              <p>
                The Protocol is provided &quot;as is&quot; without warranties of any kind. We do not guarantee uptime, execution speed,
                price accuracy, or availability of liquidity pools. Trade execution is subject to blockchain network conditions
                and Uniswap pool availability.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">5. Limitation of Liability</h2>
              <p>
                AgentPay Relay and its operators shall not be liable for any losses, damages, or claims arising from:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-muted-foreground/80">
                <li>Trade execution failures or slippage</li>
                <li>Agent malfunctions or unauthorized actions</li>
                <li>Blockchain network congestion or failures</li>
                <li>Uniswap pool liquidity issues</li>
                <li>Smart contract vulnerabilities or exploits</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">6. Information Hygiene</h2>
              <p>
                The Protocol is designed with information hygiene principles: no API keys, no long-lived permissions,
                no persistent storage of sensitive data. However, you remain responsible for securing your wallet,
                private keys, and agent configurations.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">7. Protocol Modifications</h2>
              <p>
                We reserve the right to modify, suspend, or discontinue the Protocol at any time without notice.
                Protocol capacity may be limited, and access may be restricted during maintenance or updates.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">8. Compliance</h2>
              <p>
                You are responsible for ensuring your use of the Protocol complies with applicable laws and regulations
                in your jurisdiction. The Protocol does not provide financial, legal, or tax advice.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">9. Acceptance</h2>
              <p>
                By accessing or using the Protocol, you acknowledge that you have read, understood, and agree to be bound
                by these Terms of Service. If you do not agree, do not use the Protocol.
              </p>
            </section>

            <div className="pt-8 border-t border-white/10">
              <p className="text-xs text-muted-foreground/60">
                For questions or concerns, contact: <a href="https://github.com/vedantanand17/AgentPay" className="text-primary hover:underline">/GITHUB</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}









