import { useState } from "react";
import { useChores, useToggleChore } from "@/hooks/use-data";
import { ChoreCard } from "@/components/ChoreCard";
import { Header } from "@/components/Header";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Chores() {
  const { data: chores, isLoading } = useChores();
  const toggleMutation = useToggleChore();
  const [filter, setFilter] = useState('all');

  const categories = chores ? Array.from(new Set(chores.map(c => c.categoryName))) : [];

  const filteredChores = chores?.filter(chore =>
    filter === 'all' ? true : chore.categoryName === filter
  );

  filteredChores?.sort((a, b) => Number(a.completed) - Number(b.completed));

  return (
    <div className="min-h-screen bg-background">
      <Header title="My Checklist" />

      <div className="max-w-md md:max-w-2xl mx-auto px-4 pt-6">
        <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap font-bold text-sm transition-all border-2",
              filter === 'all'
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:border-foreground/30"
            )}
            data-testid="button-filter-all"
          >
            <Sparkles className="w-4 h-4" />
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap font-bold text-sm transition-all border-2",
                filter === cat
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/30"
              )}
              data-testid={`button-filter-${cat}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-muted/20 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : filteredChores?.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-muted rounded-full mx-auto flex items-center justify-center mb-4">
                <Sparkles className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="font-display font-bold text-xl text-foreground">All done!</h3>
              <p className="text-muted-foreground">No chores found for this section.</p>
            </div>
          ) : (
            filteredChores?.map((chore) => (
              <ChoreCard
                key={chore.id}
                chore={chore}
                onToggle={(id) => toggleMutation.mutate(id)}
                isPending={toggleMutation.isPending && toggleMutation.variables === chore.id}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
