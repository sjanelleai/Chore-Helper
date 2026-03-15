import { useState, useEffect } from "react";
import {
  useUserState, useUpdateSettings,
  useUpdateChoreConfig, useUpdateRewardConfig,
  useAwardBonus, useDeductPoints, useDailySummary, useSendSummaryEmail,
  useChoreCatalog, useRewardCatalog,
  useFamilySettings,
  usePendingApprovals, useApproveChore, useRejectChore,
  useCreateChore,
  useCreateReward, useUpdateReward, useArchiveReward,
} from "@/hooks/use-data";
import type { PendingApproval, RewardCatalogItem } from "@/hooks/use-data";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { CATALOG } from "@shared/catalog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Mail, Settings, Star, Minus,
  ChevronDown, ChevronUp, Loader2,
  CheckSquare, ShoppingBag, UserPlus, LogOut, Users,
  Clock, Globe, Zap, Trash2, Copy, Check, Key, Shield,
  ShieldCheck, X, CheckCheck, Plus, Search, Pencil, ArchiveRestore,
} from "lucide-react";

function BonusSection() {
  const bonusMutation = useAwardBonus();
  const [reason, setReason] = useState(CATALOG.bonusReasons[0].id);
  const [points, setPoints] = useState(25);
  const [note, setNote] = useState("");

  const handleAward = () => {
    bonusMutation.mutate(
      { reason, points, note: note || undefined },
      { onSuccess: () => { setNote(""); setPoints(25); } }
    );
  };

  return (
    <Card className="p-5">
      <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
        <Star className="w-5 h-5 text-accent" />
        Award Bonus Points
      </h3>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-bold text-muted-foreground mb-1 block">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-3 rounded-xl border bg-background text-foreground font-medium"
            data-testid="select-bonus-reason"
          >
            {CATALOG.bonusReasons.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-bold text-muted-foreground mb-1 block">Points (1-5000)</label>
          <div className="flex items-center gap-2 flex-wrap">
            {[10, 25, 50, 100, 200].map(v => (
              <button
                key={v}
                onClick={() => setPoints(v)}
                className={cn(
                  "px-3 py-2 rounded-xl font-bold text-sm border-2 transition-all",
                  points === v
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border"
                )}
                data-testid={`button-points-${v}`}
              >
                +{v}
              </button>
            ))}
          </div>
          <input
            type="range"
            min="1"
            max="5000"
            value={points}
            onChange={(e) => setPoints(parseInt(e.target.value))}
            className="w-full mt-2 accent-primary"
            data-testid="input-bonus-points-slider"
          />
          <p className="text-center font-mono font-bold text-lg mt-1" data-testid="text-bonus-points-value">+{points} pts</p>
        </div>

        <div>
          <label className="text-sm font-bold text-muted-foreground mb-1 block">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Cleaned garage without asking"
            className="w-full p-3 rounded-xl border bg-background text-foreground"
            data-testid="input-bonus-note"
          />
        </div>

        <Button
          onClick={handleAward}
          disabled={bonusMutation.isPending}
          className="w-full"
          data-testid="button-award-bonus"
        >
          {bonusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Award Bonus
        </Button>
      </div>
    </Card>
  );
}

function DeductionSection() {
  const deductMutation = useDeductPoints();
  const [reason, setReason] = useState(CATALOG.deductionReasons[0].id);
  const [points, setPoints] = useState(10);
  const [note, setNote] = useState("");

  const handleDeduct = () => {
    deductMutation.mutate(
      { reason, points, note: note || undefined },
      { onSuccess: () => { setNote(""); setPoints(10); } }
    );
  };

  return (
    <Card className="p-5 border-red-200 dark:border-red-900/40">
      <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
        <Minus className="w-5 h-5 text-red-500" />
        Deduct Points
      </h3>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-bold text-muted-foreground mb-1 block">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-3 rounded-xl border bg-background text-foreground font-medium"
            data-testid="select-deduction-reason"
          >
            {CATALOG.deductionReasons.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-bold text-muted-foreground mb-1 block">Points to deduct (1–500)</label>
          <div className="flex items-center gap-2 flex-wrap">
            {[5, 10, 25, 50, 100].map(v => (
              <button
                key={v}
                onClick={() => setPoints(v)}
                className={cn(
                  "px-3 py-2 rounded-xl font-bold text-sm border-2 transition-all",
                  points === v
                    ? "bg-red-500 text-white border-red-500"
                    : "bg-background text-foreground border-border"
                )}
                data-testid={`button-deduct-${v}`}
              >
                -{v}
              </button>
            ))}
          </div>
          <input
            type="range"
            min="1"
            max="500"
            value={points}
            onChange={(e) => setPoints(parseInt(e.target.value))}
            className="w-full mt-2 accent-red-500"
            data-testid="input-deduction-points-slider"
          />
          <p className="text-center font-mono font-bold text-lg mt-1 text-red-500" data-testid="text-deduction-points-value">-{points} pts</p>
        </div>

        <div>
          <label className="text-sm font-bold text-muted-foreground mb-1 block">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Hit sibling after warning"
            className="w-full p-3 rounded-xl border bg-background text-foreground"
            data-testid="input-deduction-note"
          />
        </div>

        <Button
          onClick={handleDeduct}
          disabled={deductMutation.isPending}
          variant="destructive"
          className="w-full"
          data-testid="button-deduct-points"
        >
          {deductMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Deduct Points
        </Button>
      </div>
    </Card>
  );
}

function ChoreConfigSection() {
  const { data: catalog } = useChoreCatalog();
  const updateChores = useUpdateChoreConfig();
  const createChore = useCreateChore();
  const [localEnabled, setLocalEnabled] = useState<Record<string, boolean>>({});
  const [localPoints, setLocalPoints] = useState<Record<string, number>>({});
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ title: "", category: "", newCategory: "", points: 10 });

  useEffect(() => {
    if (catalog && catalog.length > 0 && !initialized) {
      const enabled: Record<string, boolean> = {};
      const points: Record<string, number> = {};
      catalog.forEach(c => {
        enabled[c.id] = c.active;
        points[c.id] = c.points;
      });
      setLocalEnabled(enabled);
      setLocalPoints(points);
      setInitialized(true);
    }
  }, [catalog, initialized]);

  const handleSave = () => {
    updateChores.mutate({ enabledChores: localEnabled, pointsByChoreId: localPoints });
  };

  const toggleItem = (id: string) => {
    setLocalEnabled(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const setItemPoints = (id: string, pts: number) => {
    setLocalPoints(prev => ({ ...prev, [id]: Math.max(0, Math.min(999999, pts)) }));
  };

  const handleAdd = () => {
    const category = addForm.newCategory.trim() || addForm.category;
    if (!addForm.title.trim() || !category || addForm.points < 1) return;
    createChore.mutate(
      { title: addForm.title.trim(), category, points: addForm.points },
      { onSuccess: () => { setShowAdd(false); setAddForm({ title: "", category: "", newCategory: "", points: 10 }); } }
    );
  };

  const categories = catalog
    ? Array.from(new Set(catalog.map(c => c.category)))
    : [];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display font-bold text-lg flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-primary" />
          Chore Catalog
        </h3>
        <Button
          size="sm"
          onClick={() => setShowAdd(!showAdd)}
          className="gap-1"
          data-testid="button-add-chore"
        >
          <Plus className="w-4 h-4" />
          Add
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Toggle chores on/off, set point values, or add custom chores.</p>

      {showAdd && (
        <div className="border-2 border-dashed border-primary/40 rounded-xl p-4 mb-4 space-y-3 bg-primary/5" data-testid="form-add-chore">
          <p className="font-bold text-sm text-foreground">New Chore</p>
          <input
            type="text"
            placeholder="Chore title"
            value={addForm.title}
            onChange={e => setAddForm(p => ({ ...p, title: e.target.value }))}
            className="w-full p-2.5 rounded-lg border bg-background text-foreground text-sm"
            data-testid="input-add-chore-title"
          />
          <div className="flex gap-2">
            <select
              value={addForm.category}
              onChange={e => setAddForm(p => ({ ...p, category: e.target.value, newCategory: "" }))}
              className="flex-1 p-2.5 rounded-lg border bg-background text-foreground text-sm"
              data-testid="select-add-chore-category"
            >
              <option value="">Select category...</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__new__">+ New category</option>
            </select>
            {addForm.category === "__new__" && (
              <input
                type="text"
                placeholder="Category name"
                value={addForm.newCategory}
                onChange={e => setAddForm(p => ({ ...p, newCategory: e.target.value }))}
                className="flex-1 p-2.5 rounded-lg border bg-background text-foreground text-sm"
                data-testid="input-add-chore-new-category"
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-bold text-muted-foreground">Points:</label>
            <input
              type="number"
              min="1"
              max="999999"
              value={addForm.points}
              onChange={e => setAddForm(p => ({ ...p, points: parseInt(e.target.value) || 0 }))}
              className="w-24 p-2.5 rounded-lg border bg-background text-foreground font-mono text-sm text-center"
              data-testid="input-add-chore-points"
            />
            <span className="text-sm text-muted-foreground">pts</span>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAdd} disabled={createChore.isPending} size="sm" className="gap-1" data-testid="button-confirm-add-chore">
              {createChore.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)} data-testid="button-cancel-add-chore">Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-2 mb-4">
        {categories.map(catName => {
          const items = (catalog ?? []).filter(c => c.category === catName);
          const isExpanded = expandedCat === catName;
          const enabledCount = items.filter(i => localEnabled[i.id]).length;
          return (
            <div key={catName} className="border rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedCat(isExpanded ? null : catName)}
                className="w-full flex items-center justify-between p-4 text-left font-bold"
                data-testid={`button-chore-cat-${catName}`}
              >
                <span>{catName} ({enabledCount}/{items.length})</span>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {isExpanded && (
                <div className="border-t px-4 pb-3 space-y-3">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center justify-between py-2 gap-3">
                      <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!localEnabled[item.id]}
                          onChange={() => toggleItem(item.id)}
                          className="w-5 h-5 rounded accent-primary shrink-0"
                          data-testid={`checkbox-chore-${item.id}`}
                        />
                        <span className={cn(
                          "font-medium text-sm truncate",
                          localEnabled[item.id] ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {item.title}
                        </span>
                      </label>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min="1"
                          max="999999"
                          value={localPoints[item.id] ?? item.points}
                          onChange={(e) => setItemPoints(item.id, parseInt(e.target.value) || 0)}
                          className="w-16 p-1.5 rounded-lg border bg-background text-foreground font-mono text-sm text-center"
                          data-testid={`input-chore-points-${item.id}`}
                        />
                        <span className="text-xs text-muted-foreground">pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        onClick={handleSave}
        disabled={updateChores.isPending}
        className="w-full"
        data-testid="button-save-chore-config"
      >
        {updateChores.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Save Chore Settings
      </Button>
    </Card>
  );
}

function RewardsManagementSection() {
  const { data: catalog } = useRewardCatalog();
  const createReward = useCreateReward();
  const updateReward = useUpdateReward();
  const archiveReward = useArchiveReward();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; category: string; cost: number }>({ title: "", category: "", cost: 0 });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ title: "", category: "", newCategory: "", cost: 50 });

  const categories = catalog
    ? Array.from(new Set(catalog.map(r => r.category))).sort()
    : [];

  const filtered = catalog
    ?.filter(r => showArchived ? true : r.active)
    .filter(r => filterCat === "all" || r.category === filterCat)
    .filter(r => !search || r.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.category.localeCompare(b.category) || (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.title.localeCompare(b.title))
    ?? [];

  const startEdit = (item: RewardCatalogItem) => {
    setEditingId(item.id);
    setEditForm({ title: item.title, category: item.category, cost: item.cost });
  };

  const saveEdit = () => {
    if (!editingId || !editForm.title.trim()) return;
    updateReward.mutate(
      { id: editingId, title: editForm.title.trim(), category: editForm.category.trim(), cost: editForm.cost },
      { onSuccess: () => setEditingId(null) }
    );
  };

  const handleAdd = () => {
    const category = addForm.newCategory.trim() || addForm.category;
    if (!addForm.title.trim() || !category || addForm.cost < 1) return;
    createReward.mutate(
      { title: addForm.title.trim(), category, cost: addForm.cost },
      { onSuccess: () => { setShowAdd(false); setAddForm({ title: "", category: "", newCategory: "", cost: 50 }); } }
    );
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display font-bold text-lg flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-secondary" />
          Reward Store Editor
        </h3>
        <Button
          size="sm"
          onClick={() => setShowAdd(!showAdd)}
          className="gap-1"
          data-testid="button-add-reward"
        >
          <Plus className="w-4 h-4" />
          Add
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Add, edit, or archive rewards. Archived rewards stay in history but hide from the kid store.</p>

      {showAdd && (
        <div className="border-2 border-dashed border-secondary/40 rounded-xl p-4 mb-4 space-y-3 bg-secondary/5" data-testid="form-add-reward">
          <p className="font-bold text-sm text-foreground">New Reward</p>
          <input
            type="text"
            placeholder="Reward title"
            value={addForm.title}
            onChange={e => setAddForm(p => ({ ...p, title: e.target.value }))}
            className="w-full p-2.5 rounded-lg border bg-background text-foreground text-sm"
            data-testid="input-add-reward-title"
          />
          <div className="flex gap-2">
            <select
              value={addForm.category}
              onChange={e => setAddForm(p => ({ ...p, category: e.target.value, newCategory: "" }))}
              className="flex-1 p-2.5 rounded-lg border bg-background text-foreground text-sm"
              data-testid="select-add-reward-category"
            >
              <option value="">Select category...</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__new__">+ New category</option>
            </select>
            {addForm.category === "__new__" && (
              <input
                type="text"
                placeholder="Category name"
                value={addForm.newCategory}
                onChange={e => setAddForm(p => ({ ...p, newCategory: e.target.value }))}
                className="flex-1 p-2.5 rounded-lg border bg-background text-foreground text-sm"
                data-testid="input-add-reward-new-category"
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-bold text-muted-foreground">Cost:</label>
            <input
              type="number"
              min="1"
              max="999999"
              value={addForm.cost}
              onChange={e => setAddForm(p => ({ ...p, cost: parseInt(e.target.value) || 0 }))}
              className="w-24 p-2.5 rounded-lg border bg-background text-foreground font-mono text-sm text-center"
              data-testid="input-add-reward-cost"
            />
            <span className="text-sm text-muted-foreground">pts</span>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAdd} disabled={createReward.isPending} size="sm" className="gap-1" data-testid="button-confirm-add-reward">
              {createReward.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)} data-testid="button-cancel-add-reward">Cancel</Button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search rewards..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg border bg-background text-foreground text-sm"
            data-testid="input-search-rewards"
          />
        </div>
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="p-2 rounded-lg border bg-background text-foreground text-sm"
          data-testid="select-filter-reward-category"
        >
          <option value="all">All</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={() => setShowArchived(!showArchived)}
          className="w-4 h-4 rounded accent-secondary"
          data-testid="checkbox-show-archived"
        />
        Show archived rewards
      </label>

      <div className="space-y-2 mb-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-rewards">No rewards match your filters.</p>
        ) : (
          filtered.map(item => (
            <div
              key={item.id}
              className={cn(
                "border rounded-xl p-3 transition-colors",
                !item.active && "opacity-60 bg-muted/30"
              )}
              data-testid={`reward-item-${item.id}`}
            >
              {editingId === item.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                    className="w-full p-2 rounded-lg border bg-background text-foreground text-sm"
                    data-testid={`input-edit-reward-title-${item.id}`}
                  />
                  <div className="flex gap-2">
                    <select
                      value={editForm.category}
                      onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}
                      className="flex-1 p-2 rounded-lg border bg-background text-foreground text-sm"
                      data-testid={`select-edit-reward-category-${item.id}`}
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        max="999999"
                        value={editForm.cost}
                        onChange={e => setEditForm(p => ({ ...p, cost: parseInt(e.target.value) || 0 }))}
                        className="w-20 p-2 rounded-lg border bg-background text-foreground font-mono text-sm text-center"
                        data-testid={`input-edit-reward-cost-${item.id}`}
                      />
                      <span className="text-xs text-muted-foreground">pts</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit} disabled={updateReward.isPending} className="gap-1" data-testid={`button-save-edit-${item.id}`}>
                      {updateReward.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-${item.id}`}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate" data-testid={`text-reward-title-${item.id}`}>{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.category}</p>
                  </div>
                  <span className="font-mono font-bold text-sm text-foreground shrink-0" data-testid={`text-reward-cost-${item.id}`}>{item.cost} pts</span>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(item)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      title="Edit"
                      data-testid={`button-edit-reward-${item.id}`}
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => archiveReward.mutate({ id: item.id, active: !item.active })}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      title={item.active ? "Archive" : "Restore"}
                      data-testid={`button-archive-reward-${item.id}`}
                    >
                      {item.active ? <Trash2 className="w-4 h-4 text-muted-foreground" /> : <ArchiveRestore className="w-4 h-4 text-green-600" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

const COMMON_TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "America/Phoenix",
  "America/Toronto", "America/Vancouver", "America/Edmonton",
  "Europe/London", "Europe/Paris", "Europe/Berlin",
  "Asia/Tokyo", "Asia/Shanghai", "Asia/Kolkata",
  "Australia/Sydney", "Australia/Perth",
  "Pacific/Auckland",
];

function formatTimezoneLabel(tz: string) {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" });
    const parts = formatter.formatToParts(now);
    const abbr = parts.find(p => p.type === "timeZoneName")?.value || "";
    const city = tz.split("/").pop()?.replace(/_/g, " ") || tz;
    return `${city} (${abbr})`;
  } catch {
    return tz;
  }
}

function detectTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "America/Denver";
  }
}

function getNextSendLabel(time: string, timezone: string): string {
  try {
    const [h, m] = time.split(":").map(Number);
    const now = new Date();
    // Get current date/time in the target timezone
    const nowInTz = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    const target = new Date(nowInTz);
    target.setHours(h, m, 0, 0);
    const isToday = nowInTz < target;
    const label = isToday ? "Today" : "Tomorrow";
    const timeLabel = target.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
      timeZoneName: "short",
    });
    return `${label} at ${timeLabel}`;
  } catch {
    return time;
  }
}

function SettingsSection() {
  const { data: userState } = useUserState();
  const { user } = useAuth();
  const updateSettings = useUpdateSettings();
  const [email, setEmail] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [summaryEnabled, setSummaryEnabled] = useState(false);
  const [summaryTime, setSummaryTime] = useState("18:00");
  const [summaryTimezone, setSummaryTimezone] = useState(detectTimezone());

  useEffect(() => {
    if (userState) {
      setEmail(userState.parentEmail || user?.email || "");
      setSecondaryEmail(userState.secondaryParentEmail || "");
      setSummaryEnabled(userState.dailySummaryEnabled);
      setSummaryTime(userState.dailySummaryTimeLocal);
      setSummaryTimezone(userState.dailySummaryTimezone);
    }
  }, [userState?.parentEmail, userState?.secondaryParentEmail, userState?.dailySummaryEnabled, userState?.dailySummaryTimeLocal, userState?.dailySummaryTimezone, user?.email]);

  const emailsMatch = !!(email.trim() && secondaryEmail.trim() && email.trim().toLowerCase() === secondaryEmail.trim().toLowerCase());

  const handleSave = () => {
    if (emailsMatch) return;
    updateSettings.mutate({
      parentEmail: email.trim() || null,
      secondaryParentEmail: secondaryEmail.trim() || null,
      dailySummaryEnabled: summaryEnabled,
      dailySummaryTimeLocal: summaryTime,
      dailySummaryTimezone: summaryTimezone,
    });
  };

  return (
    <Card className="p-5">
      <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
        <Settings className="w-5 h-5 text-muted-foreground" />
        Parent Settings
      </h3>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-bold text-muted-foreground mb-1 block">Primary Parent Email</label>
          <p className="text-xs text-muted-foreground mb-2">Receives daily summary emails</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="parent@example.com"
            className="w-full p-3 rounded-xl border bg-background text-foreground"
            data-testid="input-parent-email"
          />
        </div>

        <div>
          <label className="text-sm font-bold text-muted-foreground mb-1 block">Secondary Parent Email</label>
          <p className="text-xs text-muted-foreground mb-2">Optional - also receives daily summaries</p>
          <input
            type="email"
            value={secondaryEmail}
            onChange={(e) => setSecondaryEmail(e.target.value)}
            placeholder="other-parent@example.com"
            className={cn("w-full p-3 rounded-xl border bg-background text-foreground", emailsMatch && "border-red-400")}
            data-testid="input-secondary-parent-email"
          />
          {emailsMatch && (
            <p className="text-xs text-red-500 mt-1" data-testid="text-email-duplicate-error">
              Secondary email must be different from the primary email
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 p-3 rounded-xl border">
          <div>
            <p className="font-bold text-sm flex items-center gap-1">
              <Mail className="w-4 h-4" /> Daily Summary Email
            </p>
            <p className="text-xs text-muted-foreground">
              Auto-send a daily chores &amp; rewards snapshot at your chosen time
            </p>
          </div>
          <button
            onClick={() => setSummaryEnabled(!summaryEnabled)}
            className={cn(
              "w-12 h-7 rounded-full transition-all relative shrink-0",
              summaryEnabled ? "bg-green-500" : "bg-muted"
            )}
            data-testid="button-toggle-summary"
          >
            <div className={cn(
              "w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow",
              summaryEnabled ? "left-6" : "left-1"
            )} />
          </button>
        </div>

        {summaryEnabled && (
          <div className="space-y-3 pl-2 border-l-2 border-primary/20 ml-2 overflow-hidden">
            <div>
              <label className="text-sm font-bold text-muted-foreground mb-1 flex items-center gap-1">
                <Clock className="w-4 h-4" /> Send Time
              </label>
              <div className="overflow-hidden">
                <input
                  type="time"
                  value={summaryTime}
                  onChange={(e) => setSummaryTime(e.target.value)}
                  className="w-full p-3 rounded-xl border bg-background text-foreground box-border"
                  data-testid="input-summary-time"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-muted-foreground mb-1 flex items-center gap-1">
                <Globe className="w-4 h-4" /> Timezone
              </label>
              <select
                value={summaryTimezone}
                onChange={(e) => setSummaryTimezone(e.target.value)}
                className="w-full p-3 rounded-xl border bg-background text-foreground"
                data-testid="select-summary-timezone"
              >
                {COMMON_TIMEZONES.map(tz => (
                  <option key={tz} value={tz}>{formatTimezoneLabel(tz)}</option>
                ))}
                {!COMMON_TIMEZONES.includes(summaryTimezone) && (
                  <option value={summaryTimezone}>{formatTimezoneLabel(summaryTimezone)}</option>
                )}
              </select>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/15">
              <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
              <p className="text-xs text-primary font-medium">
                Next send: {getNextSendLabel(summaryTime, summaryTimezone)}
              </p>
            </div>
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={updateSettings.isPending || emailsMatch}
          className="w-full"
          data-testid="button-save-settings"
        >
          {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save Settings
        </Button>
      </div>
    </Card>
  );
}

function SummarySection() {
  const { data: summary, isLoading } = useDailySummary();
  const sendEmail = useSendSummaryEmail();
  const { data: userState } = useUserState();

  const hasAnyEmail = !!(userState?.parentEmail || userState?.secondaryParentEmail);
  const emailCount = [userState?.parentEmail, userState?.secondaryParentEmail].filter(Boolean).length;

  return (
    <Card className="p-5">
      <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
        <Mail className="w-5 h-5 text-secondary" />
        Daily Summary
      </h3>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : summary ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl text-center">
              <p className="text-xs font-bold text-green-700 dark:text-green-400">Completed</p>
              <p className="text-2xl font-black text-green-600 dark:text-green-300" data-testid="text-completed-count">{summary.totalChoresCompleted}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl text-center">
              <p className="text-xs font-bold text-red-700 dark:text-red-400">Remaining</p>
              <p className="text-2xl font-black text-red-600 dark:text-red-300" data-testid="text-missed-count">{summary.totalChoresMissed}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl text-center">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-400">Points</p>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-300" data-testid="text-points-today">
                {summary.totalPointsEarned > 0 ? "+" : ""}{summary.totalPointsEarned}
              </p>
            </div>
          </div>

          {summary.children.map((child, i) => (
            <div key={i} className="border rounded-xl p-3 space-y-2">
              <p className="font-bold text-foreground" data-testid={`text-summary-child-${i}`}>{child.childName}</p>
              <div className="flex items-center gap-3 text-sm flex-wrap">
                <span className="text-green-600 dark:text-green-400 font-medium">
                  {child.completedChores.length} done
                </span>
                <span className="text-red-500 dark:text-red-400 font-medium">
                  {child.missedChores.length} remaining
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-mono font-bold">
                  {child.pointsEarnedToday > 0 ? "+" : ""}{child.pointsEarnedToday} pts
                </span>
                <span className="text-muted-foreground font-mono">
                  Balance: {child.currentBalance}
                </span>
              </div>
              {child.completedChores.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {child.completedChores.join(", ")}
                </div>
              )}
              {child.bonuses.length > 0 && (
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  {child.bonuses.map((b, j) => (
                    <span key={j}>+{b.points} bonus ({b.reason}){j < child.bonuses.length - 1 ? ", " : ""}</span>
                  ))}
                </div>
              )}
              {child.redemptions.length > 0 && (
                <div className="text-xs text-purple-600 dark:text-purple-400">
                  {child.redemptions.map((r, j) => (
                    <span key={j}>-{r.cost} pts ({r.name}){j < child.redemptions.length - 1 ? ", " : ""}</span>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="space-y-2">
            <Button
              onClick={() => summary && sendEmail.mutate(summary)}
              disabled={sendEmail.isPending || !hasAnyEmail}
              className="w-full"
              data-testid="button-test-nightly-send"
            >
              {sendEmail.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {hasAnyEmail
                ? `Test Nightly Email Now${emailCount > 1 ? ` (${emailCount} recipients)` : ""}`
                : "Set email in settings first"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Sends today's summary email right now — use this to confirm your setup works
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Add children to see the daily summary
        </p>
      )}
    </Card>
  );
}

function ChildManagementSection() {
  const { children: kids, family, refreshChildren, activeChild, selectChild, clearChild, signOut } = useAuth();
  const [newChildName, setNewChildName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [removingChildId, setRemovingChildId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleRemoveChild = async (childId: string) => {
    setRemovingChildId(childId);
    try {
      const { data, error } = await supabase.rpc("remove_child", { p_child_id: childId });
      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (result?.error) throw new Error(result.error);

      if (activeChild?.id === childId) clearChild();
      await refreshChildren();
      toast({ title: "Child removed", description: "Child profile and all associated data have been deleted." });
      setConfirmRemoveId(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to remove child", variant: "destructive" });
    } finally {
      setRemovingChildId(null);
    }
  };

  const handleAddChild = async () => {
    if (!newChildName.trim() || !family) return;
    setIsAdding(true);
    setAddError("");

    try {
      const { data, error } = await supabase.rpc("add_child", {
        p_display_name: newChildName.trim(),
      });

      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (result?.error) throw new Error(result.error);

      await refreshChildren();
      setNewChildName("");
    } catch (err: any) {
      setAddError(err.message || "Failed to add child");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Card className="p-5">
      <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        Manage Kids
      </h3>

      <div className="space-y-3 mb-4">
        {kids.map(kid => (
          <div
            key={kid.id}
            className={cn(
              "flex items-center justify-between gap-2 p-3 rounded-xl border-2 transition-all",
              kid.id === activeChild?.id
                ? "border-primary bg-primary/5"
                : "border-border"
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                {kid.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-foreground truncate">{kid.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {kid.hasPin ? "PIN protected" : "No PIN"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {kid.id !== activeChild?.id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectChild(kid.id)}
                  data-testid={`button-switch-to-${kid.displayName}`}
                >
                  Switch
                </Button>
              )}
              {kid.id === activeChild?.id && (
                <span className="text-xs font-bold text-primary px-2 py-1 bg-primary/10 rounded-full">Active</span>
              )}
              {confirmRemoveId === kid.id ? (
                <div className="flex items-center gap-1">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveChild(kid.id)}
                    disabled={removingChildId === kid.id}
                    data-testid={`button-confirm-remove-${kid.displayName}`}
                  >
                    {removingChildId === kid.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmRemoveId(null)}
                    data-testid={`button-cancel-remove-${kid.displayName}`}
                  >
                    No
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmRemoveId(kid.id)}
                  className="text-muted-foreground hover:text-destructive"
                  data-testid={`button-remove-${kid.displayName}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-4 space-y-3">
        <p className="text-sm font-bold text-muted-foreground">Add New Kid</p>
        <input
          type="text"
          value={newChildName}
          onChange={(e) => setNewChildName(e.target.value)}
          placeholder="Child's name"
          className="w-full p-3 rounded-xl border bg-background text-foreground"
          data-testid="input-new-child-name"
        />
        {addError && <p className="text-sm text-destructive">{addError}</p>}
        <Button
          onClick={handleAddChild}
          disabled={isAdding || !newChildName.trim()}
          className="w-full"
          data-testid="button-add-child"
        >
          {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          Add Kid
        </Button>
      </div>

      <div className="border-t pt-4 mt-4">
        <Button
          variant="outline"
          onClick={signOut}
          className="w-full text-destructive"
          data-testid="button-sign-out"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </Card>
  );
}

function FamilyNumberSection() {
  const { family } = useAuth();
  const [familyNumber, setFamilyNumber] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!family?.familyId) return;
    supabase
      .from("families")
      .select("family_number")
      .eq("id", family.familyId)
      .single()
      .then(({ data }) => {
        setFamilyNumber(data?.family_number || null);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [family?.familyId]);

  const handleCopy = () => {
    if (!familyNumber) return;
    navigator.clipboard.writeText(familyNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return null;

  return (
    <Card className="p-5">
      <h3 className="font-display font-bold text-lg mb-2 flex items-center gap-2">
        <Key className="w-5 h-5 text-accent" />
        Kid Access
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Share this Family Number with your kids so they can join from any device.
      </p>

      <div className="flex items-center gap-3">
        <div className="flex-1 bg-muted/50 border-2 border-dashed border-primary/30 rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Family Number</p>
          <p className="text-3xl font-black font-mono tracking-[0.3em] text-foreground" data-testid="text-family-number">
            {familyNumber || "N/A"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          disabled={!familyNumber}
          data-testid="button-copy-family-number"
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Kids also need a PIN set below to join. They'll go to the "I'm a Kid" option on the login page.
      </p>
    </Card>
  );
}

function ChildPinSection() {
  const { children: kids, family, refreshChildren } = useAuth();
  const { toast } = useToast();
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSetPin = async (childId: string) => {
    if (pinInput.length !== 4) {
      toast({ title: "PIN must be 4 digits", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("set_child_pin", {
        p_child_id: childId,
        p_pin: pinInput,
      });
      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (!result?.ok) throw new Error(result?.error || "Failed to set PIN");

      toast({ title: "PIN set!", description: "Child can now use this PIN to join." });
      setPinInput("");
      setEditingChildId(null);
      await refreshChildren();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!kids.length) return null;

  return (
    <Card className="p-5">
      <h3 className="font-display font-bold text-lg mb-2 flex items-center gap-2">
        <Key className="w-5 h-5 text-primary" />
        Child PINs
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Each child needs a 4-digit PIN to sign in on kid mode.
      </p>

      <div className="space-y-3">
        {kids.map(kid => (
          <div key={kid.id} className="border rounded-xl p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {kid.displayName.charAt(0).toUpperCase()}
                </div>
                <p className="font-bold text-foreground truncate">{kid.displayName}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {kid.hasPin && (
                  <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                    PIN set
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingChildId(editingChildId === kid.id ? null : kid.id);
                    setPinInput("");
                  }}
                  data-testid={`button-edit-pin-${kid.displayName}`}
                >
                  {kid.hasPin ? "Change" : "Set PIN"}
                </Button>
              </div>
            </div>

            {editingChildId === kid.id && (
              <div className="mt-3 flex gap-2">
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setPinInput(v);
                  }}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="4-digit PIN"
                  className="flex-1 p-2 rounded-lg border bg-background text-foreground font-mono text-lg tracking-widest text-center"
                  data-testid={`input-pin-${kid.displayName}`}
                />
                <Button
                  onClick={() => handleSetPin(kid.id)}
                  disabled={saving || pinInput.length !== 4}
                  size="sm"
                  data-testid={`button-save-pin-${kid.displayName}`}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function ParentPortalPinSection() {
  const { family } = useAuth();
  const { toast } = useToast();
  const [hasPin, setHasPin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pinInput, setPinInput] = useState("");
  const [confirmPinInput, setConfirmPinInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [disablePinInput, setDisablePinInput] = useState("");

  useEffect(() => {
    if (!family?.familyId) return;
    supabase
      .from("family_settings")
      .select("parent_portal_pin_hash")
      .eq("family_id", family.familyId)
      .single()
      .then(({ data }) => {
        setHasPin(!!data?.parent_portal_pin_hash);
        setLoading(false);
      });
  }, [family?.familyId]);

  const handleSetPin = async () => {
    if (pinInput.length < 4) {
      toast({ title: "PIN must be at least 4 digits", variant: "destructive" });
      return;
    }
    if (pinInput !== confirmPinInput) {
      toast({ title: "PINs don't match", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("set_parent_portal_pin", {
        p_family_id: family!.familyId,
        p_pin: pinInput,
      });
      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (!result?.ok) throw new Error(result?.error || "Failed to set PIN");

      setHasPin(true);
      toast({ title: "Parent Portal PIN set!", description: "The parent panel now requires a PIN." });
      setPinInput("");
      setConfirmPinInput("");
      setShowForm(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDisablePin = async () => {
    if (disablePinInput.length < 4) {
      toast({ title: "Enter your current PIN to confirm", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("disable_parent_portal_pin", {
        p_family_id: family!.familyId,
        p_pin: disablePinInput,
      });
      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (!result?.ok) throw new Error(result?.error || "Failed to disable PIN");

      setHasPin(false);
      setShowDisableForm(false);
      setDisablePinInput("");
      sessionStorage.removeItem("parentPortalUnlockedUntil");
      toast({ title: "Parent Portal PIN disabled" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card className="p-5">
      <h3 className="font-display font-bold text-lg mb-2 flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" />
        Parent Portal PIN
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        {hasPin
          ? "Your parent panel is PIN-protected. Kids on shared devices can't access it without the PIN."
          : "Add a PIN to protect the Parent Panel from being accessed by kids on shared devices."
        }
      </p>

      {hasPin ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <Check className="w-4 h-4" />
            <span className="text-sm font-bold">PIN is active</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowForm(!showForm)}
              className="flex-1"
              data-testid="button-change-portal-pin"
            >
              Change PIN
            </Button>
            <Button
              variant="outline"
              onClick={() => { setShowDisableForm(!showDisableForm); setDisablePinInput(""); }}
              className="text-destructive"
              data-testid="button-disable-portal-pin"
            >
              Disable
            </Button>
          </div>
          {showDisableForm && (
            <div className="border border-destructive/30 rounded-xl p-3 space-y-2 bg-destructive/5">
              <p className="text-xs font-bold text-destructive">Enter your current PIN to confirm:</p>
              <input
                type="password"
                inputMode="numeric"
                value={disablePinInput}
                onChange={e => setDisablePinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Current PIN"
                className="w-full p-2 rounded-lg border bg-background text-foreground text-sm"
                data-testid="input-disable-pin-confirm"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={handleDisablePin} disabled={saving} data-testid="button-confirm-disable-pin">
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm Disable"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowDisableForm(false); setDisablePinInput(""); }}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => setShowForm(!showForm)}
          className="w-full"
          data-testid="button-enable-portal-pin"
        >
          <Shield className="w-4 h-4 mr-2" />
          Set Parent Portal PIN
        </Button>
      )}

      {showForm && (
        <div className="mt-4 space-y-3 border-t pt-4">
          <input
            type="password"
            value={pinInput}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setPinInput(v);
            }}
            inputMode="numeric"
            maxLength={6}
            placeholder="New PIN (4-6 digits)"
            className="w-full p-3 rounded-xl border bg-background text-foreground font-mono text-lg tracking-widest text-center"
            data-testid="input-new-portal-pin"
          />
          <input
            type="password"
            value={confirmPinInput}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setConfirmPinInput(v);
            }}
            inputMode="numeric"
            maxLength={6}
            placeholder="Confirm PIN"
            className="w-full p-3 rounded-xl border bg-background text-foreground font-mono text-lg tracking-widest text-center"
            data-testid="input-confirm-portal-pin"
          />
          <Button
            onClick={handleSetPin}
            disabled={saving || pinInput.length < 4 || pinInput !== confirmPinInput}
            className="w-full"
            data-testid="button-save-portal-pin"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save PIN"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function VerificationSection() {
  const { data: settings } = useFamilySettings();
  const updateSettings = useUpdateSettings();
  const [mode, setMode] = useState<string>("smart");
  const [thresholdStr, setThresholdStr] = useState("30");

  useEffect(() => {
    if (settings) {
      setMode(settings.approval_mode || "smart");
      setThresholdStr(String(settings.approval_threshold ?? 30));
    }
  }, [settings?.approval_mode, settings?.approval_threshold]);

  const handleSave = () => {
    const threshold = Math.min(999, Math.max(1, parseInt(thresholdStr, 10) || 30));
    updateSettings.mutate({
      approvalMode: mode,
      approvalThreshold: threshold,
    });
  };

  const hasChanges = settings && (mode !== (settings.approval_mode || "smart") || Number(thresholdStr) !== (settings.approval_threshold ?? 30));

  return (
    <Card className="p-5">
      <h3 className="font-display font-bold text-lg mb-2 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-muted-foreground" />
        Chore Verification
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Control when kids need parent approval before earning points.
      </p>

      <div className="space-y-3 mb-4">
        {([
          { value: "never", label: "Never verify", desc: "Points awarded instantly when kid marks chore done" },
          { value: "smart", label: "Smart verify", desc: "Only high-value chores need approval" },
          { value: "always", label: "Always verify", desc: "All chores need parent approval" },
        ] as const).map(opt => (
          <button
            key={opt.value}
            onClick={() => setMode(opt.value)}
            className={cn(
              "w-full text-left p-3 rounded-xl border-2 transition-all",
              mode === opt.value
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/30"
            )}
            data-testid={`button-approval-${opt.value}`}
          >
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                mode === opt.value ? "border-primary" : "border-muted-foreground/40"
              )}>
                {mode === opt.value && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <div>
                <p className="font-bold text-sm">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {mode === "smart" && (
        <div className="p-3 rounded-xl border bg-muted/30 mb-4">
          <label className="text-sm font-bold text-muted-foreground mb-1 block">
            Approval threshold
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Chores worth this many points or more require parent approval
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={thresholdStr}
              onChange={(e) => setThresholdStr(e.target.value.replace(/[^0-9]/g, ""))}
              className="w-24 p-2 rounded-lg border bg-background text-foreground text-center font-mono font-bold"
              data-testid="input-approval-threshold"
            />
            <span className="text-sm text-muted-foreground font-medium">points</span>
          </div>
        </div>
      )}

      <Button
        onClick={handleSave}
        disabled={updateSettings.isPending || !hasChanges}
        className="w-full"
        data-testid="button-save-verification"
      >
        {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Save Verification Settings
      </Button>
    </Card>
  );
}

function PendingApprovalsSection() {
  const { data: pending, isLoading } = usePendingApprovals();
  const approveMutation = useApproveChore();
  const rejectMutation = useRejectChore();

  const grouped = (pending || []).reduce((acc, item) => {
    if (!acc[item.child_id]) {
      acc[item.child_id] = { childName: item.child_name, items: [] };
    }
    acc[item.child_id].items.push(item);
    return acc;
  }, {} as Record<string, { childName: string; items: PendingApproval[] }>);

  const handleApproveAll = (childItems: PendingApproval[]) => {
    for (const item of childItems) {
      approveMutation.mutate({ childId: item.child_id, choreId: item.chore_id, dateKey: item.date_key });
    }
  };

  if (isLoading) {
    return (
      <Card className="p-5">
        <h3 className="font-display font-bold text-lg mb-2 flex items-center gap-2">
          <Clock className="w-5 h-5 text-yellow-500" />
          Pending Approvals
        </h3>
        <div className="h-16 bg-muted/20 animate-pulse rounded-xl" />
      </Card>
    );
  }

  if (!pending || pending.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="font-display font-bold text-lg mb-2 flex items-center gap-2">
          <Clock className="w-5 h-5 text-muted-foreground" />
          Pending Approvals
        </h3>
        <p className="text-sm text-muted-foreground" data-testid="text-no-pending">No chores waiting for approval today.</p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-yellow-500" />
        Pending Approvals
        <span className="ml-auto bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-bold px-2 py-0.5 rounded-full" data-testid="badge-pending-count">
          {pending.length}
        </span>
      </h3>

      <div className="space-y-4">
        {Object.entries(grouped).map(([childId, { childName, items }]) => (
          <div key={childId} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm text-foreground" data-testid={`text-pending-child-${childId}`}>{childName}</p>
              {items.length > 1 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleApproveAll(items)}
                  disabled={approveMutation.isPending}
                  className="text-xs h-7 gap-1"
                  data-testid={`button-approve-all-${childId}`}
                >
                  <CheckCheck className="w-3 h-3" />
                  Approve All
                </Button>
              )}
            </div>

            {items.map(item => (
              <div
                key={`${item.chore_id}-${item.date_key}`}
                className="flex items-center gap-3 p-3 rounded-xl border bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800/30"
                data-testid={`pending-item-${item.chore_id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{item.chore_title}</p>
                  <p className="text-xs text-muted-foreground font-mono">+{item.points} pts</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectMutation.mutate({ childId: item.child_id, choreId: item.chore_id, dateKey: item.date_key })}
                    disabled={rejectMutation.isPending}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    data-testid={`button-reject-${item.chore_id}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate({ childId: item.child_id, choreId: item.chore_id, dateKey: item.date_key })}
                    disabled={approveMutation.isPending}
                    className="h-8 gap-1 bg-green-600 hover:bg-green-700 text-white"
                    data-testid={`button-approve-${item.chore_id}`}
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function ParentPanel() {
  const { activeChild } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Header title="Parent Zone" />

      <div className="max-w-md md:max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {activeChild && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
            <p className="text-sm text-muted-foreground">Managing</p>
            <p className="font-bold text-lg text-foreground" data-testid="text-active-child-name">{activeChild.displayName}</p>
          </div>
        )}
        <PendingApprovalsSection />
        <FamilyNumberSection />
        <ChildManagementSection />
        <ChildPinSection />
        <BonusSection />
        <DeductionSection />
        <VerificationSection />
        <ChoreConfigSection />
        <RewardsManagementSection />
        <SummarySection />
        <SettingsSection />
        <ParentPortalPinSection />
      </div>
    </div>
  );
}
