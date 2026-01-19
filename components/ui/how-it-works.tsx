"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Wallet, Bot, Zap, ArrowRight, Lock, Key, Brain, Terminal } from "lucide-react";
import Link from "next/link";

const steps = [
  {
    number: "01",
    title: "Pay for AI Consultancy",
    description: "Connect your wallet and pay for expert AI trading recommendations. One-time payment. No subscriptions. No commitments.",
    icon: Wallet,
  },
  {
    number: "02",
    title: "Get AI Recommendations",
    description: "Our AI analyzes market conditions and provides actionable trading insights. You get the strategy, not just the execution.",
    icon: Bot,
  },
  {
    number: "03",
    title: "Trade Accordingly",
    description: "Execute trades based on AI recommendations. One-time payment authorization. Clean execution. No keys left behind.",
    icon: Zap,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 relative overflow-hidden font-mono">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-primary/5 to-background" />
      <div className="absolute inset-0 -z-10 bg-grid-small-white/[0.03]" />
      <div className="container max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 border border-primary/50 bg-primary/10 text-primary text-xs font-mono uppercase tracking-wider mb-6">
            <Lock className="w-3 h-3" />
            Protocol: SECURE
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 uppercase">
            AI Consultancy First, <span className="text-primary">Then Trade</span>
          </h2>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
            Pay for expert AI insights. Get actionable recommendations. Execute trades accordingly. Simple.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 relative">
          {/* Connection Line */}
          <div className="hidden md:block absolute top-14 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative group"
              >
                <div className="bg-black/60 backdrop-blur-sm border border-white/10 p-8 hover:border-primary/50 transition-all duration-300 hover:bg-black/80 h-full relative overflow-hidden">
                  {/* Corner decorations */}
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/20 group-hover:border-primary transition-colors" />
                  <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/20 group-hover:border-primary transition-colors" />
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/20 group-hover:border-primary transition-colors" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/20 group-hover:border-primary transition-colors" />

                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-shrink-0 w-14 h-14 bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-lg group-hover:bg-primary group-hover:text-black transition-all">
                      {step.number}
                    </div>
                    <div className="w-12 h-12 bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-primary/30 transition-colors">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-3 uppercase tracking-wide group-hover:text-primary transition-colors">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm">{step.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-12"
        >
          <Button asChild size="lg" className="h-14 px-8 rounded-none border border-primary bg-primary/10 text-primary hover:shadow-[0_0_30px_-5px_hsl(var(--primary))] hover:border-primary/80 hover:text-green-300 transition-all font-mono text-lg uppercase tracking-wider group">
            <Link className="flex items-center justify-center gap-2" href="/trade">
              <Terminal className="w-5 h-5" />
              Get AI Consultancy
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
