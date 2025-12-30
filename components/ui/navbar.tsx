"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Menu, X } from "lucide-react";

export function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const pathname = usePathname();
    const isOnTradePage = pathname === "/trade";

    // Close menu on route change
    useEffect(() => {
        setIsMenuOpen(false);
    }, [pathname]);

    return (
        <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        >
            <nav className="pointer-events-auto bg-black/80 backdrop-blur-md border border-white/10 flex w-full max-w-5xl items-center justify-between px-4 md:px-6 py-3 mt-2 font-mono">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="h-8 w-8 bg-primary/20 flex items-center justify-center text-primary transition-transform group-hover:bg-primary/30 border border-primary/50">
                        <Terminal className="h-5 w-5" />
                    </div>
                    <span className="text-lg font-bold tracking-tight text-foreground uppercase">AgentPay_Relay</span>
                </Link>

                {/* Links (Desktop) */}
                <div className="hidden md:flex items-center gap-8 text-xs uppercase tracking-wider text-muted-foreground">
                    <Link href="/#features" className="hover:text-primary transition-colors">
                        /System
                    </Link>
                    <Link href="/#how-it-works" className="hover:text-primary transition-colors">
                        /Protocol
                    </Link>
                    <a href="https://github.com/vedantanand17/AgentPay" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                        /Source
                    </a>
                </div>

                {/* CTA + Mobile Menu Toggle */}
                <div className="flex items-center gap-3">
                    {!isOnTradePage && (
                        <Button asChild size="sm" className="hidden sm:flex rounded-none border border-primary bg-primary/10 text-primary hover:bg-primary hover:text-black transition-all font-bold uppercase text-xs tracking-wider">
                            <Link href="/trade">
                                [ Initialize ]
                            </Link>
                        </Button>
                    )}

                    {/* Mobile Menu Toggle */}
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="md:hidden flex items-center justify-center w-10 h-10 border border-white/10 hover:border-primary/50 transition-colors"
                        aria-label="Toggle menu"
                    >
                        {isMenuOpen ? (
                            <X className="w-5 h-5 text-primary" />
                        ) : (
                            <Menu className="w-5 h-5 text-muted-foreground" />
                        )}
                    </button>
                </div>
            </nav>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="pointer-events-auto fixed top-20 left-4 right-4 bg-black/95 backdrop-blur-md border border-white/10 p-4 font-mono md:hidden"
                    >
                        <div className="flex flex-col gap-4">
                            <Link
                                href="/#features"
                                className="text-sm uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors py-2 border-b border-white/5"
                            >
                                /System
                            </Link>
                            <Link
                                href="/#how-it-works"
                                className="text-sm uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors py-2 border-b border-white/5"
                            >
                                /Protocol
                            </Link>
                            <a
                                href="https://github.com/vedantanand17/AgentPay"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors py-2 border-b border-white/5"
                            >
                                /Source
                            </a>
                            {!isOnTradePage && (
                                <Button asChild size="sm" className="mt-2 rounded-none border border-primary bg-primary/10 text-primary hover:bg-primary hover:text-black transition-all font-bold uppercase text-xs tracking-wider">
                                    <Link href="/trade">
                                        [ Initialize ]
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.header>
    );
}
