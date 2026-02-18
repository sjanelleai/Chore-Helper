import { motion } from "framer-motion";
import { Lock, Coins, Loader2 } from "lucide-react";
import type { Reward } from "@shared/schema";
import { cn } from "@/lib/utils";

interface RewardCardProps {
  reward: Reward;
  userPoints: number;
  onBuy: (id: number) => void;
  isPending: boolean;
}

export function RewardCard({ reward, userPoints, onBuy, isPending }: RewardCardProps) {
  const canAfford = userPoints >= reward.cost;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={cn(
        "flex flex-col rounded-2xl border-2 p-5 bg-card relative overflow-hidden transition-all",
        !canAfford && "opacity-80 grayscale-[0.5]",
        canAfford ? "border-secondary/20 hover:border-secondary shadow-sm hover:shadow-xl" : "border-border"
      )}
    >
      <div className="text-4xl mb-4 bg-secondary/10 w-16 h-16 rounded-2xl flex items-center justify-center self-center">
        {reward.icon || "🎁"}
      </div>
      
      <div className="text-center mb-4 flex-1">
        <h3 className="font-display font-bold text-lg text-foreground leading-tight mb-1">
          {reward.name}
        </h3>
        <div className="inline-flex items-center gap-1.5 bg-background px-2 py-1 rounded-md border border-border/50 shadow-sm mt-2">
          <Coins className="w-3.5 h-3.5 text-accent" />
          <span className={cn(
            "font-mono font-bold text-sm",
            canAfford ? "text-foreground" : "text-destructive"
          )}>
            {reward.cost}
          </span>
        </div>
      </div>

      <button
        onClick={() => onBuy(reward.id)}
        disabled={!canAfford || isPending}
        className={cn(
          "w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-200 gamified-button",
          canAfford 
            ? "bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-lg shadow-secondary/25" 
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
      >
        {isPending ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : !canAfford ? (
          <>
            <Lock className="w-4 h-4" />
            <span>Need {reward.cost - userPoints} more</span>
          </>
        ) : (
          "Buy Now"
        )}
      </button>
    </motion.div>
  );
}
