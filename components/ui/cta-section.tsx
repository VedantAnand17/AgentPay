"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Lock, ArrowRight } from "lucide-react";
import Link from "next/link";

export function CTASection() {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-emerald-500/10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/5 blur-[120px] rounded-full" />
      </div>
      <div className="container max-w-4xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Lock className="w-4 h-4" />
            Ready to Start
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Experience the Future of DeFi Trading
          </h2>
          <p className="text-muted-foreground text-lg md:text-xl mb-8 max-w-2xl mx-auto">
            Join the revolution in decentralized finance. Execute trades with AI agents, powered by secure x402 payments.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="h-14 px-8 rounded-full text-lg shadow-lg shadow-primary/25">
              <Link className="flex items-center justify-center gap-2 group" href="/trade">
                Launch Trade Console
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-14 px-8 rounded-full text-lg">
              <a href="https://github.com/vedant/AgentPay" target="_blank" rel="noopener noreferrer">
                View Documentation
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
