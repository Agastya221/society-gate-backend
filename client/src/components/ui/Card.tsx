import { motion } from 'framer-motion';
import { cn } from '../../utils/cn'; // I need to create this util if not exists, or I will use clsx/tailwind-merge directly if not. 
// Actually I'll implement clsx/tailwind-merge inline or assume utils exists. 
// Let's create `client/src/lib/utils.ts` first usually? No I'll check if it exists. 
// I'll just use the libraries directly for now to be safe or minimal.

import { ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type CardProps = {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverEffect?: boolean;
};

export function Card({ children, className, onClick, hoverEffect = false }: CardProps) {
  return (
    <motion.div
      whileTap={onClick ? { scale: 0.98 } : undefined}
      whileHover={hoverEffect ? { y: -2 } : undefined}
      onClick={onClick}
      className={cn(
        "bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden",
        hoverEffect && "cursor-pointer hover:shadow-md transition-shadow",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
