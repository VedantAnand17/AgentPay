"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function Navbar() {
    return (
        <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        >
            <nav className="pointer-events-auto glass flex w-fit items-center gap-12 rounded-full px-6 py-2.5 mt-2">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl transition-transform group-hover:scale-105 shadow-md shadow-primary/20">
                        A
                    </div>
                    <span className="text-lg font-heading font-bold tracking-tight text-foreground">AgentPay</span>
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
                    <Button asChild size="sm" className="rounded-full px-6 font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                        <Link href="/trade">
                            Launch Console
                        </Link>
                    </Button>
                </div>
            </nav>
        </motion.header>
    );
}
