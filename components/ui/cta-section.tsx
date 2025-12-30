"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Lock, ArrowRight, ShieldCheck, Terminal, Zap } from "lucide-react";
import Link from "next/link";

export function CTASection() {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden bg-black text-white border-t border-white/10 font-mono">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-small-white/[0.03]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 blur-[150px] rounded-full" />
      </div>

      <div className="container max-w-4xl mx-auto px-4 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 border border-primary/50 bg-primary/10 text-primary text-xs tracking-wider uppercase mb-8">
            <Zap className="w-4 h-4" />
            System Ready: ACTIVE
          </div>

          <h2 className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight mb-6 text-white uppercase">
            Pay for <span className="text-primary">AI Consultancy</span>.
          </h2>

          <p className="text-muted-foreground text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
            Get expert AI trading recommendations. Then execute trades accordingly. No API keys. No custody. Just pay for the consultancy and trade.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Button asChild size="lg" className="h-16 px-10 rounded-none border border-primary bg-primary/10 text-primary hover:bg-primary hover:text-black transition-all duration-300 text-lg uppercase tracking-wider group">
              <Link className="flex items-center justify-center gap-2" href="/trade">
                <Terminal className="w-5 h-5" />
                Get AI Consultancy
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg" className="h-16 px-10 rounded-none border-white/10 hover:bg-white/5 text-slate-300 hover:text-white transition-all text-lg uppercase tracking-wider">
              <a href="https://github.com/vedantanand17/AgentPay" target="_blank" rel="noopener noreferrer">
                View Source Code
              </a>
            </Button>
          </div>

          <div className="mt-10 flex items-center justify-center gap-2 text-xs text-primary/70 uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4" />
            <span>Protocol Capacity: Available</span>
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
