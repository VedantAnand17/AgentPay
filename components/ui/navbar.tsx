"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Terminal } from "lucide-react";

export function Navbar() {
    return (
        <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        >
            <nav className="pointer-events-auto bg-black/80 backdrop-blur-md border border-white/10 flex w-full max-w-5xl items-center justify-between px-6 py-3 mt-2 font-mono">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="h-8 w-8 bg-primary/20 flex items-center justify-center text-primary transition-transform group-hover:bg-primary/30 border border-primary/50">
                        <Terminal className="h-5 w-5" />
                    </div>
                    <span className="text-lg font-bold tracking-tight text-foreground uppercase">AgentPay_Relay</span>
                </Link>

                {/* Links (Desktop) */}
                <div className="hidden md:flex items-center gap-8 text-xs uppercase tracking-wider text-muted-foreground">
                    <Link href="#features" className="hover:text-primary transition-colors">
                        /System
                    </Link>
                    <Link href="#how-it-works" className="hover:text-primary transition-colors">
                        /Protocol
                    </Link>
                    <a href="https://github.com/vedant/AgentPay" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                        /Source
                    </a>
                </div>

                {/* CTA */}
                <div className="flex items-center gap-4">
                    <Button asChild size="sm" className="rounded-none border border-primary bg-primary/10 text-primary hover:bg-primary hover:text-black transition-all font-bold uppercase text-xs tracking-wider">
                        <Link href="/trade">
                            [ Initialize ]
                        </Link>
                    </Button>
                </div>
            </nav>
        </motion.header>
    );
}
