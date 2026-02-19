import { useState } from "react";
import { useRewards, useUserState, useRedeemReward } from "@/hooks/use-data";
import { RewardCard } from "@/components/RewardCard";
import { Navigation } from "@/components/Navigation";
import { Header } from "@/components/Header";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Rewards() {
  const { data: rewards, isLoading } = useRewards();
  const { data: user } = useUserState();
  const redeemMutation = useRedeemReward();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = rewards ? Array.from(new Set(rewards.map(r => r.category))) : [];

  const filteredRewards = selectedCategory === "all"
    ? rewards
    : rewards?.filter(r => r.category === selectedCategory);

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header title="Reward Store" showPoints={true} />

      <div className="max-w-md mx-auto px-4 pt-6">
        <div className="bg-secondary/10 border border-secondary/20 rounded-2xl p-6 mb-6 text-center">
          <p className="text-sm font-bold text-secondary uppercase tracking-wider mb-1" data-testid="text-balance-label">Current Balance</p>
          <p className="text-4xl font-black font-mono text-foreground" data-testid="text-balance-value">{user?.totalPoints || 0} pts</p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory("all")}
            className={cn(
              "px-3 py-1.5 rounded-full whitespace-nowrap font-bold text-xs transition-all border-2",
              selectedCategory === "all"
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border"
            )}
            data-testid="button-category-all"
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-full whitespace-nowrap font-bold text-xs transition-all border-2",
                selectedCategory === cat
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border"
              )}
              data-testid={`button-filter-${cat}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 bg-muted/20 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : !filteredRewards || filteredRewards.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-muted rounded-full mx-auto flex items-center justify-center mb-4">
              <Sparkles className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-display font-bold text-xl text-foreground">No rewards available</h3>
            <p className="text-muted-foreground text-sm mt-1">Ask a parent to enable some rewards!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredRewards.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                userPoints={user?.totalPoints || 0}
                onRedeem={(id) => redeemMutation.mutate(id)}
                isPending={redeemMutation.isPending && redeemMutation.variables === reward.id}
              />
            ))}
          </div>
        )}
      </div>
      <Navigation />
    </div>
  );
}
