"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Zap, Shield, Globe } from "lucide-react";

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
        hidden: { opacity: 0, y: 30 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 50 } },
    } as const;

    return (
        <section className="relative pt-32 pb-24 md:pt-48 md:pb-36 overflow-hidden">
            {/* Background Elements - Premium Refinement */}
            <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden select-none">
                <div className="absolute inset-0 bg-grid-small-black/[0.1] dark:bg-grid-small-white/[0.05] [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]" />

                {/* Animated Orbs */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/15 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-screen opacity-15 animate-pulse-subtle" />
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/8 blur-[120px] rounded-full opacity-20 animate-float" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-400/8 blur-[100px] rounded-full opacity-20 animate-float [animation-delay:2s]" />
            </div>

            <div className="container max-w-6xl mx-auto px-4 relative z-10">
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="flex flex-col items-center text-center space-y-10"
                >
                    {/* Badge Pill - Glowing Effect */}
                    <motion.div variants={item}>
                        <div className="group relative inline-flex items-center rounded-full border border-primary/20 bg-background/50 backdrop-blur-sm px-4 py-1.5 text-sm font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 overflow-hidden">
                            <span className="absolute inset-0 -z-10 animate-shimmer bg-gradient-to-r from-transparent via-primary/10 to-transparent bg-[length:200%_100%] rounded-full" />
                            <Zap className="mr-2 h-3.5 w-3.5 text-primary animate-pulse relative z-0" />
                            <span className="mr-2 relative z-0">AI-Powered DeFi Execution</span>
                            <span className="h-4 w-[1px] bg-border mx-2 relative z-0" />
                            <span className="text-muted-foreground group-hover:text-primary transition-colors relative z-0">v1.0 Live</span>
                        </div>
                    </motion.div>

                    {/* Main Headline */}
                    <motion.h1
                        variants={item}
                        className="text-5xl md:text-7xl lg:text-8xl font-heading font-bold tracking-tight text-balance max-w-5xl leading-[1.1]"
                    >
                        Trades Executed by UI <br className="hidden md:block" />
                        <span className="bg-gradient-hero-text">
                            Settled by Agents
                        </span>
                    </motion.h1>

                    <motion.p
                        variants={item}
                        className="text-lg md:text-xl text-muted-foreground text-balance max-w-2xl font-light leading-relaxed"
                    >
                        Experience the future of decentralized finance. Execute AI-powered spot trades on Uniswap with instant <span className="text-foreground font-medium">x402</span> payments.
                        <br className="hidden sm:block" /> No API keys required. Non-custodial. Secure.
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div variants={item} className="flex flex-col sm:flex-row items-center gap-6 pt-4">
                        <Button asChild size="lg" className="h-14 px-8 rounded-full text-lg shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)] hover:shadow-[0_0_60px_-15px_rgba(16,185,129,0.5)] hover:-translate-y-1 transition-all duration-300 bg-primary hover:bg-primary/90">
                            <Link href="/trade" className="flex items-center gap-2 group">
                                Start Trading
                                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </Button>
                        <Button asChild variant="outline" size="lg" className="h-14 px-8 rounded-full text-lg bg-background/30 backdrop-blur-md border-white/20 dark:border-white/10 hover:bg-background/50 hover:border-foreground/20 transition-all duration-300">
                            <a href="https://github.com/vedant/AgentPay" target="_blank">
                                View on GitHub
                            </a>
                        </Button>
                    </motion.div>

                    {/* Trust Indicators - Refined */}
                    <motion.div variants={item} className="pt-16 grid grid-cols-2 md:grid-cols-3 gap-x-12 gap-y-8 text-sm text-muted-foreground">
                        <div className="flex flex-col items-center gap-2 group">
                            <div className="p-3 rounded-2xl bg-primary/5 group-hover:bg-primary/10 transition-colors">
                                <Shield className="h-6 w-6 text-primary" />
                            </div>
                            <span className="font-medium text-foreground">Non-Custodial</span>
                            <span className="text-xs text-muted-foreground/80">You hold your keys</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 group">
                            <div className="p-3 rounded-2xl bg-primary/5 group-hover:bg-primary/10 transition-colors">
                                <Zap className="h-6 w-6 text-primary" />
                            </div>
                            <span className="font-medium text-foreground">Instant Settlement</span>
                            <span className="text-xs text-muted-foreground/80">Lightning fast execution</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 group col-span-2 md:col-span-1">
                            <div className="p-3 rounded-2xl bg-primary/5 group-hover:bg-primary/10 transition-colors">
                                <Globe className="h-6 w-6 text-primary" />
                            </div>
                            <span className="font-medium text-foreground">x402 Standard</span>
                            <span className="text-xs text-muted-foreground/80">Universal Payment Protocol</span>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}
