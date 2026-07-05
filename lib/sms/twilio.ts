interface SendSmsInput {
  to: string
  body: string
}

interface SendSmsResult {
  success?: true
  error?: string
}

export async function sendSms({ to, body }: SendSmsInput): Promise<SendSmsResult> {
  if (process.env.GUARDIAN_OTP_TEST_CODE && process.env.NODE_ENV !== 'production') {
    return { success: true }
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
  const from = process.env.TWILIO_FROM_PHONE

  if (!accountSid || !authToken || (!messagingServiceSid && !from)) {
    return { error: 'SMS delivery is not configured.' }
  }

  const payload = new URLSearchParams({
    To: to,
    Body: body,
  })
  if (messagingServiceSid) payload.set('MessagingServiceSid', messagingServiceSid)
  if (from) payload.set('From', from)

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    return { error: detail || 'Failed to send SMS.' }
  }

  return { success: true }
}
