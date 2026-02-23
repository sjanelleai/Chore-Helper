import { useState } from "react";
import { useModeRewards, useModeRedeemReward, useModeChildPoints } from "@/hooks/use-mode-data";
import { RewardCard } from "@/components/RewardCard";
import { Header } from "@/components/Header";
import { Sparkles, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

export default function Rewards() {
  const { catalogSeedError, retryCatalogSeed } = useAuth();
  const { data: rewards, isLoading } = useModeRewards();
  const { data: pts } = useModeChildPoints();
  const redeemMutation = useModeRedeemReward();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [retrying, setRetrying] = useState(false);

  const userPoints = pts?.points ?? 0;
  const categories = rewards ? Array.from(new Set(rewards.map(r => r.category))) : [];

  const filteredRewards = selectedCategory === "all"
    ? rewards
    : rewards?.filter(r => r.category === selectedCategory);

  return (
    <div className="min-h-screen bg-background">
      <Header title="Reward Store" showPoints={true} />

      <div className="max-w-md md:max-w-2xl mx-auto px-4 pt-6">
        <div className="bg-secondary/10 border border-secondary/20 rounded-2xl p-6 mb-6 text-center">
          <p className="text-sm font-bold text-secondary uppercase tracking-wider mb-1" data-testid="text-balance-label">Current Balance</p>
          <p className="text-4xl font-black font-mono text-foreground" data-testid="text-balance-value">{userPoints} pts</p>
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

        {catalogSeedError ? (
          <div className="text-center py-12" data-testid="catalog-seed-error">
            <div className="w-24 h-24 bg-destructive/10 rounded-full mx-auto flex items-center justify-center mb-4">
              <AlertTriangle className="w-10 h-10 text-destructive" />
            </div>
            <h3 className="font-display font-bold text-xl text-foreground mb-2">Couldn't load rewards</h3>
            <p className="text-muted-foreground text-sm mb-4 max-w-xs mx-auto">{catalogSeedError}</p>
            <button
              onClick={async () => { setRetrying(true); await retryCatalogSeed(); setRetrying(false); }}
              disabled={retrying}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              data-testid="button-retry-seed"
            >
              <RefreshCw className={cn("w-4 h-4", retrying && "animate-spin")} />
              {retrying ? "Retrying..." : "Retry"}
            </button>
          </div>
        ) : isLoading ? (
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
                userPoints={userPoints}
                onRedeem={(id) => redeemMutation.mutate(id)}
                isPending={redeemMutation.isPending && redeemMutation.variables === reward.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
