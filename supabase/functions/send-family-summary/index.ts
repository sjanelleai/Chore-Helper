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

    // Use canonical family_daily_summary RPC — single source of truth
    const { data: summaryRows, error: summaryErr } = await supabase.rpc("family_daily_summary", {
      p_family_id: family_id,
      p_date_key: date_key,
    });

    if (summaryErr) throw new Error(`family_daily_summary failed: ${summaryErr.message}`);
    if (!summaryRows || summaryRows.length === 0) {
      throw new Error("No children in family or no summary data");
    }

    let totalCompleted = 0;
    let totalMissed = 0;
    let totalPointsEarned = 0;

    const childSummaries: ChildSummary[] = summaryRows.map((row: any) => {
      const completedChores: string[] = row.completed_chores || [];
      const missedChores: string[] = row.missed_chores || [];
      const bonuses = (row.bonuses || []).map((b: any) => ({
        reason: b.reason || "Bonus",
        points: b.points,
        note: b.reason || null,
      }));
      const redemptions = (row.redemptions || []).map((r: any) => ({
        name: r.name || "Reward",
        cost: r.cost,
      }));

      totalCompleted += completedChores.length;
      totalMissed += missedChores.length;
      totalPointsEarned += row.points_today || 0;

      return {
        childName: row.child_name,
        completedChores,
        missedChores,
        bonuses,
        redemptions,
        pointsEarnedToday: row.points_today || 0,
        currentBalance: row.current_balance || 0,
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
