// HomeQuest — Edge Function: send-family-summary
// Builds the daily summary for a family and sends it via SendGrid inline HTML.
// Called by nightly-summary-runner (or manually for testing).
// No SendGrid Dynamic Template required — email is rendered inline.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY")!;
const SENDGRID_FROM_EMAIL = Deno.env.get("SENDGRID_FROM_EMAIL") || "apps@oibrigado.com";
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

function renderChildSection(child: ChildSummary): string {
  const completedList = child.completedChores.length > 0
    ? child.completedChores.map(c => `<li style="padding:3px 0;color:#16a34a;">&#10003; ${c}</li>`).join("")
    : '<li style="color:#9ca3af;">No chores completed today</li>';

  const missedList = child.missedChores.length > 0
    ? child.missedChores.map(c => `<li style="padding:3px 0;color:#ef4444;">&#10007; ${c}</li>`).join("")
    : '<li style="color:#22c55e;">All chores completed!</li>';

  const bonusList = child.bonuses.length > 0
    ? child.bonuses.map(b => `<li style="padding:3px 0;">+${b.points} pts — ${b.reason}${b.note && b.note !== b.reason ? ` (${b.note})` : ""}</li>`).join("")
    : "";

  const redemptionList = child.redemptions.length > 0
    ? child.redemptions.map(r => `<li style="padding:3px 0;">-${r.cost} pts — ${r.name}</li>`).join("")
    : "";

  return `
    <div style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:12px 16px;">
        <h2 style="margin:0;color:#ffffff;font-size:20px;">${child.childName}</h2>
      </div>
      <div style="padding:16px;">
        <div style="display:flex;gap:12px;margin-bottom:16px;">
          <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center;">
            <p style="margin:0;color:#166534;font-size:11px;font-weight:bold;">COMPLETED</p>
            <p style="margin:4px 0 0;font-size:24px;font-weight:900;color:#16a34a;">${child.completedChores.length}</p>
          </div>
          <div style="flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;text-align:center;">
            <p style="margin:0;color:#991b1b;font-size:11px;font-weight:bold;">REMAINING</p>
            <p style="margin:4px 0 0;font-size:24px;font-weight:900;color:#ef4444;">${child.missedChores.length}</p>
          </div>
          <div style="flex:1;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px;text-align:center;">
            <p style="margin:0;color:#0369a1;font-size:11px;font-weight:bold;">BALANCE</p>
            <p style="margin:4px 0 0;font-size:24px;font-weight:900;color:#0284c7;">${child.currentBalance}</p>
          </div>
        </div>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin-bottom:8px;">
          <h4 style="margin:0 0 6px;color:#166534;font-size:13px;">Completed Chores</h4>
          <ul style="margin:0;padding-left:16px;list-style:none;font-size:13px;">${completedList}</ul>
        </div>

        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:8px;">
          <h4 style="margin:0 0 6px;color:#991b1b;font-size:13px;">Remaining Chores</h4>
          <ul style="margin:0;padding-left:16px;list-style:none;font-size:13px;">${missedList}</ul>
        </div>

        ${bonusList ? `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin-bottom:8px;">
          <h4 style="margin:0 0 6px;color:#1e40af;font-size:13px;">Bonuses</h4>
          <ul style="margin:0;padding-left:16px;list-style:none;font-size:13px;">${bonusList}</ul>
        </div>` : ""}

        ${redemptionList ? `
        <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:12px;margin-bottom:8px;">
          <h4 style="margin:0 0 6px;color:#6b21a8;font-size:13px;">Rewards Redeemed</h4>
          <ul style="margin:0;padding-left:16px;list-style:none;font-size:13px;">${redemptionList}</ul>
        </div>` : ""}

        <div style="background:#fefce8;border:1px solid #fef08a;border-radius:8px;padding:10px;text-align:center;">
          <span style="color:#854d0e;font-size:12px;font-weight:bold;">POINTS TODAY: </span>
          <span style="font-size:18px;font-weight:900;color:#a16207;">${child.pointsEarnedToday > 0 ? "+" : ""}${child.pointsEarnedToday}</span>
        </div>
      </div>
    </div>`;
}

function formatFamilySummaryEmail(data: {
  date: string;
  familyName: string;
  children: ChildSummary[];
  totalPointsEarned: number;
  totalChoresCompleted: number;
  totalChoresMissed: number;
}): { subject: string; html: string } {
  const dateFormatted = new Date(data.date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const subject = `HomeQuest Daily Summary — ${dateFormatted}`;

  const childSections = data.children.map(renderChildSection).join("");

  const html = `
  <div style="font-family:'DM Sans',system-ui,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:32px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:28px;">HomeQuest</h1>
      <p style="margin:8px 0 0;color:#e0e7ff;font-size:14px;">${data.familyName} — Daily Summary</p>
      <p style="margin:4px 0 0;color:#c7d2fe;font-size:12px;">${dateFormatted}</p>
    </div>

    <div style="padding:24px;">
      <div style="display:flex;gap:12px;margin-bottom:24px;">
        <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;text-align:center;">
          <p style="margin:0;color:#166534;font-size:11px;font-weight:bold;">TOTAL COMPLETED</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:900;color:#16a34a;">${data.totalChoresCompleted}</p>
        </div>
        <div style="flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;text-align:center;">
          <p style="margin:0;color:#991b1b;font-size:11px;font-weight:bold;">TOTAL REMAINING</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:900;color:#ef4444;">${data.totalChoresMissed}</p>
        </div>
        <div style="flex:1;background:#fefce8;border:1px solid #fef08a;border-radius:10px;padding:14px;text-align:center;">
          <p style="margin:0;color:#854d0e;font-size:11px;font-weight:bold;">POINTS EARNED</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:900;color:#a16207;">${data.totalPointsEarned > 0 ? "+" : ""}${data.totalPointsEarned}</p>
        </div>
      </div>

      ${childSections}
    </div>

    <div style="padding:16px 24px;background:#f8fafc;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">Sent from HomeQuest — Chore Helper</p>
      <p style="margin:4px 0 0;color:#cbd5e1;font-size:11px;">To stop receiving these emails, turn off Daily Summary in the Parent Portal.</p>
    </div>
  </div>`;

  return { subject, html };
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
        note: b.note || null,
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

    const { subject, html } = formatFamilySummaryEmail({
      date: date_key,
      familyName: familyRow?.name || "My Family",
      children: childSummaries,
      totalPointsEarned,
      totalChoresCompleted: totalCompleted,
      totalChoresMissed: totalMissed,
    });

    // Send to each recipient individually so each gets a personal copy
    const personalizations = recipients.map((email) => ({ to: [{ email }] }));

    const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations,
        from: { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME },
        subject,
        content: [{ type: "text/html", value: html }],
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
