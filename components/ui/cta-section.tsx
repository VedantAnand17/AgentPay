"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Lock, ArrowRight, ShieldAlert, Terminal } from "lucide-react";
import Link from "next/link";

export function CTASection() {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden bg-black text-white border-t border-white/10">
      {/* Dark/Gritty Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-small-white/[0.05]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-red-500/10 blur-[150px] rounded-full animate-pulse-slow" />
      </div>
      
      <div className="container max-w-4xl mx-auto px-4 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 border border-red-500/50 bg-red-950/30 text-red-500 text-xs font-mono tracking-wider uppercase mb-8">
            <ShieldAlert className="w-4 h-4" />
            Exposure Risk: HIGH
          </div>
          
          <h2 className="text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight mb-6 text-white font-mono uppercase">
            Stop Leaving <span className="text-red-500">Fingerprints</span>.
          </h2>
          
          <p className="text-muted-foreground text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed font-mono">
            Every second you wait, another log file captures your data. The network is filling up. Secure your channel before the gates close.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Button asChild size="lg" className="h-16 px-10 rounded-none border border-primary bg-primary/10 text-primary hover:bg-primary hover:text-black transition-all duration-300 font-mono text-lg uppercase tracking-wider group">
              <Link className="flex items-center justify-center gap-2" href="/trade">
                <Terminal className="w-5 h-5" />
                Initialize Agent
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            
            <Button asChild variant="outline" size="lg" className="h-16 px-10 rounded-none border-white/10 hover:bg-white/5 text-slate-300 hover:text-white transition-all font-mono text-lg uppercase tracking-wider">
              <a href="https://github.com/vedant/AgentPay" target="_blank" rel="noopener noreferrer">
                View Source Code
              </a>
            </Button>
          </div>
          
          <p className="mt-8 text-xs text-red-500/80 font-mono uppercase tracking-widest animate-pulse">
            * Protocol Capacity: 98% Full
          </p>
        </motion.div>
      </div>
    </section>
  );
}
