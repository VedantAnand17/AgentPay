"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Zap, Shield } from "lucide-react";

export function Hero() {
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 },
    };

    return (
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/20 blur-[100px] rounded-full mix-blend-multiply opacity-50 animate-pulse" />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-500/20 blur-[100px] rounded-full mix-blend-multiply opacity-50" />
            </div>

            <div className="container max-w-6xl mx-auto px-4">
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="flex flex-col items-center text-center space-y-8"
                >
                    <motion.div variants={item}>
                        <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                            <Zap className="mr-2 h-3.5 w-3.5" />
                            AI-Powered DeFi Execution
                        </span>
                    </motion.div>

                    <motion.h1
                        variants={item}
                        className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-balance max-w-4xl"
                    >
                        Trades Executed by UI <br />
                        <span className="text-transparent bg-clip-text bg-gradient-hero">
                            Settled by Agents
                        </span>
                    </motion.h1>

                    <motion.p
                        variants={item}
                        className="text-lg md:text-xl text-muted-foreground text-balance max-w-2xl"
                    >
                        Execute AI-powered spot trades on Uniswap with one-time x402 payments.
                        No API keys required. Non-custodial. Secure.
                    </motion.p>

                    <motion.div variants={item} className="flex flex-col sm:flex-row items-center gap-4">
                        <Button asChild size="lg" className="h-12 px-8 rounded-full text-lg shadow-lg shadow-primary/20">
                            <Link href="/trade">
                                Start Trading <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                        <Button asChild variant="outline" size="lg" className="h-12 px-8 rounded-full text-lg bg-background/50 backdrop-blur-sm">
                            <a href="https://github.com/vedant/AgentPay" target="_blank">
                                View on GitHub
                            </a>
                        </Button>
                    </motion.div>

                    {/* Mini Stats/Trust Indicators */}
                    <motion.div variants={item} className="pt-12 grid grid-cols-2 md:grid-cols-3 gap-8 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            <span>Non-Custodial</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-primary" />
                            <span>Instant Settlement</span>
                        </div>
                        <div className="flex items-center gap-2 col-span-2 md:col-span-1 justify-center md:justify-start">
                            <span className="font-bold text-foreground">x402</span>
                            <span>Payment Standard</span>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}
