import { motion } from "framer-motion";
import { Check, Loader2, Clock } from "lucide-react";
import type { EnabledChore } from "@shared/schema";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface ChoreCardProps {
  chore: EnabledChore;
  onToggle: (id: string) => void;
  isPending: boolean;
}

export function ChoreCard({ chore, onToggle, isPending }: ChoreCardProps) {

  const handleToggle = () => {
    if (chore.status === "approved") {
      onToggle(chore.id);
      return;
    }
    if (chore.status === "unchecked") {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#3b82f6', '#8b5cf6', '#fbbf24']
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
        chore.status === "approved"
          ? "bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-900/50"
          : chore.status === "pending"
            ? "bg-yellow-50/50 border-yellow-300 dark:bg-yellow-900/10 dark:border-yellow-700/50"
            : "bg-card border-border hover:border-primary/50 hover:shadow-lg shadow-sm"
      )}
    >
      <button
        onClick={handleToggle}
        disabled={isPending}
        className="w-full text-left p-4 flex items-center gap-4"
        data-testid={`button-chore-${chore.id}`}
      >
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-300 shrink-0",
          chore.status === "approved"
            ? "bg-green-500 border-green-500 scale-110"
            : chore.status === "pending"
              ? "bg-yellow-400 border-yellow-400 scale-105"
              : "bg-background border-muted group-hover:border-primary/50"
        )}>
          {isPending ? (
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          ) : chore.status === "approved" ? (
            <Check className="w-7 h-7 text-white stroke-[3px]" />
          ) : chore.status === "pending" ? (
            <Clock className="w-6 h-6 text-white stroke-[2.5px]" />
          ) : (
            <div className="w-4 h-4 rounded-full bg-muted group-hover:bg-primary/20 transition-colors" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className={cn(
            "font-display text-lg font-bold truncate transition-all",
            chore.status === "approved" ? "text-muted-foreground line-through decoration-2 decoration-green-500/50" : "text-foreground"
          )}>
            {chore.title}
          </h3>
          <p className="text-sm font-medium text-muted-foreground mt-0.5 ml-1">
            {chore.status === "approved"
              ? "Completed!"
              : chore.status === "pending"
                ? "Waiting for parent"
                : `Earn ${chore.points} points`}
          </p>
        </div>

        {chore.status === "pending" && (
          <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-bold px-3 py-1 rounded-full text-xs shadow-sm border border-yellow-300/50 dark:border-yellow-700/50" data-testid={`badge-pending-${chore.id}`}>
            Pending
          </div>
        )}

        {chore.status === "unchecked" && (
          <div className="bg-accent text-accent-foreground font-mono font-bold px-3 py-1 rounded-full text-sm shadow-sm border border-accent/20">
            +{chore.points}
          </div>
        )}
      </button>

      {chore.status === "approved" && (
        <motion.div
          layoutId={`progress-${chore.id}`}
          className="absolute bottom-0 left-0 h-1 bg-green-500"
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
        />
      )}

      {chore.status === "pending" && (
        <motion.div
          className="absolute bottom-0 left-0 h-1 bg-yellow-400"
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
        />
      )}
    </motion.div>
  );
}
