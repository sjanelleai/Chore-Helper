import { useState } from "react";
import { useModeChores, useModeToggleChore } from "@/hooks/use-mode-data";
import { ChoreCard } from "@/components/ChoreCard";
import { Header } from "@/components/Header";
import { Sparkles, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

export default function Chores() {
  const { catalogSeedError, retryCatalogSeed } = useAuth();
  const { data: chores, isLoading } = useModeChores();
  const toggleMutation = useModeToggleChore();
  const [filter, setFilter] = useState('all');
  const [retrying, setRetrying] = useState(false);

  const categories = chores ? Array.from(new Set(chores.map(c => c.categoryName))) : [];

  const filteredChores = chores?.filter(chore =>
    filter === 'all' ? true : chore.categoryName === filter
  );

  const statusOrder = { unchecked: 0, pending: 1, approved: 2 };
  filteredChores?.sort((a, b) => (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0) || a.id.localeCompare(b.id));

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
          {catalogSeedError ? (
            <div className="text-center py-12" data-testid="catalog-seed-error">
              <div className="w-24 h-24 bg-destructive/10 rounded-full mx-auto flex items-center justify-center mb-4">
                <AlertTriangle className="w-10 h-10 text-destructive" />
              </div>
              <h3 className="font-display font-bold text-xl text-foreground mb-2">Couldn't load chores</h3>
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
