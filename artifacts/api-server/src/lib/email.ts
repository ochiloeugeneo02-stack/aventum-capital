import { logger } from "./logger";

interface InviteEmailData {
  inviteToken: string;
  inviteeName: string | null;
  inviteeEmail: string;
  inviterName: string;
  groupName: string;
  groupCurrency: string;
  contributionAmount: number;
  schedule: string;
  maxMembers: number;
  totalMembers: number;
  appBaseUrl: string;
}

function formatContributionAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function scheduleLabel(s: string): string {
  if (s === "weekly") return "weekly";
  if (s === "bi-weekly") return "every two weeks";
  if (s === "monthly") return "monthly";
  return s;
}

export function buildInviteEmailHtml(data: InviteEmailData): string {
  const inviteUrl = `${data.appBaseUrl}/invite/${data.inviteToken}`;
  const amount = formatContributionAmount(data.contributionAmount, data.groupCurrency);
  const greeting = data.inviteeName ? `Hi ${data.inviteeName},` : "Hi there,";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to join ${data.groupName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #f5f5f0; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
    .wrapper { max-width: 560px; margin: 40px auto; padding: 0 16px 48px; }
    .logo-bar { text-align: center; margin-bottom: 24px; }
    .logo-text { font-size: 20px; font-weight: 700; color: #344E41; letter-spacing: -0.5px; }
    .logo-dot { color: #588157; }
    .card { background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .card-header { background: linear-gradient(135deg, #344E41 0%, #3A5A40 100%); padding: 40px 40px 36px; text-align: center; }
    .header-badge { display: inline-block; background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.9); font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; padding: 6px 14px; border-radius: 100px; margin-bottom: 20px; }
    .header-title { font-size: 26px; font-weight: 700; color: #ffffff; line-height: 1.3; margin-bottom: 8px; }
    .header-sub { font-size: 15px; color: rgba(255,255,255,0.7); }
    .card-body { padding: 36px 40px; }
    .greeting { font-size: 16px; color: #374151; line-height: 1.6; margin-bottom: 20px; }
    .divider { height: 1px; background: #f0ede8; margin: 24px 0; }
    .group-box { background: #f9f8f6; border: 1px solid #e8e4df; border-radius: 14px; padding: 22px 24px; margin-bottom: 24px; }
    .group-label { font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #9ca3af; margin-bottom: 6px; }
    .group-name { font-size: 20px; font-weight: 700; color: #1f2937; margin-bottom: 16px; }
    .group-stats { display: flex; gap: 0; }
    .stat { flex: 1; }
    .stat + .stat { border-left: 1px solid #e8e4df; padding-left: 16px; margin-left: 16px; }
    .stat-val { font-size: 18px; font-weight: 700; color: #344E41; }
    .stat-key { font-size: 12px; color: #9ca3af; margin-top: 2px; }
    .cta-button { display: block; background: linear-gradient(135deg, #3A5A40 0%, #344E41 100%); color: #ffffff !important; text-decoration: none; text-align: center; padding: 16px 32px; border-radius: 12px; font-size: 16px; font-weight: 600; letter-spacing: 0.2px; margin: 0 0 16px; }
    .link-line { text-align: center; font-size: 13px; color: #9ca3af; }
    .link-line a { color: #588157; text-decoration: none; word-break: break-all; }
    .footer { text-align: center; margin-top: 28px; font-size: 12px; color: #9ca3af; line-height: 1.7; }
    .footer a { color: #588157; text-decoration: none; }
    .expires { font-size: 12px; color: #9ca3af; text-align: center; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="logo-bar">
      <div class="logo-text">Aventum<span class="logo-dot">.</span></div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="header-badge">Group Invitation</div>
        <div class="header-title">You've been invited to join a savings circle</div>
        <div class="header-sub">${data.inviterName} wants you in their group</div>
      </div>

      <div class="card-body">
        <p class="greeting">${greeting}</p>
        <p class="greeting"><strong>${data.inviterName}</strong> has invited you to join their rotating savings group on Aventum. Here's what you need to know:</p>

        <div class="group-box">
          <div class="group-label">Your Group</div>
          <div class="group-name">${data.groupName}</div>
          <div class="group-stats">
            <div class="stat">
              <div class="stat-val">${amount}</div>
              <div class="stat-key">Contribution · ${scheduleLabel(data.schedule)}</div>
            </div>
            <div class="stat">
              <div class="stat-val">${data.totalMembers}/${data.maxMembers}</div>
              <div class="stat-key">Members joined</div>
            </div>
          </div>
        </div>

        <a href="${inviteUrl}" class="cta-button">Accept invitation →</a>

        <div class="link-line">
          Or copy this link: <a href="${inviteUrl}">${inviteUrl}</a>
        </div>

        <div class="divider"></div>

        <p style="font-size:13px;color:#6b7280;line-height:1.7;">
          Aventum is a trusted platform for rotating savings groups (chamas). Each member contributes ${amount} ${scheduleLabel(data.schedule)}, and the full pool is paid out to one member at a time — rotating until everyone has received their share.
        </p>

        <p class="expires">This invitation expires in 7 days.</p>
      </div>
    </div>

    <div class="footer">
      <p>© ${new Date().getFullYear()} Aventum Capital. All rights reserved.</p>
      <p style="margin-top:4px;">If you weren't expecting this invitation, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendInviteEmail(data: InviteEmailData): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM ?? "noreply@aventum.co";
  const smtpPort = parseInt(process.env.SMTP_PORT ?? "587", 10);

  const inviteUrl = `${data.appBaseUrl}/invite/${data.inviteToken}`;
  const html = buildInviteEmailHtml(data);
  const subject = `${data.inviterName} invited you to join ${data.groupName} on Aventum`;

  if (!smtpHost || !smtpUser || !smtpPass) {
    logger.info({ email: data.inviteeEmail, inviteUrl }, "Email SMTP not configured — invite link generated");
    return false;
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"Aventum Capital" <${smtpFrom}>`,
      to: data.inviteeEmail,
      subject,
      html,
    });

    logger.info({ email: data.inviteeEmail }, "Invite email sent");
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to send invite email");
    return false;
  }
}
