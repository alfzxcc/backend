import { Resend } from 'resend';
import config from '../config.json';

// Use env var on Render, fall back to config.json locally
const resendApiKey = process.env.RESEND_API_KEY || (config as any).resendApiKey;
const resend = new Resend(resendApiKey);

export async function sendEmail({ to, subject, html, from }: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}) {
  const sender = from || process.env.EMAIL_FROM || config.emailFrom;
  await resend.emails.send({
    from: sender,
    to,
    subject,
    html
  });
}
