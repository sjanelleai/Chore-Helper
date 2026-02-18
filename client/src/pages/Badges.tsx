import { useBadges, usePurchases } from "@/hooks/use-data";
import { Navigation } from "@/components/Navigation";
import { Header } from "@/components/Header";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Star, History, Lock, Trophy } from "lucide-react";

export default function Badges() {
  const { data: badges } = useBadges();
  const { data: purchases } = usePurchases();

  // Separate earned and unearned badges
  const earnedBadges = badges?.filter(b => b.earned) || [];
  const lockedBadges = badges?.filter(b => !b.earned) || [];

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header title="My Achievements" />

      <div className="max-w-md mx-auto px-4 pt-6 space-y-8">
        
        {/* Badges Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-xl flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent" />
              Badges
            </h2>
            <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
              {earnedBadges.length} / {badges?.length}
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {badges?.map((badge) => (
              <motion.div
                key={badge.id}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                className={cn(
                  "aspect-square rounded-2xl p-3 flex flex-col items-center justify-center text-center gap-2 border-2 transition-all cursor-pointer relative overflow-hidden group",
                  badge.earned 
                    ? "bg-accent/10 border-accent/30 shadow-sm" 
                    : "bg-muted/30 border-dashed border-border"
                )}
              >
                <div className={cn(
                  "text-3xl transition-all duration-300",
                  !badge.earned && "grayscale opacity-50 blur-[1px]"
                )}>
                  {badge.icon}
                </div>
                <p className={cn(
                  "text-[10px] font-bold leading-tight line-clamp-2",
                  badge.earned ? "text-foreground" : "text-muted-foreground"
                )}>
                  {badge.name}
                </p>

                {!badge.earned && (
                  <div className="absolute inset-0 bg-background/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]">
                    <div className="bg-foreground text-background text-[10px] px-2 py-1 rounded-full font-bold">
                      {badge.threshold} pts
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </section>

        {/* Purchase History */}
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
                <div key={purchase.id} className="flex items-center justify-between p-4 bg-card border rounded-xl shadow-sm">
                  <div>
                    <p className="font-bold text-foreground">{purchase.rewardName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(purchase.purchasedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="font-mono text-sm font-bold text-destructive">
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
