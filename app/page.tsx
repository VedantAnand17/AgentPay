import { Hero } from "@/components/ui/hero";
import { FeatureCard } from "@/components/ui/feature-card";
import { HowItWorks } from "@/components/ui/how-it-works";
import { CTASection } from "@/components/ui/cta-section";
import Link from "next/link";
import { Bot, LineChart, ShieldCheck, Cpu, Globe, EyeOff, Zap, Terminal, Brain } from "lucide-react";

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
              The Protocol <span className="text-primary">Specifications</span>
            </h2>
            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto font-mono">
              Designed for the underworld of autonomous finance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <FeatureCard
              icon={<ShieldCheck className="h-6 w-6" />}
              title="The Consultant Shield"
              description="When you trade, you expose yourself. When you hire an AgentPay Consultant, they execute. You just pay the fee."
              delay={0.1}
            />
            <FeatureCard
              icon={<EyeOff className="h-6 w-6" />}
              title="Zero Paper Trail"
              description="Traditional exchanges are honeypots for data brokers. AgentPay executes via ephemeral, one-time payment intents."
              delay={0.2}
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Atomic Sovereignty"
              description="Funds move only when the trade executes. No deposit addresses. No custody. You hold the keys until the very last second."
              delay={0.3}
            />
            <FeatureCard
              icon={<Bot className="h-6 w-6" />}
              title="Agent-First API"
              description="Built for machines, not humans. Clean endpoints, predictable responses, and 402 Payment Required status handling."
              delay={0.4}
            />
            <FeatureCard
              icon={<LineChart className="h-6 w-6" />}
              title="Deep Liquidity Access"
              description="Route directly to Uniswap V4 pools on Base Sepolia. Institutional grade execution without the KYC hurdles."
              delay={0.5}
            />
            <FeatureCard
              icon={<Globe className="h-6 w-6" />}
              title="Permissionless Entry"
              description="The 'Man' isn't watching here. No accounts to ban. No limits to impose. If you can pay the relay fee, you can trade."
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
            <Link href="/terms" className="hover:text-primary transition-colors">/TERMS</Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">/PRIVACY</Link>
            <a href="https://github.com/vedantanand17/AgentPay" className="hover:text-primary transition-colors">/GITHUB</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
