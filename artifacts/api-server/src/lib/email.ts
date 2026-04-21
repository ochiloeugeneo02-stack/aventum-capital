import { logger } from "./logger";

async function sendViaResend(to: string | string[], subject: string, html: string): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM ?? "Aventum Capital <onboarding@resend.dev>";
  if (!resendApiKey) {
    logger.info({ to }, "No email provider — email skipped");
    return false;
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(resendApiKey);
    const { data, error } = await resend.emails.send({ from: fromEmail, to, subject, html });
    if (error) { logger.error({ error, to, subject }, "Resend delivery error"); return false; }
    logger.info({ to, subject, resendEmailId: data?.id }, "Email sent via Resend");
    return true;
  } catch (err) {
    logger.error({ err, to, subject }, "Resend send failed");
    return false;
  }
}

function buildEmailWrapper(opts: { headerTitle: string; headerSubtitle: string; bodyHtml: string }): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
</head>
<body style="margin:0;padding:0;background:#f7f6f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f7f6f2;padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;margin:0 auto;">
        <tr><td style="background:#ffffff;border:1px solid #ebe8df;border-radius:22px;overflow:hidden;box-shadow:0 18px 48px rgba(52,78,65,0.10);">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="padding:38px 40px 20px;">
              <div style="font-size:21px;font-weight:700;color:#344E41;letter-spacing:-0.3px;line-height:1;">Aventum<span style="color:#588157;">.</span></div>
              <div style="font-size:10px;font-weight:700;color:#9aa38d;letter-spacing:2.4px;text-transform:uppercase;margin-top:5px;">Capital</div>
            </td></tr>
            <tr><td style="padding:22px 40px 6px;">
              <h1 style="font-size:30px;line-height:1.08;font-weight:700;letter-spacing:-0.9px;color:#2f3741;margin:0 0 18px;">${opts.headerTitle}</h1>
              <p style="font-size:14px;line-height:1.65;color:#5f6670;margin:0;">${opts.headerSubtitle}</p>
            </td></tr>
            <tr><td style="padding:24px 40px 36px;">${opts.bodyHtml}</td></tr>
            <tr><td style="padding:0 40px 34px;">
              <div style="height:1px;background:#e7e4dc;margin-bottom:20px;"></div>
              <p style="font-size:12px;line-height:1.65;color:#969da6;margin:0;">© ${year} Aventum Capital. You received this email because you have an Aventum account or were invited to join a savings group.</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding-top:22px;">
          <a href="https://aventumcapital.com" style="font-size:12px;color:#7d6c54;text-decoration:underline;">View Aventum Capital</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

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

function formatAmount(amount: number, currency: string): string {
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
  const contribution = formatAmount(data.contributionAmount, data.groupCurrency);
  const pool = formatAmount(data.contributionAmount * data.maxMembers, data.groupCurrency);
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>You've been invited to ${data.groupName}</title>
</head>
<body style="margin:0;padding:0;background:#f7f6f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f7f6f2;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;margin:0 auto;">
          <tr>
            <td style="background:#ffffff;border:1px solid #ebe8df;border-radius:22px;overflow:hidden;box-shadow:0 18px 48px rgba(52,78,65,0.10);">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:38px 40px 42px;">
                    <div style="font-size:21px;font-weight:700;color:#344E41;letter-spacing:-0.3px;line-height:1;">Aventum<span style="color:#588157;">.</span></div>
                    <div style="font-size:10px;font-weight:700;color:#9aa38d;letter-spacing:2.4px;text-transform:uppercase;margin-top:5px;">Capital</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 40px 26px;">
                    <h1 style="font-size:30px;line-height:1.08;font-weight:700;letter-spacing:-0.9px;color:#2f3741;margin:0 0 24px;">You have been invited to join a savings group.</h1>
                    <p style="font-size:15px;line-height:1.72;color:#4f5661;margin:0 0 8px;">Hi ${data.inviteeName ?? "there"},</p>
                    <p style="font-size:15px;line-height:1.72;color:#4f5661;margin:0;"><strong style="color:#2f3741;">${data.inviterName}</strong> invited you to join their rotating savings group on Aventum Capital.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 40px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fbfaf7;border:1px solid #ebe8df;border-radius:16px;overflow:hidden;">
                      <tr>
                        <td colspan="2" style="padding:20px 22px 12px;">
                          <div style="font-size:10px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#9aa38d;margin-bottom:6px;">Your group</div>
                          <div style="font-size:18px;font-weight:700;color:#303842;line-height:1.3;">${data.groupName}</div>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="padding:12px 22px 22px;border-top:1px solid #ebe8df;border-right:1px solid #ebe8df;">
                          <div style="font-size:24px;font-weight:700;letter-spacing:-0.4px;color:#344E41;">${contribution}</div>
                          <div style="font-size:12px;line-height:1.45;color:#8c929a;margin-top:4px;">Contribution · ${scheduleLabel(data.schedule)}</div>
                        </td>
                        <td width="50%" style="padding:12px 22px 22px;border-top:1px solid #ebe8df;">
                          <div style="font-size:24px;font-weight:700;letter-spacing:-0.4px;color:#344E41;">${pool}</div>
                          <div style="font-size:12px;line-height:1.45;color:#8c929a;margin-top:4px;">Pool at full capacity</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:30px 40px 18px;">
                    <a href="${inviteUrl}" style="display:inline-block;background:#3A5A40;color:#ffffff;text-decoration:none;text-align:center;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:0.1px;">Accept invitation</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 40px 30px;">
                    <p style="font-size:12px;line-height:1.7;color:#969da6;margin:0;">Or copy this link: <a href="${inviteUrl}" style="color:#588157;text-decoration:underline;word-break:break-all;">${inviteUrl}</a></p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 40px;">
                    <div style="height:1px;background:#e7e4dc;"></div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 40px 12px;">
                    <p style="font-size:13px;color:#6b7280;line-height:1.7;margin:0 0 14px;">
                      Aventum is a platform for rotating savings circles. Everyone contributes ${contribution} ${scheduleLabel(data.schedule)}, and the full pool is paid out to one member at a time — rotating until everyone has received their share.
                    </p>
                    <p style="font-size:12px;color:#969da6;line-height:1.65;margin:0;">This invitation expires in 7 days. If you were not expecting this invitation, you can safely ignore this email.</p>
                  </td>
                </tr>
                <tr><td style="height:30px;"></td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:22px;">
              <p style="font-size:12px;color:#969da6;line-height:1.7;margin:0;">© ${year} Aventum Capital. All rights reserved.</p>
              <a href="${data.appBaseUrl}" style="font-size:12px;color:#7d6c54;text-decoration:underline;">View this email in your browser</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

interface PasswordResetEmailData {
  email: string;
  name: string;
  token: string;
  appBaseUrl: string;
}

interface OtpEmailData {
  email: string;
  name: string;
  otp: string;
  purpose: "login" | "enable_2fa";
}

export async function sendOtpEmail(data: OtpEmailData): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM ?? "Aventum Capital <onboarding@resend.dev>";
  const purposeLabel = data.purpose === "enable_2fa" ? "enable two-factor authentication" : "sign in";

  const html = buildEmailWrapper({
    headerTitle: "Your verification code",
    headerSubtitle: `Hi ${data.name}, use this code to ${purposeLabel}. It expires in 10 minutes.`,
    bodyHtml: `
      <div style="background:#fbfaf7;border:1px solid #ebe8df;border-radius:16px;padding:28px 20px;text-align:center;margin-bottom:22px;">
        <div style="font-size:44px;line-height:1;font-weight:800;letter-spacing:10px;color:#344E41;font-family:'Courier New',monospace;">${data.otp}</div>
      </div>
      <p style="font-size:13px;line-height:1.7;color:#969da6;margin:0;">Do not share this code with anyone. If you did not request it, you can safely ignore this email.</p>`,
  });

  const subject = data.purpose === "enable_2fa"
    ? "Your Aventum 2FA setup code"
    : "Your Aventum sign-in code";

  if (resendApiKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(resendApiKey);
      const { error } = await resend.emails.send({ from: fromEmail, to: data.email, subject, html });
      if (error) { logger.error({ error }, "Resend OTP send error"); return false; }
      logger.info({ email: data.email, purpose: data.purpose }, "OTP email sent");
      return true;
    } catch (err) {
      logger.error({ err }, "Resend OTP send failed");
      return false;
    }
  }

  logger.info({ email: data.email, otp: data.otp }, "No email provider — OTP generated only");
  return false;
}

export async function sendPasswordResetEmail(data: PasswordResetEmailData): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM ?? "Aventum Capital <onboarding@resend.dev>";
  const resetUrl = `${data.appBaseUrl}/reset-password?token=${data.token}`;
  const html = buildEmailWrapper({
    headerTitle: "We received a request to reset your password.",
    headerSubtitle: `Hi ${data.name}, use the link below to set a new password for your Aventum Capital account.`,
    bodyHtml: `
      <a href="${resetUrl}" style="display:inline-block;background:#3A5A40;color:#ffffff;text-decoration:none;text-align:center;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:700;margin-bottom:24px;">Set new password</a>
      <div style="height:1px;background:#e7e4dc;margin:4px 0 20px;"></div>
      <p style="font-size:13px;line-height:1.7;color:#969da6;margin:0 0 12px;">This link expires in 1 hour. If you did not request a password reset, you can ignore this email and your password will stay the same.</p>
      <p style="font-size:12px;line-height:1.7;color:#969da6;margin:0;">Copy link: <a href="${resetUrl}" style="color:#588157;text-decoration:underline;word-break:break-all;">${resetUrl}</a></p>`,
  });

  if (resendApiKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(resendApiKey);
      const { error } = await resend.emails.send({ from: fromEmail, to: data.email, subject: "Reset your Aventum password", html });
      if (error) { logger.error({ error }, "Resend password reset error"); return false; }
      logger.info({ email: data.email }, "Password reset email sent via Resend");
      return true;
    } catch (err) {
      logger.error({ err }, "Resend password reset failed");
      return false;
    }
  }

  logger.info({ email: data.email, resetUrl }, "No email provider — password reset link generated only");
  return false;
}

interface GroupAddedEmailData {
  email: string;
  name: string;
  groupName: string;
  inviterName: string;
  contributionAmount: string;
  schedule: string;
  appBaseUrl: string;
}

export async function sendGroupAddedEmail(data: GroupAddedEmailData): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM ?? "Aventum Capital <onboarding@resend.dev>";
  const dashboardUrl = `${data.appBaseUrl}/groups`;

  const html = buildEmailWrapper({
    headerTitle: "You have joined a savings group.",
    headerSubtitle: `Hi ${data.name}, ${data.inviterName} added you to a rotating savings group on Aventum Capital.`,
    bodyHtml: `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fbfaf7;border:1px solid #ebe8df;border-radius:16px;overflow:hidden;margin-bottom:24px;">
        <tr><td style="padding:20px 22px 12px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:#9aa38d;margin-bottom:6px;">Your group</div>
          <div style="font-size:18px;font-weight:700;color:#303842;line-height:1.3;">${data.groupName}</div>
        </td></tr>
        <tr><td style="padding:14px 22px 22px;border-top:1px solid #ebe8df;">
          <div style="font-size:12px;line-height:1.45;color:#8c929a;margin-bottom:4px;">Contribution</div>
          <div style="font-size:20px;font-weight:700;color:#344E41;">${data.contributionAmount} · ${scheduleLabel(data.schedule)}</div>
        </td></tr>
      </table>
      <a href="${dashboardUrl}" style="display:inline-block;background:#3A5A40;color:#ffffff;text-decoration:none;text-align:center;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:700;">View my group</a>`,
  });

  if (resendApiKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(resendApiKey);
      const { error } = await resend.emails.send({
        from: fromEmail,
        to: data.email,
        subject: `You've been added to ${data.groupName} on Aventum Capital`,
        html,
      });
      if (error) { logger.error({ error }, "Resend group-added email error"); return false; }
      logger.info({ email: data.email, groupName: data.groupName }, "Group-added notification sent");
      return true;
    } catch (err) {
      logger.error({ err }, "Resend group-added send failed");
      return false;
    }
  }

  logger.info({ email: data.email }, "No email provider — group-added notification skipped");
  return false;
}

export async function sendInviteEmail(data: InviteEmailData): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM ?? "Aventum Capital <onboarding@resend.dev>";
  const subject = `${data.inviterName} invited you to join ${data.groupName}`;
  const html = buildInviteEmailHtml(data);
  const inviteUrl = `${data.appBaseUrl}/invite/${data.inviteToken}`;

  // Try Resend first (preferred — simple API, no SMTP config needed)
  if (resendApiKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(resendApiKey);

      const { data: resendData, error } = await resend.emails.send({
        from: fromEmail,
        to: data.inviteeEmail,
        subject,
        html,
      });

      if (error) {
        logger.error({ error }, "Resend delivery error");
        return false;
      }

      logger.info({ email: data.inviteeEmail, inviteUrl, resendEmailId: resendData?.id }, "Invite email sent via Resend");
      return true;
    } catch (err) {
      logger.error({ err }, "Resend send failed");
      return false;
    }
  }

  // Fall back to SMTP / nodemailer if configured
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT ?? "587", 10);

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: fromEmail,
        to: data.inviteeEmail,
        subject,
        html,
      });

      logger.info({ email: data.inviteeEmail }, "Invite email sent via SMTP");
      return true;
    } catch (err) {
      logger.error({ err }, "SMTP send failed");
      return false;
    }
  }

  // No email provider configured
  logger.info({ email: data.inviteeEmail, inviteUrl }, "No email provider configured — invite link generated only");
  return false;
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

export async function sendMemberJoinedNotificationEmail(opts: {
  email: string;
  recipientName: string;
  newMemberName: string;
  groupName: string;
  totalMembers: number;
  maxMembers: number;
  appBaseUrl: string;
}): Promise<boolean> {
  const dashboardUrl = `${opts.appBaseUrl}/groups`;
  const html = buildEmailWrapper({
    headerTitle: "New member joined your group",
    headerSubtitle: `Activity update for ${opts.groupName}`,
    bodyHtml: `
      <p style="font-size:15px;color:#374151;margin:0 0 20px;">Hi <strong>${opts.recipientName}</strong>,</p>
      <p style="font-size:15px;color:#374151;margin:0 0 24px;">
        <strong>${opts.newMemberName}</strong> has just joined <strong>${opts.groupName}</strong>.
        The group now has <strong>${opts.totalMembers}/${opts.maxMembers}</strong> members.
      </p>
      <div style="background:#f8faf8;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
        <div style="font-size:12px;font-weight:600;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Group</div>
        <div style="font-size:16px;font-weight:700;color:#344E41;">${opts.groupName}</div>
        <div style="font-size:13px;color:#6b7280;margin-top:4px;">${opts.totalMembers} of ${opts.maxMembers} spots filled</div>
      </div>
      <a href="${dashboardUrl}" style="display:inline-block;background:#3A5A40;color:#ffffff;text-decoration:none;text-align:center;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:700;">View group</a>`,
  });
  return sendViaResend(opts.email, `${opts.newMemberName} joined ${opts.groupName}`, html);
}

export async function sendAdminAddedMemberEmail(opts: {
  email: string;
  adminName: string;
  newMemberName: string;
  newMemberEmail: string;
  groupName: string;
  totalMembers: number;
  maxMembers: number;
  appBaseUrl: string;
}): Promise<boolean> {
  const dashboardUrl = `${opts.appBaseUrl}/groups`;
  const html = buildEmailWrapper({
    headerTitle: "Member added successfully",
    headerSubtitle: `Confirmation for ${opts.groupName}`,
    bodyHtml: `
      <p style="font-size:15px;color:#374151;margin:0 0 20px;">Hi <strong>${opts.adminName}</strong>,</p>
      <p style="font-size:15px;color:#374151;margin:0 0 24px;">
        You've successfully added <strong>${opts.newMemberName}</strong> to <strong>${opts.groupName}</strong>.
        They've been notified and can now participate in the group.
      </p>
      <div style="background:#f8faf8;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
        <div style="font-size:12px;font-weight:600;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">New member</div>
        <div style="font-size:16px;font-weight:700;color:#1f2937;">${opts.newMemberName}</div>
        <div style="font-size:13px;color:#6b7280;margin-top:2px;">${opts.newMemberEmail}</div>
        <div style="font-size:13px;color:#6b7280;margin-top:8px;">Group now has <strong>${opts.totalMembers}/${opts.maxMembers}</strong> members</div>
      </div>
      <a href="${dashboardUrl}" style="display:inline-block;background:#3A5A40;color:#ffffff;text-decoration:none;text-align:center;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:700;">View group</a>`,
  });
  return sendViaResend(opts.email, `You added ${opts.newMemberName} to ${opts.groupName}`, html);
}

export async function sendContributionReceiptEmail(opts: {
  email: string;
  name: string;
  groupName: string;
  amount: string;
  cycleNumber: number;
  paidAt: Date;
  appBaseUrl: string;
}): Promise<boolean> {
  const dashboardUrl = `${opts.appBaseUrl}/groups`;
  const html = buildEmailWrapper({
    headerTitle: "Contribution confirmed",
    headerSubtitle: `Your payment for ${opts.groupName} has been recorded`,
    bodyHtml: `
      <p style="font-size:15px;color:#374151;margin:0 0 20px;">Hi <strong>${opts.name}</strong>,</p>
      <p style="font-size:15px;color:#374151;margin:0 0 24px;">
        Your contribution to <strong>${opts.groupName}</strong> has been recorded successfully.
      </p>
      <div style="background:#f8faf8;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%" style="padding:16px 20px;border-right:1px solid #e5e7eb;">
              <div style="font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Amount paid</div>
              <div style="font-size:20px;font-weight:700;color:#344E41;">${opts.amount}</div>
            </td>
            <td width="50%" style="padding:16px 20px;">
              <div style="font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Cycle</div>
              <div style="font-size:20px;font-weight:700;color:#344E41;">#${opts.cycleNumber}</div>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:0 20px 16px;border-top:1px solid #e5e7eb;padding-top:12px;">
              <div style="font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Paid at</div>
              <div style="font-size:14px;color:#374151;">${fmtDateTime(opts.paidAt)}</div>
            </td>
          </tr>
        </table>
      </div>
      <a href="${dashboardUrl}" style="display:inline-block;background:#3A5A40;color:#ffffff;text-decoration:none;text-align:center;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:700;">View my groups</a>`,
  });
  return sendViaResend(opts.email, `Contribution confirmed — ${opts.groupName}`, html);
}

export async function sendContributionActivityEmail(opts: {
  email: string;
  recipientName: string;
  contributorName: string;
  groupName: string;
  amount: string;
  cycleNumber: number;
  paidAt: Date;
  paidCount: number;
  totalMembers: number;
  appBaseUrl: string;
}): Promise<boolean> {
  const dashboardUrl = `${opts.appBaseUrl}/groups`;
  const allPaid = opts.paidCount >= opts.totalMembers;
  const html = buildEmailWrapper({
    headerTitle: "Contribution made",
    headerSubtitle: `Activity update for ${opts.groupName}`,
    bodyHtml: `
      <p style="font-size:15px;color:#374151;margin:0 0 20px;">Hi <strong>${opts.recipientName}</strong>,</p>
      <p style="font-size:15px;color:#374151;margin:0 0 24px;">
        <strong>${opts.contributorName}</strong> has made their contribution to <strong>${opts.groupName}</strong>.
      </p>
      <div style="background:#f8faf8;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%" style="padding:16px 20px;border-right:1px solid #e5e7eb;">
              <div style="font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Amount</div>
              <div style="font-size:20px;font-weight:700;color:#344E41;">${opts.amount}</div>
            </td>
            <td width="50%" style="padding:16px 20px;">
              <div style="font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Cycle</div>
              <div style="font-size:20px;font-weight:700;color:#344E41;">#${opts.cycleNumber}</div>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:0 20px 16px;border-top:1px solid #e5e7eb;padding-top:12px;">
              <div style="font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Paid at</div>
              <div style="font-size:14px;color:#374151;">${fmtDateTime(opts.paidAt)}</div>
            </td>
          </tr>
        </table>
      </div>
      <div style="background:${allPaid ? "#f0faf4" : "#fffbf0"};border:1px solid ${allPaid ? "#86efac" : "#fde68a"};border-radius:10px;padding:14px 18px;margin-bottom:24px;font-size:14px;color:#374151;">
        ${allPaid
          ? `All <strong>${opts.totalMembers}</strong> members have paid this cycle. The pool is being disbursed.`
          : `<strong>${opts.paidCount} of ${opts.totalMembers}</strong> members have contributed so far this cycle.`}
      </div>
      <a href="${dashboardUrl}" style="display:inline-block;background:#3A5A40;color:#ffffff;text-decoration:none;text-align:center;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:700;">View group</a>`,
  });
  return sendViaResend(opts.email, `${opts.contributorName} made a contribution to ${opts.groupName}`, html);
}

export async function sendExitRequestNotificationToAdmin(opts: {
  email: string;
  adminName: string;
  groupName: string;
  requesterName: string;
  requesterEmail: string;
  reason: string | null;
  submittedAt: Date;
  appBaseUrl: string;
}): Promise<boolean> {
  const adminUrl = `${opts.appBaseUrl}/admin/group`;
  const html = buildEmailWrapper({
    headerTitle: "Member exit request",
    headerSubtitle: `Action visibility for ${opts.groupName}`,
    bodyHtml: `
      <p style="font-size:15px;color:#374151;margin:0 0 20px;">Hi <strong>${opts.adminName}</strong>,</p>
      <p style="font-size:15px;color:#374151;margin:0 0 24px;">
        <strong>${opts.requesterName}</strong> submitted a request to leave <strong>${opts.groupName}</strong>.
        Aventum Capital will handle the approval review, but this request is visible to you as the group admin.
      </p>
      <div style="background:#fbfaf7;border:1px solid #ebe8df;border-radius:16px;padding:18px 22px;margin-bottom:24px;">
        <div style="font-size:10px;font-weight:700;color:#9aa38d;letter-spacing:1.8px;text-transform:uppercase;margin-bottom:10px;">Request details</div>
        <div style="font-size:14px;color:#374151;margin-bottom:6px;"><strong>Member:</strong> ${opts.requesterName}</div>
        <div style="font-size:14px;color:#374151;margin-bottom:6px;"><strong>Email:</strong> ${opts.requesterEmail}</div>
        <div style="font-size:14px;color:#374151;margin-bottom:6px;"><strong>Submitted:</strong> ${fmtDateTime(opts.submittedAt)}</div>
        <div style="font-size:14px;color:#374151;"><strong>Reason:</strong> ${opts.reason?.trim() || "No reason provided"}</div>
      </div>
      <a href="${adminUrl}" style="display:inline-block;background:#3A5A40;color:#ffffff;text-decoration:none;text-align:center;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:700;">View admin requests</a>`,
  });
  return sendViaResend(opts.email, `Exit request — ${opts.groupName}`, html);
}

export async function sendSwapRequestNotificationToAdmin(opts: {
  email: string;
  adminName: string;
  groupName: string;
  requesterName: string;
  targetMemberName: string;
  reason: string | null;
  submittedAt: Date;
  appBaseUrl: string;
}): Promise<boolean> {
  const adminUrl = `${opts.appBaseUrl}/admin/group`;
  const html = buildEmailWrapper({
    headerTitle: "Turn swap request",
    headerSubtitle: `Approval needed for ${opts.groupName}`,
    bodyHtml: `
      <p style="font-size:15px;color:#374151;margin:0 0 20px;">Hi <strong>${opts.adminName}</strong>,</p>
      <p style="font-size:15px;color:#374151;margin:0 0 24px;">
        <strong>${opts.requesterName}</strong> requested to swap rotation positions with <strong>${opts.targetMemberName}</strong> in <strong>${opts.groupName}</strong>.
      </p>
      <div style="background:#fbfaf7;border:1px solid #ebe8df;border-radius:16px;padding:18px 22px;margin-bottom:24px;">
        <div style="font-size:10px;font-weight:700;color:#9aa38d;letter-spacing:1.8px;text-transform:uppercase;margin-bottom:10px;">Request details</div>
        <div style="font-size:14px;color:#374151;margin-bottom:6px;"><strong>Requested by:</strong> ${opts.requesterName}</div>
        <div style="font-size:14px;color:#374151;margin-bottom:6px;"><strong>Swap with:</strong> ${opts.targetMemberName}</div>
        <div style="font-size:14px;color:#374151;margin-bottom:6px;"><strong>Submitted:</strong> ${fmtDateTime(opts.submittedAt)}</div>
        <div style="font-size:14px;color:#374151;"><strong>Reason:</strong> ${opts.reason?.trim() || "No reason provided"}</div>
      </div>
      <a href="${adminUrl}" style="display:inline-block;background:#3A5A40;color:#ffffff;text-decoration:none;text-align:center;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:700;">Review request</a>`,
  });
  return sendViaResend(opts.email, `Turn swap request — ${opts.groupName}`, html);
}
