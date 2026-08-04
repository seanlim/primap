import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM_EMAIL = () => process.env.RESEND_FROM_EMAIL || 'Primap <no-reply@primap.org>';

// Escape user-controlled strings before interpolating into HTML email bodies.
// All values that originate from user input (names, descriptions, free-text
// fields) MUST go through this helper to prevent XSS in admin/volunteer inboxes.
function escapeHtml(value: string | null | undefined): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

export interface WalkEmailParticipant {
  fullName: string | null
  email: string
}

export interface WalkEmailSlotInfo {
  date: string
  time: string
  location: string
}

function buildParticipantRosterHtml(participants: WalkEmailParticipant[]) {
  if (participants.length === 0) return '<p>No active participants are currently listed for this walk.</p>'

  const items = participants.map((participant) => {
    const label = escapeHtml(participant.fullName || participant.email || 'Volunteer')
    const email = escapeHtml(participant.email)
    return `<li><strong>${label}</strong> (${email})</li>`
  }).join('')

  return `
    <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 15px 0;">
      <p><strong>Current participant roster</strong></p>
      <ul style="padding-left: 20px; margin: 8px 0 0;">
        ${items}
      </ul>
    </div>
  `
}

export async function sendAccountApprovedEmail(email: string, fullName: string | null) {
  const name = escapeHtml(fullName || 'Volunteer');
  await sendEmail(email, 'Primap Account Approved', wrapHtml(`
    <p>Hi ${name},</p>
    <p>Your volunteer account for Primap has been approved!</p>
    <p>You can now log in and sign up for survey walks.</p>
    <a href="${APP_URL()}/login" class="button">Log In</a>
  `));
}

export async function sendAccountRejectedEmail(email: string, fullName: string | null) {
  const name = escapeHtml(fullName || 'Volunteer');
  await sendEmail(email, 'Primap Account Update', wrapHtml(`
    <p>Hi ${name},</p>
    <p>We regret to inform you that your volunteer account application for Primap was not approved at this time.</p>
    <p>If you believe this was a mistake, please reach out to the team for further assistance.</p>
  `));
}

export async function sendAccountDisabledEmail(email: string, fullName: string | null) {
  const name = escapeHtml(fullName || 'Volunteer');
  await sendEmail(email, 'Primap Account Disabled', wrapHtml(`
    <p>Hi ${name},</p>
    <p>Your Primap account has been disabled by an administrator.</p>
    <p>If you believe this was a mistake, please contact the admin team for assistance.</p>
  `));
}

export async function sendAccountEnabledEmail(email: string, fullName: string | null) {
  const name = escapeHtml(fullName || 'Volunteer');
  await sendEmail(email, 'Primap Account Re-enabled', wrapHtml(`
    <p>Hi ${name},</p>
    <p>Your Primap account has been re-enabled. You can now log in and access the platform again.</p>
    <a href="${APP_URL()}/login" class="button">Log In</a>
  `));
}

export async function sendRolePromotedEmail(email: string, fullName: string | null) {
  const name = escapeHtml(fullName || 'User');
  await sendEmail(email, 'Primap: You Have Been Promoted to Admin', wrapHtml(`
    <p>Hi ${name},</p>
    <p>You have been promoted to an <strong>administrator</strong> on Primap.</p>
    <p>You now have access to admin features including user management, survey round management, and data exports.</p>
    <a href="${APP_URL()}/admin" class="button">Go to Admin Dashboard</a>
  `));
}

export async function sendRoleDemotedEmail(email: string, fullName: string | null) {
  const name = escapeHtml(fullName || 'User');
  await sendEmail(email, 'Primap: Your Role Has Been Updated', wrapHtml(`
    <p>Hi ${name},</p>
    <p>Your role on Primap has been changed from administrator to <strong>volunteer</strong>.</p>
    <p>You can continue to participate in survey walks and submit observations as a volunteer.</p>
    <a href="${APP_URL()}/home" class="button">Go to Home</a>
  `));
}

export async function sendWalkCancellationEmail(
  recipients: string[],
  slotInfo: WalkEmailSlotInfo,
  cancelledBy: string
) {
  if (recipients.length === 0) return;

  const html = wrapHtml(`
    <p>A volunteer has cancelled their participation in an upcoming walk you are also joined in.</p>
    <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 15px 0;">
      <p><strong>Date:</strong> ${escapeHtml(slotInfo.date)}</p>
      <p><strong>Time:</strong> ${escapeHtml(slotInfo.time)}</p>
      <p><strong>Location:</strong> ${escapeHtml(slotInfo.location)}</p>
    </div>
    <p><strong>Cancelled by:</strong> ${escapeHtml(cancelledBy)}</p>
    <p>You are still signed up for this walk. If you also need to cancel, please do so as soon as possible.</p>
  `);

  // Send individually to preserve recipient privacy
  await Promise.all(recipients.map(email =>
    sendEmail(email, 'Walk Cancellation Update', html)
  ));
}

export async function sendIncidentReportedEmail(
  adminEmails: string[],
  details: {
    typeLabel: string
    description: string
    reporterName: string
    walkLocation: string
    walkDate: string
  }
) {
  if (adminEmails.length === 0) return

  // Note: this template intentionally does NOT report attachment counts.
  // Notifications fire at incident creation time (before media upload), so
  // any count reported here would always be zero. Admins can click the CTA
  // to view the live incident with whatever media has been attached so far.
  const html = wrapHtml(`
    <p>Hi Admin,</p>
    <p>A new incident has been reported by a volunteer and may require follow-up.</p>
    <div style="background-color: #fef2f2; padding: 15px; border-radius: 5px; margin: 15px 0; border: 1px solid #fecaca;">
      <p><strong>Type:</strong> ${escapeHtml(details.typeLabel)}</p>
      <p><strong>Location:</strong> ${escapeHtml(details.walkLocation)}</p>
      <p><strong>Walk date:</strong> ${escapeHtml(details.walkDate)}</p>
      <p><strong>Reported by:</strong> ${escapeHtml(details.reporterName)}</p>
    </div>
    <p><strong>Description:</strong></p>
    <p>${escapeHtml(details.description)}</p>
    <a href="${APP_URL()}/admin/incidents" class="button">Review Incident</a>
  `)

  // Send individually to preserve recipient privacy. Use allSettled so a single
  // failed send does not reject the entire batch.
  await Promise.allSettled(adminEmails.map(email =>
    sendEmail(email, 'New Incident Reported - Primap', html)
  ))
}

export async function sendWalkReminderEmail(
  email: string,
  name: string | null,
  slotInfo: WalkEmailSlotInfo,
  participants: WalkEmailParticipant[]
) {
  const displayName = escapeHtml(name || 'Volunteer');
  await sendEmail(email, 'Reminder: Upcoming Survey Walk', wrapHtml(`
    <p>Hi ${displayName},</p>
    <p>This is a reminder for your upcoming survey walk.</p>
    <div style="background-color: #f0fdf4; padding: 15px; border-radius: 5px; margin: 15px 0; border: 1px solid #bbf7d0;">
      <p><strong>Date:</strong> ${escapeHtml(slotInfo.date)}</p>
      <p><strong>Time:</strong> ${escapeHtml(slotInfo.time)}</p>
      <p><strong>Location:</strong> ${escapeHtml(slotInfo.location)}</p>
    </div>
    ${buildParticipantRosterHtml(participants)}
    <p>Please remember to bring your equipment and arrive on time.</p>
    <p>If you cannot make it, please cancel your walk as soon as possible to allow others to join.</p>
    <a href="${APP_URL()}/walk" class="button">View My Walks</a>
  `));
}

export async function sendWalkParticipantUpdateEmail(
  recipients: string[],
  slotInfo: WalkEmailSlotInfo,
  participants: WalkEmailParticipant[],
  updateType: 'join' | 'late-cancellation',
  actorName?: string
) {
  if (recipients.length === 0) return

  const actionCopy = updateType === 'join'
    ? `${escapeHtml(actorName || 'A volunteer')} joined this walk after participant reminders had already been sent.`
    : `${escapeHtml(actorName || 'A volunteer')} cancelled late for this walk.`

  const followupCopy = updateType === 'join'
    ? 'The latest participant roster is included below so everyone has the current contact list.'
    : 'The participant list has been updated below so the remaining volunteers have the current contact list.'

  const html = wrapHtml(`
    <p>${actionCopy}</p>
    <div style="background-color: #f0fdf4; padding: 15px; border-radius: 5px; margin: 15px 0; border: 1px solid #bbf7d0;">
      <p><strong>Date:</strong> ${escapeHtml(slotInfo.date)}</p>
      <p><strong>Time:</strong> ${escapeHtml(slotInfo.time)}</p>
      <p><strong>Location:</strong> ${escapeHtml(slotInfo.location)}</p>
    </div>
    <p>${followupCopy}</p>
    ${buildParticipantRosterHtml(participants)}
    <a href="${APP_URL()}/walk" class="button">View My Walks</a>
  `)

  await Promise.all(recipients.map((email) =>
    sendEmail(email, 'Notice: Walk Participant Update', html)
  ))
}
