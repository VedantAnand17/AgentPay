"use client";

import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface FeatureCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    delay?: number;
}

export function FeatureCard({ icon, title, description, delay = 0 }: FeatureCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay }}
            viewport={{ once: true }}
            whileHover={{ y: -4 }}
            className="glass-card p-6 lg:p-8 rounded-none border border-white/5 hover:border-primary/50 flex flex-col items-start gap-4 group cursor-default h-full relative overflow-hidden"
        >
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/20 group-hover:border-primary transition-colors" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/20 group-hover:border-primary transition-colors" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/20 group-hover:border-primary transition-colors" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/20 group-hover:border-primary transition-colors" />

            <div className="h-14 w-14 rounded-none bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-black transition-all duration-300">
                {icon}
            </div>
            <h3 className="text-xl lg:text-2xl font-semibold tracking-tight font-mono uppercase group-hover:text-primary transition-colors">{title}</h3>
            <p className="text-muted-foreground leading-relaxed text-sm lg:text-base font-mono">
                {description}
            </p>
        </motion.div>
    );
}
