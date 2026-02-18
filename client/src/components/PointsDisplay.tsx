import { useUserState } from "@/hooks/use-data";
import { motion, AnimatePresence } from "framer-motion";
import { Coins } from "lucide-react";

export function PointsDisplay({ compact = false }: { compact?: boolean }) {
  const { data: user } = useUserState();
  const points = user?.totalPoints || 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2 bg-accent/20 px-3 py-1.5 rounded-full border border-accent/30">
        <Coins className="w-4 h-4 text-accent-foreground" />
        <span className="font-bold text-accent-foreground font-mono">{points}</span>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="relative group cursor-pointer"
    >
      <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full transform group-hover:scale-110 transition-transform duration-500" />
      <div className="relative bg-background border-4 border-accent rounded-3xl p-6 shadow-xl flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mb-2 shadow-inner">
          <Coins className="w-8 h-8 text-accent-foreground" />
        </div>
        <h3 className="text-muted-foreground font-display text-lg uppercase tracking-wider">Total Points</h3>
        <AnimatePresence mode="popLayout">
          <motion.div
            key={points}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="text-6xl font-black text-foreground font-mono tracking-tight"
          >
            {points}
          </motion.div>
        </AnimatePresence>
        <p className="text-sm text-muted-foreground mt-2 font-medium">Keep it up, superstar!</p>
      </div>
    </motion.div>
  );
}
