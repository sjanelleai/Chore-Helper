import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import type { Chore } from "@shared/schema";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface ChoreCardProps {
  chore: Chore;
  onToggle: (id: number) => void;
  isPending: boolean;
}

export function ChoreCard({ chore, onToggle, isPending }: ChoreCardProps) {
  
  const handleToggle = () => {
    if (!chore.completed) {
      // Trigger confetti on completion
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#3b82f6', '#8b5cf6', '#fbbf24'] // Primary, Secondary, Accent colors
      });
    }
    onToggle(chore.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 transition-all duration-300 gamified-button group",
        chore.completed 
          ? "bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-900/50" 
          : "bg-card border-border hover:border-primary/50 hover:shadow-lg shadow-sm"
      )}
    >
      <button
        onClick={handleToggle}
        disabled={isPending}
        className="w-full text-left p-4 flex items-center gap-4"
      >
        {/* Checkbox circle */}
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-300 shrink-0",
          chore.completed
            ? "bg-green-500 border-green-500 scale-110"
            : "bg-background border-muted group-hover:border-primary/50"
        )}>
          {isPending ? (
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          ) : chore.completed ? (
            <Check className="w-7 h-7 text-white stroke-[3px]" />
          ) : (
            <div className="w-4 h-4 rounded-full bg-muted group-hover:bg-primary/20 transition-colors" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{chore.icon}</span>
            <h3 className={cn(
              "font-display text-lg font-bold truncate transition-all",
              chore.completed ? "text-muted-foreground line-through decoration-2 decoration-green-500/50" : "text-foreground"
            )}>
              {chore.name}
            </h3>
          </div>
          <p className="text-sm font-medium text-muted-foreground mt-0.5 ml-1">
             {chore.completed ? "Completed!" : `Earn ${chore.points} points`}
          </p>
        </div>

        {/* Points Badge */}
        {!chore.completed && (
          <div className="bg-accent text-accent-foreground font-mono font-bold px-3 py-1 rounded-full text-sm shadow-sm border border-accent/20">
            +{chore.points}
          </div>
        )}
      </button>

      {/* Progress bar background effect */}
      {chore.completed && (
        <motion.div
          layoutId={`progress-${chore.id}`}
          className="absolute bottom-0 left-0 h-1 bg-green-500"
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
        />
      )}
    </motion.div>
  );
}
