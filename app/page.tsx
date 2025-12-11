import { Hero } from "@/components/ui/hero";
import { FeatureCard } from "@/components/ui/feature-card";
import { HowItWorks } from "@/components/ui/how-it-works";
import { CTASection } from "@/components/ui/cta-section";
import { Bot, LineChart, Wallet, ShieldCheck, Cpu, Globe } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <Hero />

      {/* How It Works Section */}
      <HowItWorks />

      {/* Features Grid */}
      <section id="features" className="py-24 md:py-32 relative">
        <div className="absolute inset-0 -z-10 bg-gradient-subtle" />
        <div className="container max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
              Why AgentPay?
            </h2>
            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
              The first relay protocol designed for AI Agents to execute DeFi transactions securely and autonomously.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <FeatureCard
              icon={<Bot className="h-6 w-6" />}
              title="Agent-First Design"
              description="Optimized for AI agents to trigger trades programmatically without managing complex wallet states."
              delay={0.1}
            />
            <FeatureCard
              icon={<ShieldCheck className="h-6 w-6" />}
              title="Secure Relay"
              description="Transactions are relayed securely. User funds remain non-custodial throughout the entire process."
              delay={0.2}
            />
            <FeatureCard
              icon={<LineChart className="h-6 w-6" />}
              title="Uniswap Integration"
              description="Direct execution on Uniswap pools ensuring deep liquidity and best price execution."
              delay={0.3}
            />
            <FeatureCard
              icon={<Wallet className="h-6 w-6" />}
              title="No API Keys"
              description="Eliminate security risks associated with long-lived API keys. Use x402 payments for authorization."
              delay={0.4}
            />
            <FeatureCard
              icon={<Cpu className="h-6 w-6" />}
              title="Instant Settlement"
              description="Trades are settled on-chain immediately. No waiting for withdrawals or centralized batching."
              delay={0.5}
            />
            <FeatureCard
              icon={<Globe className="h-6 w-6" />}
              title="Permissionless"
              description="Anyone can use the relay. No sign-ups, no KYC. Just connect and trade via the protocol."
              delay={0.6}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <CTASection />

      {/* Footer */}
      <footer className="py-12 border-t bg-card/50">
        <div className="container max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-muted-foreground text-sm">
          <p>© 2025 AgentPay Relay. All rights reserved.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="https://github.com/vedant/AgentPay" className="hover:text-foreground transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
