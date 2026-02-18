import { useState, useEffect } from "react";
import {
  useUserState, useUpdateSettings, useRewards, useToggleApproval,
  useAwardBonus, useDailySummary, useSendSummaryEmail, useLedger,
} from "@/hooks/use-data";
import { Navigation } from "@/components/Navigation";
import { Header } from "@/components/Header";
import { BONUS_REASONS, REWARD_CATEGORIES } from "@shared/schema";
import type { Reward } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Gift, Shield, Mail, Send, Settings, Star, Check, X,
  ChevronDown, ChevronUp, Loader2, DollarSign,
} from "lucide-react";

function BonusSection() {
  const bonusMutation = useAwardBonus();
  const [reason, setReason] = useState(BONUS_REASONS[0].id);
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
          <label className="text-sm font-bold text-muted-foreground mb-1 block" data-testid="label-bonus-reason">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-3 rounded-xl border bg-background text-foreground font-medium"
            data-testid="select-bonus-reason"
          >
            {BONUS_REASONS.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-bold text-muted-foreground mb-1 block" data-testid="label-bonus-points">Points (1-300)</label>
          <div className="flex items-center gap-3">
            {[10, 25, 50, 100].map(v => (
              <button
                key={v}
                onClick={() => setPoints(v)}
                className={cn(
                  "px-4 py-2 rounded-xl font-bold text-sm border-2 transition-all",
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
            max="300"
            value={points}
            onChange={(e) => setPoints(parseInt(e.target.value))}
            className="w-full mt-2 accent-primary"
            data-testid="input-bonus-points-slider"
          />
          <p className="text-center font-mono font-bold text-lg mt-1" data-testid="text-bonus-points-value">+{points} pts</p>
        </div>

        <div>
          <label className="text-sm font-bold text-muted-foreground mb-1 block" data-testid="label-bonus-note">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Put shoes away without asking"
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

function ApprovalSection() {
  const { data: rewards } = useRewards();
  const { data: userState } = useUserState();
  const toggleApproval = useToggleApproval();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const grouped: Record<string, Reward[]> = {};
  rewards?.forEach(r => {
    if (r.isAllowance && !userState?.allowanceEnabled) return;
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  });

  return (
    <Card className="p-5">
      <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" />
        Reward Approvals
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Only approved rewards can be purchased by kids.
      </p>

      <div className="space-y-2">
        {Object.entries(grouped).map(([category, items]) => {
          const approvedCount = items.filter(r => r.approved).length;
          const isExpanded = expandedCategory === category;
          return (
            <div key={category} className="border rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : category)}
                className="w-full flex items-center justify-between p-4 text-left font-bold"
                data-testid={`button-category-${category}`}
              >
                <span>{category} ({approvedCount}/{items.length})</span>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {isExpanded && (
                <div className="border-t px-4 pb-3 space-y-2">
                  {items.map(reward => (
                    <div key={reward.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{reward.icon}</span>
                        <div>
                          <p className="font-bold text-sm">{reward.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{reward.cost} pts</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleApproval.mutate({ id: reward.id, approved: !reward.approved })}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          reward.approved
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}
                        data-testid={`button-approve-${reward.id}`}
                      >
                        {reward.approved ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function SettingsSection() {
  const { data: userState } = useUserState();
  const updateSettings = useUpdateSettings();
  const [email, setEmail] = useState("");
  const [allowance, setAllowance] = useState(false);
  const [pointsPerDollar, setPointsPerDollar] = useState(300);

  useEffect(() => {
    if (userState) {
      setEmail(userState.parentEmail || "");
      setAllowance(userState.allowanceEnabled);
      setPointsPerDollar(userState.pointsPerDollar);
    }
  }, [userState?.parentEmail, userState?.allowanceEnabled, userState?.pointsPerDollar]);

  const handleSave = () => {
    updateSettings.mutate({
      parentEmail: email || null,
      allowanceEnabled: allowance,
      pointsPerDollar,
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
          <label className="text-sm font-bold text-muted-foreground mb-1 block" data-testid="label-parent-email">Parent Email (for daily summaries)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="parent@example.com"
            className="w-full p-3 rounded-xl border bg-background text-foreground"
            data-testid="input-parent-email"
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl border">
          <div>
            <p className="font-bold text-sm">Allowance Mode</p>
            <p className="text-xs text-muted-foreground">Let kids convert points to money</p>
          </div>
          <button
            onClick={() => setAllowance(!allowance)}
            className={cn(
              "w-12 h-7 rounded-full transition-all relative",
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
            <label className="text-sm font-bold text-muted-foreground mb-1 block" data-testid="label-points-per-dollar">
              <DollarSign className="w-4 h-4 inline" /> Points per $1 (currently {pointsPerDollar})
            </label>
            <input
              type="range"
              min="100"
              max="500"
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
          disabled={updateSettings.isPending}
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
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl text-center">
              <p className="text-xs font-bold text-green-700 dark:text-green-400">Completed</p>
              <p className="text-2xl font-black text-green-600 dark:text-green-300">{summary.completedChores.length}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl text-center">
              <p className="text-xs font-bold text-red-700 dark:text-red-400">Missed</p>
              <p className="text-2xl font-black text-red-600 dark:text-red-300">{summary.missedChores.length}</p>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl flex items-center justify-between">
            <span className="text-sm font-bold text-blue-700 dark:text-blue-300">Points Today</span>
            <span className="font-mono font-black text-lg text-blue-600 dark:text-blue-300">
              {summary.pointsEarnedToday > 0 ? "+" : ""}{summary.pointsEarnedToday}
            </span>
          </div>

          {summary.bonuses.length > 0 && (
            <div className="text-sm">
              <p className="font-bold text-muted-foreground mb-1">Bonuses:</p>
              {summary.bonuses.map((b: any, i: number) => (
                <p key={i} className="text-foreground">+{b.points} - {b.reason} {b.note ? `(${b.note})` : ""}</p>
              ))}
            </div>
          )}

          <Button
            onClick={() => sendEmail.mutate()}
            disabled={sendEmail.isPending || !userState?.parentEmail}
            variant="outline"
            className="w-full"
            data-testid="button-send-summary-email"
          >
            {sendEmail.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {userState?.parentEmail ? "Send Summary Email" : "Set email in settings first"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

export default function ParentPanel() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <Header title="Parent Zone" />

      <div className="max-w-md mx-auto px-4 pt-6 space-y-6">
        <BonusSection />
        <ApprovalSection />
        <SummarySection />
        <SettingsSection />
      </div>
      <Navigation />
    </div>
  );
}
