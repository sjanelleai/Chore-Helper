import { useRewards, useUserState, useBuyReward } from "@/hooks/use-data";
import { RewardCard } from "@/components/RewardCard";
import { Navigation } from "@/components/Navigation";
import { Header } from "@/components/Header";
import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";

export default function Rewards() {
  const { data: rewards, isLoading } = useRewards();
  const { data: user } = useUserState();
  const buyMutation = useBuyReward();

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header title="Reward Store" showPoints={true} />
      
      <div className="max-w-md mx-auto px-4 pt-6">
        <div className="bg-secondary/10 border border-secondary/20 rounded-2xl p-6 mb-8 text-center">
          <p className="text-sm font-bold text-secondary uppercase tracking-wider mb-1">Current Balance</p>
          <p className="text-4xl font-black font-mono text-foreground">{user?.totalPoints || 0} pts</p>
        </div>

        <h2 className="font-display font-bold text-xl mb-4 flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-primary" />
          Available Rewards
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 bg-muted/20 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {rewards?.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                userPoints={user?.totalPoints || 0}
                onBuy={(id) => buyMutation.mutate(id)}
                isPending={buyMutation.isPending && buyMutation.variables === reward.id}
              />
            ))}
          </div>
        )}
      </div>
      <Navigation />
    </div>
  );
}
