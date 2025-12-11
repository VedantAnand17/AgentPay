"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function Navbar() {
    return (
        <motion.header
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center p-4"
        >
            <nav className="glass flex w-full max-w-5xl items-center justify-between rounded-full px-6 py-3">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                        A
                    </div>
                    <span className="text-lg font-bold tracking-tight">AgentPay</span>
                </Link>

                {/* Links (Desktop) */}
                <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
                    <Link href="#features" className="hover:text-foreground transition-colors">
                        Features
                    </Link>
                    <Link href="#how-it-works" className="hover:text-foreground transition-colors">
                        How it Works
                    </Link>
                    <a href="https://github.com/vedant/AgentPay" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                        GitHub
                    </a>
                </div>

                {/* CTA */}
                <div className="flex items-center gap-4">
                    <Button asChild size="sm" className="rounded-full px-6">
                        <Link href="/trade">
                            Launch Console
                        </Link>
                    </Button>
                </div>
            </nav>
        </motion.header>
    );
}
