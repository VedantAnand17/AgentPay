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
            className="glass-card p-6 lg:p-8 rounded-2xl flex flex-col items-start gap-4 group cursor-default h-full"
        >
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                {icon}
            </div>
            <h3 className="text-xl lg:text-2xl font-semibold tracking-tight group-hover:text-primary transition-colors">{title}</h3>
            <p className="text-muted-foreground leading-relaxed text-sm lg:text-base">
                {description}
            </p>
        </motion.div>
    );
}
