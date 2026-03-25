import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM_EMAIL = () => process.env.RESEND_FROM_EMAIL || 'Primap <no-reply@primap.org>';

// Helper to wrap content in a basic HTML template
function wrapHtml(content: string) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: sans-serif; line-height: 1.5; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { font-size: 24px; font-weight: bold; margin-bottom: 20px; color: #166534; }
          .footer { margin-top: 30px; font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 10px; }
          .button { display: inline-block; padding: 10px 20px; background-color: #166534; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">Primap Notification</div>
          ${content}
          <div class="footer">
            <p>This is an automated message from the Primap system.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set. Skipping email.');
    return;
  }

  try {
    await getResend().emails.send({ from: FROM_EMAIL(), to, subject, html });
  } catch (error) {
    console.error(`Failed to send email "${subject}" to ${to}:`, error);
  }
}

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || 'https://primap.org';

export async function sendAccountApprovedEmail(email: string, fullName: string | null) {
  const name = fullName || 'Volunteer';
  await sendEmail(email, 'Primap Account Approved', wrapHtml(`
    <p>Hi ${name},</p>
    <p>Your volunteer account for Primap has been approved!</p>
    <p>You can now log in and sign up for survey walks.</p>
    <a href="${APP_URL()}/login" class="button">Log In</a>
  `));
}

export async function sendAccountRejectedEmail(email: string, fullName: string | null) {
  const name = fullName || 'Volunteer';
  await sendEmail(email, 'Primap Account Update', wrapHtml(`
    <p>Hi ${name},</p>
    <p>We regret to inform you that your volunteer account application for Primap was not approved at this time.</p>
    <p>If you believe this was a mistake, please reach out to the team for further assistance.</p>
  `));
}

export async function sendAccountDisabledEmail(email: string, fullName: string | null) {
  const name = fullName || 'Volunteer';
  await sendEmail(email, 'Primap Account Disabled', wrapHtml(`
    <p>Hi ${name},</p>
    <p>Your Primap account has been disabled by an administrator.</p>
    <p>If you believe this was a mistake, please contact the admin team for assistance.</p>
  `));
}

export async function sendAccountEnabledEmail(email: string, fullName: string | null) {
  const name = fullName || 'Volunteer';
  await sendEmail(email, 'Primap Account Re-enabled', wrapHtml(`
    <p>Hi ${name},</p>
    <p>Your Primap account has been re-enabled. You can now log in and access the platform again.</p>
    <a href="${APP_URL()}/login" class="button">Log In</a>
  `));
}

export async function sendRolePromotedEmail(email: string, fullName: string | null) {
  const name = fullName || 'User';
  await sendEmail(email, 'Primap: You Have Been Promoted to Admin', wrapHtml(`
    <p>Hi ${name},</p>
    <p>You have been promoted to an <strong>administrator</strong> on Primap.</p>
    <p>You now have access to admin features including user management, survey round management, and data exports.</p>
    <a href="${APP_URL()}/admin" class="button">Go to Admin Dashboard</a>
  `));
}

export async function sendRoleDemotedEmail(email: string, fullName: string | null) {
  const name = fullName || 'User';
  await sendEmail(email, 'Primap: Your Role Has Been Updated', wrapHtml(`
    <p>Hi ${name},</p>
    <p>Your role on Primap has been changed from administrator to <strong>volunteer</strong>.</p>
    <p>You can continue to participate in survey walks and submit observations as a volunteer.</p>
    <a href="${APP_URL()}/home" class="button">Go to Home</a>
  `));
}

export async function sendWalkCancellationEmail(
  recipients: string[],
  slotInfo: { date: string; time: string; location: string },
  cancelledBy: string
) {
  if (recipients.length === 0) return;

  const html = wrapHtml(`
    <p>A volunteer has cancelled their participation in an upcoming walk you are also joined in.</p>
    <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 15px 0;">
      <p><strong>Date:</strong> ${slotInfo.date}</p>
      <p><strong>Time:</strong> ${slotInfo.time}</p>
      <p><strong>Location:</strong> ${slotInfo.location}</p>
    </div>
    <p><strong>Cancelled by:</strong> ${cancelledBy}</p>
    <p>You are still signed up for this walk. If you also need to cancel, please do so as soon as possible.</p>
  `);

  // Send individually to preserve recipient privacy
  await Promise.all(recipients.map(email =>
    sendEmail(email, 'Walk Cancellation Update', html)
  ));
}

export async function sendWalkReminderEmail(
  email: string,
  name: string | null,
  slotInfo: { date: string; time: string; location: string }
) {
  const displayName = name || 'Volunteer';
  await sendEmail(email, 'Reminder: Upcoming Survey Walk', wrapHtml(`
    <p>Hi ${displayName},</p>
    <p>This is a reminder for your upcoming survey walk tomorrow.</p>
    <div style="background-color: #f0fdf4; padding: 15px; border-radius: 5px; margin: 15px 0; border: 1px solid #bbf7d0;">
      <p><strong>Date:</strong> ${slotInfo.date}</p>
      <p><strong>Time:</strong> ${slotInfo.time}</p>
      <p><strong>Location:</strong> ${slotInfo.location}</p>
    </div>
    <p>Please remember to bring your equipment and arrive on time.</p>
    <p>If you cannot make it, please cancel your walk as soon as possible to allow others to join.</p>
    <a href="${APP_URL()}/walk" class="button">View My Walks</a>
  `));
}
