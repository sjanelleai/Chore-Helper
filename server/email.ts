
// SendGrid integration for daily parent email summaries
import sgMail from '@sendgrid/mail';

interface SendGridConnectorSettings {
  settings?: {
    api_key?: string;
    from_email?: string;
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let connectionSettings: SendGridConnectorSettings | undefined;

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

  if (!hostname) {
    throw new Error('REPLIT_CONNECTORS_HOSTNAME not set');
  }

  const url = 'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid';
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`SendGrid connector fetch failed: ${response.status} ${response.statusText}`, body);
    throw new Error(`SendGrid connector request failed (${response.status}): ${body || response.statusText}`);
  }

  const data = await response.json();
  connectionSettings = data.items?.[0];

  if (!connectionSettings || (!connectionSettings.settings?.api_key || !connectionSettings.settings?.from_email)) {
    console.error('SendGrid connector response:', JSON.stringify(data, null, 2));
    throw new Error('SendGrid not connected — missing api_key or from_email in connector settings');
  }
  return { apiKey: connectionSettings.settings.api_key, email: connectionSettings.settings.from_email };
}

async function getUncachableSendGridClient() {
  const { apiKey, email } = await getCredentials();
  sgMail.setApiKey(apiKey);
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || email;
  return {
    client: sgMail,
    fromEmail
  };
}

export interface ChildDailySummary {
  childName: string;
  completedChores: string[];
  missedChores: string[];
  bonuses: { reason: string; points: number; note: string | null }[];
  redemptions: { name: string; cost: number }[];
  pointsEarnedToday: number;
  currentBalance: number;
}

export interface FamilySummaryData {
  date: string;
  familyName: string;
  children: ChildDailySummary[];
  totalPointsEarned: number;
  totalChoresCompleted: number;
  totalChoresMissed: number;
}

function renderChildSection(child: ChildDailySummary): string {
  const completedList = child.completedChores.length > 0
    ? child.completedChores.map(c => `<li style="padding:3px 0;color:#16a34a;">&#10003; ${escapeHtml(c)}</li>`).join('')
    : '<li style="color:#9ca3af;">No chores completed today</li>';

  const missedList = child.missedChores.length > 0
    ? child.missedChores.map(c => `<li style="padding:3px 0;color:#ef4444;">&#10007; ${escapeHtml(c)}</li>`).join('')
    : '<li style="color:#22c55e;">All chores completed!</li>';

  const bonusList = child.bonuses.length > 0
    ? child.bonuses.map(b => `<li style="padding:3px 0;">+${b.points} pts - ${escapeHtml(b.reason)}${b.note ? ` (${escapeHtml(b.note)})` : ''}</li>`).join('')
    : '';

  const redemptionList = child.redemptions.length > 0
    ? child.redemptions.map(r => `<li style="padding:3px 0;">-${r.cost} pts - ${escapeHtml(r.name)}</li>`).join('')
    : '';

  return `
    <div style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:12px 16px;">
        <h2 style="margin:0;color:#ffffff;font-size:20px;">${escapeHtml(child.childName)}</h2>
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
        </div>` : ''}

        ${redemptionList ? `
        <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:12px;margin-bottom:8px;">
          <h4 style="margin:0 0 6px;color:#6b21a8;font-size:13px;">Purchases</h4>
          <ul style="margin:0;padding-left:16px;list-style:none;font-size:13px;">${redemptionList}</ul>
        </div>` : ''}

        <div style="background:#fefce8;border:1px solid #fef08a;border-radius:8px;padding:10px;text-align:center;">
          <span style="color:#854d0e;font-size:12px;font-weight:bold;">POINTS TODAY: </span>
          <span style="font-size:18px;font-weight:900;color:#a16207;">${child.pointsEarnedToday > 0 ? '+' : ''}${child.pointsEarnedToday}</span>
        </div>
      </div>
    </div>`;
}

function formatFamilySummaryEmail(summary: FamilySummaryData): { subject: string; html: string } {
  const dateFormatted = new Date(summary.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = `HomeQuest Daily Summary - ${dateFormatted}`;

  const childSections = summary.children.map(renderChildSection).join('');

  const html = `
  <div style="font-family:'DM Sans',system-ui,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:32px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:28px;">HomeQuest</h1>
      <p style="margin:8px 0 0;color:#e0e7ff;font-size:14px;">${escapeHtml(summary.familyName)} - Daily Summary</p>
      <p style="margin:4px 0 0;color:#c7d2fe;font-size:12px;">${dateFormatted}</p>
    </div>

    <div style="padding:24px;">
      <div style="display:flex;gap:12px;margin-bottom:24px;">
        <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;text-align:center;">
          <p style="margin:0;color:#166534;font-size:11px;font-weight:bold;">TOTAL COMPLETED</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:900;color:#16a34a;">${summary.totalChoresCompleted}</p>
        </div>
        <div style="flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;text-align:center;">
          <p style="margin:0;color:#991b1b;font-size:11px;font-weight:bold;">TOTAL REMAINING</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:900;color:#ef4444;">${summary.totalChoresMissed}</p>
        </div>
        <div style="flex:1;background:#fefce8;border:1px solid #fef08a;border-radius:10px;padding:14px;text-align:center;">
          <p style="margin:0;color:#854d0e;font-size:11px;font-weight:bold;">POINTS EARNED</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:900;color:#a16207;">${summary.totalPointsEarned > 0 ? '+' : ''}${summary.totalPointsEarned}</p>
        </div>
      </div>

      ${childSections}
    </div>

    <div style="padding:16px 24px;background:#f8fafc;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">Sent from HomeQuest - Chore Helper</p>
    </div>
  </div>`;

  return { subject, html };
}

export async function sendFamilySummaryEmail(toEmails: string[], summary: FamilySummaryData): Promise<void> {
  const { client, fromEmail } = await getUncachableSendGridClient();
  const { subject, html } = formatFamilySummaryEmail(summary);

  try {
    const sendPromises = toEmails.map(email =>
      client.send({
        to: email,
        from: fromEmail,
        subject,
        html,
      })
    );

    await Promise.all(sendPromises);
  } catch (err: unknown) {
    if (err instanceof Error && 'response' in err) {
      const sgErr = err as Error & { response?: { body?: { errors?: Array<{ message: string }> } } };
      if (sgErr.response?.body?.errors) {
        const sgErrors = sgErr.response.body.errors;
        console.error('SendGrid API errors:', JSON.stringify(sgErrors, null, 2));
        const messages = sgErrors.map(e => e.message).join('; ');
        throw new Error(`SendGrid: ${messages}`);
      }
    }
    throw err;
  }
}
