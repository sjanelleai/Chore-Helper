import { useBadges, usePurchases } from "@/hooks/use-data";
import { Navigation } from "@/components/Navigation";
import { Header } from "@/components/Header";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Medal, Star, Trophy, Crown, History, Lock } from "lucide-react";

const BADGE_ICONS: Record<string, typeof Medal> = {
  medal_bronze: Medal,
  medal_silver: Medal,
  medal_gold: Medal,
  star: Star,
  trophy: Trophy,
  crown: Crown,
};

const BADGE_COLORS: Record<string, string> = {
  medal_bronze: "text-orange-600 dark:text-orange-400",
  medal_silver: "text-slate-400 dark:text-slate-300",
  medal_gold: "text-yellow-500 dark:text-yellow-400",
  star: "text-yellow-500 dark:text-yellow-400",
  trophy: "text-amber-600 dark:text-amber-400",
  crown: "text-purple-500 dark:text-purple-400",
};

export default function Badges() {
  const { data: badges } = useBadges();
  const { data: purchases } = usePurchases();

  const earnedBadges = badges?.filter(b => b.earned) || [];

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header title="My Achievements" />

      <div className="max-w-md mx-auto px-4 pt-6 space-y-8">
        
        <section>
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h2 className="font-display font-bold text-xl flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent" />
              Badges
            </h2>
            <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
              {earnedBadges.length} / {badges?.length}
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {badges?.map((badge) => {
              const IconComponent = BADGE_ICONS[badge.icon] || Star;
              const colorClass = BADGE_COLORS[badge.icon] || "text-accent";

              return (
                <motion.div
                  key={badge.id}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={cn(
                    "aspect-square rounded-2xl p-3 flex flex-col items-center justify-center text-center gap-2 border-2 transition-all relative overflow-hidden group",
                    badge.earned 
                      ? "bg-accent/10 border-accent/30 shadow-sm" 
                      : "bg-muted/30 border-dashed border-border"
                  )}
                  data-testid={`card-badge-${badge.id}`}
                >
                  <div className={cn(
                    "transition-all duration-300",
                    !badge.earned && "grayscale opacity-50"
                  )}>
                    <IconComponent className={cn("w-8 h-8", badge.earned ? colorClass : "text-muted-foreground")} />
                  </div>
                  <p className={cn(
                    "text-[10px] font-bold leading-tight line-clamp-2",
                    badge.earned ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {badge.name}
                  </p>

                  {!badge.earned && (
                    <div className="absolute inset-0 bg-background/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-foreground text-background text-[10px] px-2 py-1 rounded-full font-bold">
                        {badge.threshold} pts
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="font-display font-bold text-xl mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-secondary" />
            History
          </h2>
          
          {purchases?.length === 0 ? (
            <div className="text-center p-8 bg-muted/20 rounded-2xl border border-dashed border-muted-foreground/20">
              <p className="text-muted-foreground text-sm">No purchases yet. Start earning points!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {purchases?.map((purchase) => (
                <div key={purchase.id} className="flex items-center justify-between gap-2 p-4 bg-card border rounded-xl shadow-sm">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{purchase.reward_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(purchase.purchased_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="font-mono text-sm font-bold text-destructive shrink-0">
                    -{purchase.cost} pts
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
      <Navigation />
    </div>
  );
}
