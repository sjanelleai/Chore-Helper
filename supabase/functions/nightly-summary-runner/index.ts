// HomeQuest — Edge Function: nightly-summary-runner
// Called by Supabase Cron every 15 minutes.
// Finds families due for their nightly summary email and triggers send-family-summary.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: families, error } = await supabase
      .from("family_settings")
      .select("family_id, primary_parent_email, secondary_parent_email, daily_summary_time_local, timezone")
      .eq("daily_summary_enabled", true)
      .not("primary_parent_email", "is", null);

    if (error) {
      console.error("Error querying family_settings:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!families || families.length === 0) {
      return new Response(JSON.stringify({ message: "No families eligible", sent: 0 }));
    }

    let sentCount = 0;
    let skipCount = 0;
    const errors: string[] = [];

    for (const family of families) {
      try {
        if (!family.daily_summary_time_local || !family.timezone) {
          continue;
        }

        const hasRecipient = family.primary_parent_email?.trim() || family.secondary_parent_email?.trim();
        if (!hasRecipient) continue;

        const now = new Date();
        const nowInTz = new Date(now.toLocaleString("en-US", { timeZone: family.timezone }));
        const currentMinutes = nowInTz.getHours() * 60 + nowInTz.getMinutes();

        const [targetH, targetM] = family.daily_summary_time_local.split(":").map(Number);
        const targetMinutes = targetH * 60 + targetM;

        const diff = currentMinutes - targetMinutes;
        const isDue = diff >= 0 && diff < 15;

        if (!isDue) continue;

        const dateKey = `${nowInTz.getFullYear()}-${String(nowInTz.getMonth() + 1).padStart(2, "0")}-${String(nowInTz.getDate()).padStart(2, "0")}`;

        const { data: existing } = await supabase
          .from("email_send_log")
          .select("id")
          .eq("family_id", family.family_id)
          .eq("date_key", dateKey)
          .maybeSingle();

        if (existing) {
          skipCount++;
          continue;
        }

        const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/send-family-summary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ family_id: family.family_id, date_key: dateKey }),
        });

        if (sendRes.ok) {
          sentCount++;
        } else {
          const errBody = await sendRes.text();
          errors.push(`Family ${family.family_id}: ${errBody}`);
        }
      } catch (err) {
        errors.push(`Family ${family.family_id}: ${(err as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Runner complete",
        eligible: families.length,
        sent: sentCount,
        skipped: skipCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Runner error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
