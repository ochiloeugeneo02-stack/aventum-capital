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
  const greeting = data.inviteeName ? `Hi ${data.inviteeName},` : "Hi there,";
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>You've been invited to ${data.groupName}</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f5f4f0;padding:40px 16px 64px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;margin:0 auto;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <div style="font-size:22px;font-weight:700;color:#344E41;letter-spacing:-0.5px;">Aventum<span style="color:#588157;">.</span></div>
              <div style="font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-top:2px;">Capital</div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.08);">

              <!-- Header -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:linear-gradient(135deg,#344E41 0%,#3A5A40 100%);padding:40px 40px 36px;text-align:center;">
                    <div style="display:inline-block;background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.9);font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;padding:6px 16px;border-radius:100px;margin-bottom:18px;">
                      Group Invitation
                    </div>
                    <div style="font-size:26px;font-weight:700;color:#ffffff;line-height:1.3;margin-bottom:8px;">
                      You've been invited to join a savings circle
                    </div>
                    <div style="font-size:15px;color:rgba(255,255,255,0.65);">
                      ${data.inviterName} wants you in their group
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Body -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:36px 40px 0;">
                    <p style="font-size:16px;color:#374151;line-height:1.6;margin:0 0 8px;">${greeting}</p>
                    <p style="font-size:16px;color:#374151;line-height:1.6;margin:0 0 28px;"><strong>${data.inviterName}</strong> has invited you to join their rotating savings group on Aventum.</p>
                  </td>
                </tr>

                <!-- Group box -->
                <tr>
                  <td style="padding:0 40px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f9f8f6;border:1px solid #e8e4df;border-radius:14px;overflow:hidden;">
                      <tr>
                        <td style="padding:22px 24px 8px;">
                          <div style="font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Your Group</div>
                          <div style="font-size:20px;font-weight:700;color:#1f2937;">${data.groupName}</div>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td width="50%" style="padding:12px 24px 22px;border-right:1px solid #e8e4df;">
                                <div style="font-size:20px;font-weight:700;color:#344E41;">${contribution}</div>
                                <div style="font-size:12px;color:#9ca3af;margin-top:3px;">Contribution · ${scheduleLabel(data.schedule)}</div>
                              </td>
                              <td width="50%" style="padding:12px 24px 22px;">
                                <div style="font-size:20px;font-weight:700;color:#344E41;">${pool}</div>
                                <div style="font-size:12px;color:#9ca3af;margin-top:3px;">Pool at full capacity</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- CTA -->
                <tr>
                  <td style="padding:28px 40px 16px;">
                    <a href="${inviteUrl}" style="display:block;background:linear-gradient(135deg,#3A5A40 0%,#344E41 100%);color:#ffffff;text-decoration:none;text-align:center;padding:16px 32px;border-radius:12px;font-size:16px;font-weight:600;letter-spacing:0.2px;">
                      Accept invitation →
                    </a>
                  </td>
                </tr>

                <!-- Link fallback -->
                <tr>
                  <td style="padding:0 40px 8px;text-align:center;">
                    <p style="font-size:13px;color:#9ca3af;margin:0;">
                      Or copy this link: <a href="${inviteUrl}" style="color:#588157;text-decoration:none;word-break:break-all;">${inviteUrl}</a>
                    </p>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding:20px 40px;">
                    <div style="height:1px;background:#f0ede8;"></div>
                  </td>
                </tr>

                <!-- How it works -->
                <tr>
                  <td style="padding:0 40px 16px;">
                    <p style="font-size:13px;color:#6b7280;line-height:1.7;margin:0 0 12px;">
                      Aventum is a platform for rotating savings circles. Everyone contributes ${contribution} ${scheduleLabel(data.schedule)}, and the full pool is paid out to one member at a time — rotating until everyone has received their share.
                    </p>
                    <p style="font-size:12px;color:#9ca3af;margin:0;">This invitation expires in 7 days.</p>
                  </td>
                </tr>

                <tr><td style="height:36px;"></td></tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="font-size:12px;color:#9ca3af;line-height:1.7;margin:0;">
                © ${year} Aventum Capital. All rights reserved.<br />
                If you weren't expecting this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

      const { error } = await resend.emails.send({
        from: fromEmail,
        to: data.inviteeEmail,
        subject,
        html,
      });

      if (error) {
        logger.error({ error }, "Resend delivery error");
        return false;
      }

      logger.info({ email: data.inviteeEmail }, "Invite email sent via Resend");
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
