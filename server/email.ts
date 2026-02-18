
// SendGrid integration for daily parent email summaries
import sgMail from '@sendgrid/mail';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
    throw new Error('SendGrid not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, email: connectionSettings.settings.from_email };
}

async function getUncachableSendGridClient() {
  const { apiKey, email } = await getCredentials();
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: email
  };
}

export interface DailySummaryData {
  date: string;
  completedChores: string[];
  missedChores: string[];
  bonuses: { reason: string; points: number; note: string | null }[];
  redemptions: { name: string; cost: number }[];
  pointsEarnedToday: number;
  currentBalance: number;
}

function formatSummaryEmail(summary: DailySummaryData): { subject: string; html: string } {
  const dateFormatted = new Date(summary.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = `Chore Helper Summary - ${dateFormatted}`;

  const completedList = summary.completedChores.length > 0
    ? summary.completedChores.map(c => `<li style="padding:4px 0;color:#16a34a;">&#10003; ${c}</li>`).join('')
    : '<li style="color:#9ca3af;">No chores completed today</li>';

  const missedList = summary.missedChores.length > 0
    ? summary.missedChores.map(c => `<li style="padding:4px 0;color:#ef4444;">&#10007; ${c}</li>`).join('')
    : '<li style="color:#22c55e;">All chores completed!</li>';

  const bonusList = summary.bonuses.length > 0
    ? summary.bonuses.map(b => `<li style="padding:4px 0;">+${b.points} pts - ${b.reason}${b.note ? ` (${b.note})` : ''}</li>`).join('')
    : '<li style="color:#9ca3af;">No bonuses today</li>';

  const redemptionList = summary.redemptions.length > 0
    ? summary.redemptions.map(r => `<li style="padding:4px 0;">-${r.cost} pts - ${r.name}</li>`).join('')
    : '<li style="color:#9ca3af;">No purchases today</li>';

  const html = `
  <div style="font-family:'DM Sans',system-ui,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:32px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:28px;">Chore Helper</h1>
      <p style="margin:8px 0 0;color:#e0e7ff;font-size:14px;">Daily Summary - ${dateFormatted}</p>
    </div>
    
    <div style="padding:24px;">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:16px;">
        <h3 style="margin:0 0 8px;color:#166534;">Completed Chores</h3>
        <ul style="margin:0;padding-left:20px;list-style:none;">${completedList}</ul>
      </div>

      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin-bottom:16px;">
        <h3 style="margin:0 0 8px;color:#991b1b;">Missed Chores</h3>
        <ul style="margin:0;padding-left:20px;list-style:none;">${missedList}</ul>
      </div>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin-bottom:16px;">
        <h3 style="margin:0 0 8px;color:#1e40af;">Bonuses Awarded</h3>
        <ul style="margin:0;padding-left:20px;list-style:none;">${bonusList}</ul>
      </div>

      <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:16px;margin-bottom:16px;">
        <h3 style="margin:0 0 8px;color:#6b21a8;">Purchases / Redemptions</h3>
        <ul style="margin:0;padding-left:20px;list-style:none;">${redemptionList}</ul>
      </div>

      <div style="display:flex;gap:16px;margin-top:24px;">
        <div style="flex:1;background:#fefce8;border:1px solid #fef08a;border-radius:12px;padding:16px;text-align:center;">
          <p style="margin:0;color:#854d0e;font-size:12px;font-weight:bold;">EARNED TODAY</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:900;color:#a16207;">${summary.pointsEarnedToday > 0 ? '+' : ''}${summary.pointsEarnedToday}</p>
        </div>
        <div style="flex:1;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:16px;text-align:center;">
          <p style="margin:0;color:#0369a1;font-size:12px;font-weight:bold;">CURRENT BALANCE</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:900;color:#0284c7;">${summary.currentBalance}</p>
        </div>
      </div>
    </div>

    <div style="padding:16px 24px;background:#f8fafc;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">Sent from Chore Helper</p>
    </div>
  </div>`;

  return { subject, html };
}

export async function sendDailySummaryEmail(toEmail: string, summary: DailySummaryData): Promise<void> {
  const { client, fromEmail } = await getUncachableSendGridClient();
  const { subject, html } = formatSummaryEmail(summary);

  await client.send({
    to: toEmail,
    from: fromEmail,
    subject,
    html,
  });
}
