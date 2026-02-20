import { useState, useEffect } from "react";
import {
  useUserState, useUpdateSettings, useConfig,
  useUpdateChoreConfig, useUpdateRewardConfig,
  useAwardBonus, useDailySummary, useSendSummaryEmail,
} from "@/hooks/use-data";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { Navigation } from "@/components/Navigation";
import { Header } from "@/components/Header";
import { CATALOG } from "@shared/catalog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Shield, Mail, Send, Settings, Star,
  ChevronDown, ChevronUp, Loader2, DollarSign,
  CheckSquare, ShoppingBag, UserPlus, LogOut, Users,
  Clock, Globe, Zap,
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

function ChoreConfigSection() {
  const { data: config } = useConfig();
  const updateChores = useUpdateChoreConfig();
  const [localEnabled, setLocalEnabled] = useState<Record<string, boolean>>({});
  const [localPoints, setLocalPoints] = useState<Record<string, number>>({});
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (config && !initialized) {
      setLocalEnabled(config.enabledChores || {});
      setLocalPoints(config.pointsByChoreId || {});
      setInitialized(true);
    }
  }, [config, initialized]);

  const handleSave = () => {
    updateChores.mutate({ enabledChores: localEnabled, pointsByChoreId: localPoints });
  };

  const toggleItem = (id: string) => {
    setLocalEnabled(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const setItemPoints = (id: string, pts: number) => {
    setLocalPoints(prev => ({ ...prev, [id]: Math.max(0, Math.min(999999, pts)) }));
  };

  return (
    <Card className="p-5">
      <h3 className="font-display font-bold text-lg mb-2 flex items-center gap-2">
        <CheckSquare className="w-5 h-5 text-primary" />
        Chore Catalog
      </h3>
      <p className="text-sm text-muted-foreground mb-4">Toggle chores on/off and set custom point values.</p>

      <div className="space-y-2 mb-4">
        {CATALOG.chores.map(cat => {
          const isExpanded = expandedCat === cat.categoryId;
          const enabledCount = cat.items.filter(i => localEnabled[i.id]).length;
          return (
            <div key={cat.categoryId} className="border rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedCat(isExpanded ? null : cat.categoryId)}
                className="w-full flex items-center justify-between p-4 text-left font-bold"
                data-testid={`button-chore-cat-${cat.categoryId}`}
              >
                <span>{cat.categoryName} ({enabledCount}/{cat.items.length})</span>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {isExpanded && (
                <div className="border-t px-4 pb-3 space-y-3">
                  {cat.items.map(item => (
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
                          {item.name}
                        </span>
                      </label>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min="1"
                          max="999999"
                          value={localPoints[item.id] ?? item.defaultPoints}
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

function RewardConfigSection() {
  const { data: config } = useConfig();
  const { data: userState } = useUserState();
  const updateRewards = useUpdateRewardConfig();
  const [localEnabled, setLocalEnabled] = useState<Record<string, boolean>>({});
  const [localCosts, setLocalCosts] = useState<Record<string, number>>({});
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (config && !initialized) {
      setLocalEnabled(config.enabledRewards || {});
      setLocalCosts(config.costByRewardId || {});
      setInitialized(true);
    }
  }, [config, initialized]);

  const handleSave = () => {
    updateRewards.mutate({ enabledRewards: localEnabled, costByRewardId: localCosts });
  };

  const toggleItem = (id: string) => {
    setLocalEnabled(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const setItemCost = (id: string, cost: number) => {
    setLocalCosts(prev => ({ ...prev, [id]: Math.max(0, Math.min(999999, cost)) }));
  };

  const filteredCategories = CATALOG.rewards.filter(cat => {
    if (cat.categoryId === "allowance" && !userState?.allowanceEnabled) return false;
    return true;
  });

  return (
    <Card className="p-5">
      <h3 className="font-display font-bold text-lg mb-2 flex items-center gap-2">
        <ShoppingBag className="w-5 h-5 text-secondary" />
        Reward Catalog
      </h3>
      <p className="text-sm text-muted-foreground mb-4">Toggle rewards on/off and set custom costs.</p>

      <div className="space-y-2 mb-4">
        {filteredCategories.map(cat => {
          const isExpanded = expandedCat === cat.categoryId;
          const enabledCount = cat.items.filter(i => localEnabled[i.id]).length;
          return (
            <div key={cat.categoryId} className="border rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedCat(isExpanded ? null : cat.categoryId)}
                className="w-full flex items-center justify-between p-4 text-left font-bold"
                data-testid={`button-reward-cat-${cat.categoryId}`}
              >
                <span>{cat.categoryName} ({enabledCount}/{cat.items.length})</span>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {isExpanded && (
                <div className="border-t px-4 pb-3 space-y-3">
                  {cat.items.map(item => {
                    const isAllowance = item.id.startsWith("allow_");
                    return (
                      <div key={item.id} className="flex items-center justify-between py-2 gap-3">
                        <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!localEnabled[item.id]}
                            onChange={() => toggleItem(item.id)}
                            className="w-5 h-5 rounded accent-secondary shrink-0"
                            data-testid={`checkbox-reward-${item.id}`}
                          />
                          <span className={cn(
                            "font-medium text-sm truncate",
                            localEnabled[item.id] ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {item.name}
                          </span>
                        </label>
                        {!isAllowance && (
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              min="1"
                              max="999999"
                              value={localCosts[item.id] ?? item.defaultCost}
                              onChange={(e) => setItemCost(item.id, parseInt(e.target.value) || 0)}
                              className="w-20 p-1.5 rounded-lg border bg-background text-foreground font-mono text-sm text-center"
                              data-testid={`input-reward-cost-${item.id}`}
                            />
                            <span className="text-xs text-muted-foreground">pts</span>
                          </div>
                        )}
                        {isAllowance && (
                          <span className="text-xs text-muted-foreground font-mono">
                            auto
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        onClick={handleSave}
        disabled={updateRewards.isPending}
        className="w-full"
        data-testid="button-save-reward-config"
      >
        {updateRewards.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Save Reward Settings
      </Button>
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

function SettingsSection() {
  const { data: userState } = useUserState();
  const { user } = useAuth();
  const updateSettings = useUpdateSettings();
  const [email, setEmail] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [allowance, setAllowance] = useState(false);
  const [pointsPerDollar, setPointsPerDollar] = useState(600);
  const [summaryEnabled, setSummaryEnabled] = useState(false);
  const [summaryTime, setSummaryTime] = useState("18:00");
  const [summaryTimezone, setSummaryTimezone] = useState(detectTimezone());

  useEffect(() => {
    if (userState) {
      setEmail(userState.parentEmail || user?.email || "");
      setSecondaryEmail(userState.secondaryParentEmail || "");
      setAllowance(userState.allowanceEnabled);
      setPointsPerDollar(userState.pointsPerDollar);
      setSummaryEnabled(userState.dailySummaryEnabled);
      setSummaryTime(userState.dailySummaryTimeLocal);
      setSummaryTimezone(userState.dailySummaryTimezone);
    }
  }, [userState?.parentEmail, userState?.secondaryParentEmail, userState?.allowanceEnabled, userState?.pointsPerDollar, userState?.dailySummaryEnabled, userState?.dailySummaryTimeLocal, userState?.dailySummaryTimezone, user?.email]);

  const emailsMatch = !!(email.trim() && secondaryEmail.trim() && email.trim().toLowerCase() === secondaryEmail.trim().toLowerCase());

  const handleSave = () => {
    if (emailsMatch) return;
    updateSettings.mutate({
      parentEmail: email.trim() || null,
      secondaryParentEmail: secondaryEmail.trim() || null,
      allowanceEnabled: allowance,
      pointsPerDollar,
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
              <Mail className="w-4 h-4" /> Nightly Summary Email
            </p>
            <p className="text-xs text-muted-foreground">Auto-send "today so far" at your chosen time</p>
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
          <div className="space-y-3 pl-2 border-l-2 border-primary/20 ml-2">
            <div>
              <label className="text-sm font-bold text-muted-foreground mb-1 flex items-center gap-1">
                <Clock className="w-4 h-4" /> Send Time
              </label>
              <input
                type="time"
                value={summaryTime}
                onChange={(e) => setSummaryTime(e.target.value)}
                className="w-full p-3 rounded-xl border bg-background text-foreground"
                data-testid="input-summary-time"
              />
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
          </div>
        )}

        <div className="flex items-center justify-between gap-2 p-3 rounded-xl border">
          <div>
            <p className="font-bold text-sm">Allowance Mode</p>
            <p className="text-xs text-muted-foreground">Let kids convert points to money</p>
          </div>
          <button
            onClick={() => setAllowance(!allowance)}
            className={cn(
              "w-12 h-7 rounded-full transition-all relative shrink-0",
              allowance ? "bg-green-500" : "bg-muted"
            )}
            data-testid="button-toggle-allowance"
          >
            <div className={cn(
              "w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow",
              allowance ? "left-6" : "left-1"
            )} />
          </button>
        </div>

        {allowance && (
          <div>
            <label className="text-sm font-bold text-muted-foreground mb-1 block">
              <DollarSign className="w-4 h-4 inline" /> Points per $1 (currently {pointsPerDollar})
            </label>
            <input
              type="range"
              min="50"
              max="5000"
              step="50"
              value={pointsPerDollar}
              onChange={(e) => setPointsPerDollar(parseInt(e.target.value))}
              className="w-full accent-primary"
              data-testid="input-points-per-dollar"
            />
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
              Sends tonight's summary email right now to validate the full pipeline
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
  const { children: kids, family, refreshChildren, activeChild, selectChild, signOut } = useAuth();
  const [newChildName, setNewChildName] = useState("");
  const [newChildPin, setNewChildPin] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const handleAddChild = async () => {
    if (!newChildName.trim() || !family) return;
    if (newChildPin && newChildPin.length !== 4) {
      setAddError("PIN must be exactly 4 digits");
      return;
    }
    setIsAdding(true);
    setAddError("");

    try {
      const insertData: any = {
        family_id: family.familyId,
        name: newChildName.trim(),
      };

      if (newChildPin) {
        insertData.pin_hash = newChildPin;
      }

      const { error } = await supabase
        .from("children")
        .insert(insertData);

      if (error) throw error;

      await refreshChildren();
      setNewChildName("");
      setNewChildPin("");
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
                {kid.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-foreground truncate">{kid.name}</p>
                <p className="text-xs text-muted-foreground">
                  {kid.hasPin ? "PIN protected" : "No PIN"}
                </p>
              </div>
            </div>
            {kid.id !== activeChild?.id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectChild(kid.id)}
                data-testid={`button-switch-to-${kid.name}`}
              >
                Switch
              </Button>
            )}
            {kid.id === activeChild?.id && (
              <span className="text-xs font-bold text-primary px-2 py-1 bg-primary/10 rounded-full">Active</span>
            )}
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
        <input
          type="text"
          value={newChildPin}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 4);
            setNewChildPin(v);
          }}
          placeholder="Optional 4-digit PIN"
          className="w-full p-3 rounded-xl border bg-background text-foreground"
          data-testid="input-new-child-pin"
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

export default function ParentPanel() {
  const { activeChild } = useAuth();

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header title="Parent Zone" />

      <div className="max-w-md mx-auto px-4 pt-6 space-y-6">
        {activeChild && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
            <p className="text-sm text-muted-foreground">Managing</p>
            <p className="font-bold text-lg text-foreground" data-testid="text-active-child-name">{activeChild.name}</p>
          </div>
        )}
        <ChildManagementSection />
        <BonusSection />
        <ChoreConfigSection />
        <RewardConfigSection />
        <SummarySection />
        <SettingsSection />
      </div>
      <Navigation />
    </div>
  );
}
