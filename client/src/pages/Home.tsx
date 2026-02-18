import { Link } from "wouter";
import { useUserState, useChores, useResetChores } from "@/hooks/use-data";
import { PointsDisplay } from "@/components/PointsDisplay";
import { Navigation } from "@/components/Navigation";
import { motion } from "framer-motion";
import { CheckSquare, ShoppingBag, RotateCcw, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  const { data: user } = useUserState();
  const { data: chores } = useChores();
  const resetMutation = useResetChores();

  const pendingChores = chores?.filter(c => !c.completed).length || 0;
  
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-md mx-auto pt-8 px-4">
        {/* Header Greeting */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Hi, Champion! 👋
            </h1>
            <p className="text-muted-foreground font-medium">Ready to earn some points?</p>
          </div>
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center border-2 border-primary/20">
            <span className="text-2xl">🦁</span>
          </div>
        </div>

        {/* Main Points Display */}
        <div className="mb-10">
          <PointsDisplay />
        </div>

        {/* Quick Actions Grid */}
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-4 mb-8"
        >
          {/* Chores Action */}
          <Link href="/chores">
            <motion.div 
              variants={item}
              className="bg-primary/5 hover:bg-primary/10 border-2 border-primary/20 hover:border-primary/50 rounded-2xl p-5 cursor-pointer transition-all active:scale-95 h-full flex flex-col justify-between group"
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

          {/* Store Action */}
          <Link href="/rewards">
            <motion.div 
              variants={item}
              className="bg-secondary/5 hover:bg-secondary/10 border-2 border-secondary/20 hover:border-secondary/50 rounded-2xl p-5 cursor-pointer transition-all active:scale-95 h-full flex flex-col justify-between group"
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

        {/* Progress Summary / Motivation */}
        <motion.div variants={item} className="bg-card border rounded-2xl p-6 shadow-sm mb-8">
          <h3 className="font-display font-bold text-lg mb-3">Today's Progress</h3>
          <div className="w-full h-4 bg-muted rounded-full overflow-hidden mb-2">
            <div 
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
              style={{ width: `${chores ? (chores.filter(c => c.completed).length / chores.length) * 100 : 0}%` }}
            />
          </div>
          <p className="text-center text-sm text-muted-foreground font-medium">
            {chores?.filter(c => c.completed).length} of {chores?.length} tasks done!
          </p>
        </motion.div>

        {/* Admin/Parent Zone (Reset) */}
        <div className="border-t pt-8 mt-8">
          <p className="text-xs text-center text-muted-foreground uppercase tracking-widest font-bold mb-4">
            Parent Zone
          </p>
          <button
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors font-medium text-sm"
          >
            {resetMutation.isPending ? (
              <RotateCcw className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            Reset chores for tomorrow
          </button>
        </div>
      </div>
      <Navigation />
    </div>
  );
}
