import { Link } from "wouter";
import { useUserState, useChores, useResetChores } from "@/hooks/use-data";
import { useAuth } from "@/lib/auth-context";
import { PointsDisplay } from "@/components/PointsDisplay";
import { Navigation } from "@/components/Navigation";
import { motion } from "framer-motion";
import { CheckSquare, ShoppingBag, RotateCcw, Shield, Users } from "lucide-react";

export default function Home() {
  const { data: user } = useUserState();
  const { data: chores } = useChores();
  const resetMutation = useResetChores();
  const { activeChild, clearChild } = useAuth();

  const pendingChores = chores?.filter(c => !c.completed).length || 0;

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-md mx-auto pt-8 px-4">
        <div className="flex items-center justify-between gap-2 mb-8 flex-wrap">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-greeting">
              Hi, {activeChild?.displayName || "Champion"}!
            </h1>
            <p className="text-muted-foreground font-medium">Ready to earn some points?</p>
          </div>
        </div>

        <div className="mb-10">
          <PointsDisplay />
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-4 mb-8"
        >
          <Link href="/chores">
            <motion.div
              variants={item}
              className="bg-primary/5 hover:bg-primary/10 border-2 border-primary/20 hover:border-primary/50 rounded-2xl p-5 cursor-pointer transition-all active:scale-95 h-full flex flex-col justify-between group"
              data-testid="card-chores"
            >
              <div className="bg-primary w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 mb-4 group-hover:-translate-y-1 transition-transform">
                <CheckSquare className="text-white w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">My Chores</h3>
                <p className="text-primary font-medium text-sm mt-1">
                  {pendingChores} waiting
                </p>
              </div>
            </motion.div>
          </Link>

          <Link href="/rewards">
            <motion.div
              variants={item}
              className="bg-secondary/5 hover:bg-secondary/10 border-2 border-secondary/20 hover:border-secondary/50 rounded-2xl p-5 cursor-pointer transition-all active:scale-95 h-full flex flex-col justify-between group"
              data-testid="card-rewards"
            >
              <div className="bg-secondary w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shadow-secondary/30 mb-4 group-hover:-translate-y-1 transition-transform">
                <ShoppingBag className="text-white w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">Rewards</h3>
                <p className="text-secondary font-medium text-sm mt-1">
                  Treat yourself
                </p>
              </div>
            </motion.div>
          </Link>
        </motion.div>

        <motion.div variants={item} className="bg-card border rounded-2xl p-6 shadow-sm mb-8">
          <h3 className="font-display font-bold text-lg mb-3">Today's Progress</h3>
          <div className="w-full h-4 bg-muted rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500"
              style={{ width: `${chores && chores.length > 0 ? (chores.filter(c => c.completed).length / chores.length) * 100 : 0}%` }}
            />
          </div>
          <p className="text-center text-sm text-muted-foreground font-medium" data-testid="text-progress">
            {chores?.filter(c => c.completed).length || 0} of {chores?.length || 0} tasks done!
          </p>
        </motion.div>

        <div className="border-t pt-8 mt-8">
          <p className="text-xs text-center text-muted-foreground uppercase tracking-widest font-bold mb-4">
            Parent Zone
          </p>
          <div className="space-y-3">
            <button
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors font-medium text-sm"
              data-testid="button-reset-chores"
            >
              {resetMutation.isPending ? (
                <RotateCcw className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Reset chores for tomorrow
            </button>
            <Link href="/parent">
              <div className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 transition-colors font-medium text-sm cursor-pointer" data-testid="link-parent-panel">
                <Shield className="w-4 h-4" />
                Open Parent Panel
              </div>
            </Link>
            <button
              onClick={clearChild}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors font-medium text-sm"
              data-testid="button-switch-child"
            >
              <Users className="w-4 h-4" />
              Switch Player
            </button>
          </div>
        </div>
      </div>
      <Navigation />
    </div>
  );
}
