import { createLogger, AppError } from '@job-agent/shared';
import type { AppConfig } from '@job-agent/config';

const logger = createLogger({ service: 'api' });

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class TransactionalEmailService {
  constructor(private readonly config: AppConfig) {}

  /**
   * Send a transactional email.
   * If RESEND_API_KEY is configured, sends via Resend REST API.
   * If credentials are not configured (local dev/offline), logs the action link to console and returns success.
   */
  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string }> {
    const { to, subject, html, text } = options;

    if (this.config.RESEND_API_KEY) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.config.EMAIL_FROM || this.config.SMTP_FROM,
            to: [to],
            subject,
            html,
            text: text || html.replace(/<[^>]*>?/gm, ''),
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          logger.error('Failed to send transactional email via Resend', {
            status: res.status,
            error: errText,
            to,
          });
          throw AppError.internal(`Failed to deliver email: ${errText.slice(0, 150)}`);
        }

        const data = (await res.json()) as { id?: string };
        logger.info('Transactional email dispatched via Resend', { to, subject, id: data.id });
        return { success: true, messageId: data.id };
      } catch (err: unknown) {
        if (err instanceof AppError) throw err;
        logger.error('Resend delivery error', { error: err });
        throw AppError.internal('Failed to dispatch transactional email');
      }
    }

    // Development / Offline Fallback: High-visibility structured log
    logger.info('Simulated Transactional Email (No external provider configured)', {
      to,
      subject,
      preview: text || html.slice(0, 200),
    });

    console.log('\n======================================================');
    console.log(`[TRANSACTIONAL EMAIL SIMULATION]`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content:\n${text || html}`);
    console.log('======================================================\n');

    return { success: true, messageId: `sim-${Date.now()}` };
  }

  /**
   * Helper to send verification email.
   */
  async sendVerificationEmail(to: string, verificationUrl: string): Promise<void> {
    const subject = 'Verify your email address for Jobee';
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111827; margin-bottom: 16px;">Welcome to Jobee</h2>
        <p style="color: #374151; font-size: 16px; line-height: 24px;">Please verify your email address to access your personal AI job search workspace.</p>
        <div style="margin: 28px 0;">
          <a href="${verificationUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Verify Email Address</a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:<br/><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">If you did not request this invitation, you can safely ignore this email.</p>
      </div>
    `;
    const text = `Welcome to Jobee!\n\nPlease verify your email address to access your workspace:\n${verificationUrl}\n\nIf you did not request this, please ignore this email.`;

    await this.sendEmail({ to, subject, html, text });
  }

  /**
   * Helper to send password reset email.
   */
  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    const subject = 'Reset your Jobee password';
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111827; margin-bottom: 16px;">Jobee Password Reset</h2>
        <p style="color: #374151; font-size: 16px; line-height: 24px;">A password reset was requested for your Jobee account. Click the button below to choose a new password:</p>
        <div style="margin: 28px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:<br/><a href="${resetUrl}">${resetUrl}</a></p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">This link will expire in 1 hour. If you did not request this, please ignore this email.</p>
      </div>
    `;
    const text = `A password reset was requested for your Jobee account.\n\nReset your password here:\n${resetUrl}\n\nThis link will expire in 1 hour.`;

    await this.sendEmail({ to, subject, html, text });
  }

  /**
   * Helper to send pilot invitation email.
   */
  async sendInvitationEmail(
    to: string,
    code: string,
    inviteUrl: string,
    inviterName: string = 'The Jobee Team',
  ): Promise<void> {
    const subject = "You're invited to the Jobee Private Pilot";
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111827; margin-bottom: 16px;">Welcome to Jobee Private Pilot</h2>
        <p style="color: #374151; font-size: 16px; line-height: 24px;">
          ${inviterName} has invited you to join the private pilot of <strong>Jobee</strong> — your personal AI job search partner.
        </p>
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">Your Invitation Code:</div>
          <code style="font-size: 18px; font-weight: 700; color: #1f2937; letter-spacing: 1px;">${code}</code>
        </div>
        <div style="margin: 28px 0;">
          <a href="${inviteUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Get Started on Jobee</a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:<br/><a href="${inviteUrl}">${inviteUrl}</a></p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">This invitation was issued specifically for ${to}. If you were not expecting this, you can safely ignore this email.</p>
      </div>
    `;
    const text = `Welcome to Jobee Private Pilot!\n\n${inviterName} has invited you to join Jobee.\n\nYour Invitation Code: ${code}\nGet Started: ${inviteUrl}\n\nThis invitation was issued specifically for ${to}.`;

    await this.sendEmail({ to, subject, html, text });
  }
}
