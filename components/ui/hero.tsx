"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import { Terminal, Cpu, Activity, ArrowRight, ShieldCheck, Zap } from "lucide-react";

export function Hero() {
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2,
            },
        },
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 50 } },
    } as const;

    return (
        <section className="relative pt-32 pb-24 md:pt-48 md:pb-36 overflow-hidden border-b border-border/40 bg-background">
            {/* Background Elements - Terminal/Cyberpunk */}
            <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden select-none">
                <div className="absolute inset-0 bg-grid-small-white/[0.05] [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]" />
                
                {/* Scanline Effect Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[1] opacity-20 pointer-events-none bg-[length:100%_2px,3px_100%]" />

                {/* Glows */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/10 blur-[120px] rounded-full mix-blend-screen opacity-30" />
            </div>

            <div className="container max-w-6xl mx-auto px-4 relative z-10">
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="flex flex-col items-center text-center space-y-8"
                >
                    {/* Capacity Meter / Scarcity */}
                    <motion.div variants={item}>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-red-500/50 bg-red-950/30 text-red-400 font-mono text-xs tracking-wider uppercase">
                            <Activity className="h-3 w-3 animate-pulse" />
                            <span>System Load: 98%</span>
                            <span className="w-px h-3 bg-red-500/50 mx-1" />
                            <span>Capacity Limited</span>
                        </div>
                    </motion.div>

                    {/* Main Headline */}
                    <motion.h1
                        variants={item}
                        className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-balance max-w-5xl leading-tight font-mono uppercase"
                    >
                        Biological Trading <br />
                        <span className="text-primary terminal-cursor">Is Obsolete</span>
                    </motion.h1>

                    {/* Subtext */}
                    <motion.p
                        variants={item}
                        className="text-lg md:text-xl text-muted-foreground text-balance max-w-2xl font-mono"
                    >
                        Stop trading like a human. You are the bottleneck.
                        <br className="hidden md:block" />
                        Deploy <span className="text-primary">x402-native AI Agents</span>. Let the code settle the deal.
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div variants={item} className="flex flex-col sm:flex-row items-center gap-5 pt-6 w-full sm:w-auto">
                        <Button asChild size="lg" className="h-14 px-8 w-full sm:w-auto rounded-none border border-primary bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 font-mono text-lg uppercase tracking-wider group relative overflow-hidden">
                            <Link href="/trade">
                                <span className="relative z-10 flex items-center gap-2">
                                    <Terminal className="w-5 h-5" />
                                    Initialize Agent
                                </span>
                                <div className="absolute inset-0 bg-primary/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                            </Link>
                        </Button>
                        
                        <Button asChild variant="outline" size="lg" className="h-14 px-8 w-full sm:w-auto rounded-none border-white/10 hover:bg-white/5 hover:text-white transition-all duration-300 font-mono text-lg uppercase tracking-wider">
                            <a href="#how-it-works">
                                Read Protocol
                            </a>
                        </Button>
                    </motion.div>

                    {/* Stats / Data Stream Decor */}
                    <motion.div variants={item} className="pt-16 w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono text-muted-foreground/60">
                        <div className="border border-white/5 bg-black/40 p-4 flex flex-col gap-2">
                            <span className="uppercase tracking-widest text-[10px] text-muted-foreground">Active Agents</span>
                            <span className="text-xl text-white font-bold flex items-center justify-center gap-2">
                                4,291 <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            </span>
                        </div>
                        <div className="border border-white/5 bg-black/40 p-4 flex flex-col gap-2">
                            <span className="uppercase tracking-widest text-[10px] text-muted-foreground">24h Vol (x402)</span>
                            <span className="text-xl text-white font-bold">$12.4M</span>
                        </div>
                        <div className="border border-white/5 bg-black/40 p-4 flex flex-col gap-2">
                            <span className="uppercase tracking-widest text-[10px] text-muted-foreground">Avg Latency</span>
                            <span className="text-xl text-white font-bold">12ms</span>
                        </div>
                        <div className="border border-white/5 bg-black/40 p-4 flex flex-col gap-2">
                            <span className="uppercase tracking-widest text-[10px] text-muted-foreground">Network Status</span>
                            <span className="text-xl text-primary font-bold uppercase">Operational</span>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}
