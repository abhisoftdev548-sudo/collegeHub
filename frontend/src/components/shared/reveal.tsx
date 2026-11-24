'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

/**
 * Small entrance transition used sparingly across dashboards.
 * Motion (not GSAP) is reserved for these micro-interactions; GSAP handles the
 * page-level storytelling on the public site.
 */
export const Reveal = ({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    className={cn(className)}
  >
    {children}
  </motion.div>
);
