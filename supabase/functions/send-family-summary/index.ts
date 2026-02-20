// HomeQuest — Edge Function: send-family-summary
// Builds the daily summary for a family and sends it via SendGrid Dynamic Template.
// Called by nightly-summary-runner (or manually for testing).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY")!;
const SENDGRID_TEMPLATE_ID = Deno.env.get("SENDGRID_TEMPLATE_DAILY_SUMMARY")!;
const SENDGRID_FROM_EMAIL = Deno.env.get("SENDGRID_FROM_EMAIL") || "homequest@oibrigado.com";
const SENDGRID_FROM_NAME = Deno.env.get("SENDGRID_FROM_NAME") || "HomeQuest";

interface ChildSummary {
  childName: string;
  completedChores: string[];
  missedChores: string[];
  bonuses: { reason: string; points: number; note: string | null }[];
  redemptions: { name: string; cost: number }[];
  pointsEarnedToday: number;
  currentBalance: number;
}

Deno.serve(async (req) => {
  try {
    const { family_id, date_key } = await req.json();
    if (!family_id || !date_key) {
      return new Response(JSON.stringify({ error: "family_id and date_key required" }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: settings, error: settingsErr } = await supabase
      .from("family_settings")
      .select("primary_parent_email, secondary_parent_email, timezone")
      .eq("family_id", family_id)
      .single();

    if (settingsErr || !settings) {
      throw new Error(`Failed to load family_settings: ${settingsErr?.message}`);
    }

    const recipients: string[] = [];
    if (settings.primary_parent_email?.trim()) recipients.push(settings.primary_parent_email.trim());
    if (settings.secondary_parent_email?.trim()) recipients.push(settings.secondary_parent_email.trim());

    if (recipients.length === 0) {
      throw new Error("No recipient emails configured");
    }

    const { data: children, error: childErr } = await supabase
      .from("children")
      .select("id, display_name")
      .eq("family_id", family_id)
      .order("created_at");

    if (childErr) throw new Error(`Failed to load children: ${childErr.message}`);
    if (!children || children.length === 0) {
      throw new Error("No children in family");
    }

    const childIds = children.map((c) => c.id);
    const tz = settings.timezone || "America/Denver";

    const { data: allChores } = await supabase
      .from("chore_catalog")
      .select("id, title")
      .eq("family_id", family_id)
      .eq("active", true);

    const choreMap = new Map((allChores || []).map((c) => [c.id, c.title]));

    const { data: dailyStatuses } = await supabase
      .from("daily_status_v2")
      .select("child_id, chore_id, completed")
      .eq("date_key", date_key)
      .in("child_id", childIds);

    // Convert local day boundaries to UTC for querying timestamptz columns
    const tzOffsetMs = (() => {
      const utcNoon = new Date(`${date_key}T12:00:00Z`);
      const localStr = utcNoon.toLocaleString("en-US", { timeZone: tz });
      const localDate = new Date(localStr);
      return localDate.getTime() - utcNoon.getTime();
    })();

    const dayStartUTC = new Date(new Date(`${date_key}T00:00:00`).getTime() - tzOffsetMs).toISOString();
    const dayEndUTC = new Date(new Date(`${date_key}T23:59:59.999`).getTime() - tzOffsetMs).toISOString();

    const { data: ledgerRows } = await supabase
      .from("points_ledger")
      .select("child_id, event_type, points_delta, ref_type, note")
      .in("child_id", childIds)
      .gte("created_at", dayStartUTC)
      .lte("created_at", dayEndUTC);

    const { data: redemptionRows } = await supabase
      .from("reward_redemptions")
      .select("child_id, cost, reward_id, reward_catalog(title)")
      .in("child_id", childIds)
      .gte("created_at", dayStartUTC)
      .lte("created_at", dayEndUTC);

    const { data: balanceRows } = await supabase
      .from("points_ledger")
      .select("child_id, points_delta")
      .in("child_id", childIds);

    const balanceMap = new Map<string, number>();
    for (const row of balanceRows || []) {
      balanceMap.set(row.child_id, (balanceMap.get(row.child_id) || 0) + row.points_delta);
    }

    let totalCompleted = 0;
    let totalMissed = 0;
    let totalPointsEarned = 0;

    const childSummaries: ChildSummary[] = children.map((child) => {
      const statuses = (dailyStatuses || []).filter((s) => s.child_id === child.id);

      const completedChoreIds = new Set(statuses.map((s) => s.chore_id));
      const completedChores: string[] = [];
      const missedChores: string[] = [];

      for (const [choreId, title] of choreMap) {
        if (completedChoreIds.has(choreId)) {
          completedChores.push(title);
        } else {
          missedChores.push(title);
        }
      }

      const childLedger = (ledgerRows || []).filter((l) => l.child_id === child.id);
      const bonuses = childLedger
        .filter((l) => l.event_type === "bonus")
        .map((l) => ({ reason: l.note || "Bonus", points: l.points_delta, note: l.note }));

      const childRedemptions = (redemptionRows || []).filter((r) => r.child_id === child.id);
      const redemptions = childRedemptions.map((r) => ({
        name: (r.reward_catalog as any)?.title || "Reward",
        cost: r.cost,
      }));

      const pointsEarnedToday = childLedger
        .filter((l) => l.points_delta > 0)
        .reduce((sum, l) => sum + l.points_delta, 0);

      totalCompleted += completedChores.length;
      totalMissed += missedChores.length;
      totalPointsEarned += pointsEarnedToday;

      return {
        childName: child.display_name,
        completedChores,
        missedChores,
        bonuses,
        redemptions,
        pointsEarnedToday,
        currentBalance: balanceMap.get(child.id) || 0,
      };
    });

    const { data: familyRow } = await supabase
      .from("families")
      .select("name")
      .eq("id", family_id)
      .single();

    const templateData = {
      date: date_key,
      familyName: familyRow?.name || "My Family",
      children: childSummaries,
      totalPointsEarned,
      totalChoresCompleted: totalCompleted,
      totalChoresMissed: totalMissed,
    };

    const personalizations = recipients.map((email) => ({
      to: [{ email }],
      dynamic_template_data: templateData,
    }));

    const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_id: SENDGRID_TEMPLATE_ID,
        personalizations,
        from: { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME },
      }),
    });

    if (!sgResponse.ok) {
      const sgError = await sgResponse.text();
      console.error("SendGrid error:", sgResponse.status, sgError);

      await supabase.from("email_send_log").upsert({
        family_id,
        date_key,
        status: "failed",
        error: `SendGrid ${sgResponse.status}: ${sgError}`,
      }, { onConflict: "family_id,date_key" });

      throw new Error(`SendGrid ${sgResponse.status}: ${sgError}`);
    }

    await supabase.from("email_send_log").upsert({
      family_id,
      date_key,
      status: "sent",
      error: null,
    }, { onConflict: "family_id,date_key" });

    return new Response(
      JSON.stringify({ ok: true, recipients: recipients.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-family-summary error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
