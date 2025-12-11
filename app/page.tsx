import { Hero } from "@/components/ui/hero";
import { FeatureCard } from "@/components/ui/feature-card";
import { HowItWorks } from "@/components/ui/how-it-works";
import { CTASection } from "@/components/ui/cta-section";
import { Bot, LineChart, ShieldCheck, Cpu, Globe, EyeOff, Zap, Terminal } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <Hero />

      {/* How It Works Section */}
      <HowItWorks />

      {/* Features Grid */}
      <section id="features" className="py-24 md:py-32 relative border-t border-border/40">
        <div className="absolute inset-0 -z-10 bg-grid-small-white/[0.05]" />
        <div className="container max-w-6xl mx-auto px-4">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight font-mono uppercase">
              System <span className="text-primary">Architecture</span>
            </h2>
            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto font-mono">
              Optimized for autonomous agents. Zero latency. Zero trust.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <FeatureCard
              icon={<Bot className="h-6 w-6" />}
              title="Agent Sovereignty"
              description="Your agent shouldn't have to beg for permission. Autonomous execution without the paper trail."
              delay={0.1}
            />
            <FeatureCard
              icon={<ShieldCheck className="h-6 w-6" />}
              title="Zero-Trust Relay"
              description="We don't want your keys. We don't want your custody. We just move the money. Clean and simple."
              delay={0.2}
            />
            <FeatureCard
              icon={<LineChart className="h-6 w-6" />}
              title="Deep Liquidity"
              description="Direct access to Uniswap pools. Get the best price without exposing your strategy to the whole mempool."
              delay={0.3}
            />
            <FeatureCard
              icon={<EyeOff className="h-6 w-6" />}
              title="Information Hygiene"
              description="No API keys to leak. No long-lived permissions. Just one-time, cryptographically signed intents."
              delay={0.4}
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Atomic Settlement"
              description="Trades settle in the same block. Money in, money out. Don't leave your funds sitting on an exchange."
              delay={0.5}
            />
            <FeatureCard
              icon={<Globe className="h-6 w-6" />}
              title="Permissionless Access"
              description="No sign-ups, no KYC, no 'please wait for approval'. Just connect your agent and execute."
              delay={0.6}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <CTASection />

      {/* Footer */}
      <footer className="py-12 border-t border-border/40 bg-black">
        <div className="container max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-muted-foreground text-sm font-mono">
          <p>© 2025 AgentPay. Information Hygiene Specialists.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-primary transition-colors">/TERMS</a>
            <a href="#" className="hover:text-primary transition-colors">/PRIVACY</a>
            <a href="https://github.com/vedant/AgentPay" className="hover:text-primary transition-colors">/GITHUB</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
