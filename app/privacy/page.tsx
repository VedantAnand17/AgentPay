import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | AgentPay Relay",
  description: "Privacy Policy for AgentPay Relay",
};

export default function PrivacyPage() {
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
            <ShieldCheck className="h-8 w-8 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight">Privacy Policy</h1>
          </div>

          <div className="text-muted-foreground space-y-6 text-sm leading-relaxed">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground/60 mb-2">Last Updated: {new Date().toLocaleDateString()}</p>
            </div>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">1. Zero-Knowledge Architecture</h2>
              <p>
                AgentPay Relay is designed with privacy-first principles. We implement a zero-knowledge architecture where
                we do not collect, store, or have access to your personal information, wallet addresses, trade history,
                or agent configurations beyond what is necessary for protocol operation.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">2. No Data Collection</h2>
              <p>
                We do not collect:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-muted-foreground/80">
                <li>Personal identification information</li>
                <li>Wallet addresses or private keys</li>
                <li>Trade history or transaction data</li>
                <li>API keys or authentication credentials</li>
                <li>Agent configurations or strategies</li>
                <li>IP addresses or location data</li>
                <li>Cookies or tracking identifiers</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">3. Blockchain Transparency</h2>
              <p>
                All trades executed through the Protocol are recorded on the public blockchain (Base Sepolia).
                This blockchain data is publicly accessible and immutable. We do not control or have special access
                to this data beyond what any blockchain explorer provides.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">4. One-Time Intents</h2>
              <p>
                Trade execution uses one-time, cryptographically signed intents. These intents are:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-muted-foreground/80">
                <li>Valid for a single use only</li>
                <li>Not stored after execution</li>
                <li>Cannot be reused or replayed</li>
                <li>Do not grant persistent permissions</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">5. No Logs</h2>
              <p>
                The Protocol operates with minimal logging. We do not maintain persistent logs of:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-muted-foreground/80">
                <li>User interactions</li>
                <li>Trade requests or intents</li>
                <li>Wallet connections</li>
                <li>Agent communications</li>
              </ul>
              <p className="mt-2">
                Any temporary logs required for protocol operation are purged immediately after use.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">6. Third-Party Services</h2>
              <p>
                The Protocol interacts with:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-muted-foreground/80">
                <li><strong>Uniswap:</strong> For trade execution and liquidity access</li>
                <li><strong>Blockchain Networks:</strong> For transaction processing</li>
                <li><strong>Wallet Providers:</strong> For wallet connections (handled client-side)</li>
              </ul>
              <p className="mt-2">
                We do not share data with these services beyond what is necessary for protocol operation.
                Please review their respective privacy policies.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">7. Information Hygiene</h2>
              <p>
                Our commitment to information hygiene means:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-muted-foreground/80">
                <li>No data retention beyond operational necessity</li>
                <li>No data sharing with third parties</li>
                <li>No tracking or analytics</li>
                <li>No marketing or promotional communications</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">8. Your Control</h2>
              <p>
                You maintain full control over your privacy:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-muted-foreground/80">
                <li>No account creation required</li>
                <li>No persistent connections</li>
                <li>Each interaction is independent</li>
                <li>You can disconnect at any time</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">9. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. Changes will be reflected in the &quot;Last Updated&quot;
                date at the top of this page. Continued use of the Protocol after changes constitutes acceptance
                of the updated policy.
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








