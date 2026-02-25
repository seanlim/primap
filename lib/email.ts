import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Primap <no-reply@primap.org>';

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

export async function sendAccountApprovedEmail(email: string, fullName: string | null) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set. Skipping email.');
    return;
  }

  const name = fullName || 'Volunteer';
  const html = wrapHtml(`
    <p>Hi ${name},</p>
    <p>Your volunteer account for Primap has been approved!</p>
    <p>You can now log in and sign up for survey walks.</p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://primap.org'}/login" class="button">Log In</a>
  `);

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Primap Account Approved',
      html,
    });
  } catch (error) {
    console.error('Failed to send account approval email:', error);
  }
}

export async function sendSlotCancellationEmail(
  recipients: string[],
  slotInfo: { date: string; time: string; location: string },
  cancelledBy: string
) {
  if (!process.env.RESEND_API_KEY || recipients.length === 0) {
    return;
  }

  const html = wrapHtml(`
    <p>A volunteer has cancelled their participation in an upcoming walk slot you are also joined in.</p>
    <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 15px 0;">
      <p><strong>Date:</strong> ${slotInfo.date}</p>
      <p><strong>Time:</strong> ${slotInfo.time}</p>
      <p><strong>Location:</strong> ${slotInfo.location}</p>
    </div>
    <p><strong>Cancelled by:</strong> ${cancelledBy}</p>
    <p>You are still signed up for this slot. If you also need to cancel, please do so as soon as possible.</p>
  `);

  try {
    // Send individual emails or use bcc to protect privacy if bulk (Resend handles array in 'to' as multiple recipients usually, but better to loop or bcc)
    // Resend 'to' with array sends to all visible to each other usually? No, Resend sends individual emails if you use batch or separate calls.
    // Documentation says array in 'to' sends to all of them (like CC). We should send separately or BCC.
    // For simplicity and privacy, let's send to each.
    await Promise.all(recipients.map(email => 
      resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: 'Walk Slot Cancellation Update',
        html,
      })
    ));
  } catch (error) {
    console.error('Failed to send cancellation emails:', error);
  }
}

export async function sendWalkReminderEmail(
  email: string,
  name: string | null,
  slotInfo: { date: string; time: string; location: string }
) {
  if (!process.env.RESEND_API_KEY) return;

  const displayName = name || 'Volunteer';
  const html = wrapHtml(`
    <p>Hi ${displayName},</p>
    <p>This is a reminder for your upcoming survey walk tomorrow.</p>
    <div style="background-color: #f0fdf4; padding: 15px; border-radius: 5px; margin: 15px 0; border: 1px solid #bbf7d0;">
      <p><strong>Date:</strong> ${slotInfo.date}</p>
      <p><strong>Time:</strong> ${slotInfo.time}</p>
      <p><strong>Location:</strong> ${slotInfo.location}</p>
    </div>
    <p>Please remember to bring your equipment and arrive on time.</p>
    <p>If you cannot make it, please cancel your slot as soon as possible to allow others to join.</p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://primap.org'}/walk" class="button">View My Walks</a>
  `);

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Reminder: Upcoming Survey Walk',
      html,
    });
  } catch (error) {
    console.error('Failed to send reminder email:', error);
  }
}
