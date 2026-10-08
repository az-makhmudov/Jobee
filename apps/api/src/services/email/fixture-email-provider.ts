import type { NormalizedEmailMessage } from '@job-agent/shared';
import {
  type EmailProvider,
  type OAuthTokens,
  type FetchMessagesOptions,
  type FetchMessagesResult,
} from './email-provider.js';

export class FixtureEmailProvider implements EmailProvider {
  public readonly name = 'FIXTURE';
  private fixtureMessages: NormalizedEmailMessage[] = [];

  constructor(initialMessages?: NormalizedEmailMessage[]) {
    if (initialMessages && initialMessages.length > 0) {
      this.fixtureMessages = [...initialMessages];
    } else {
      this.resetToDefaultFixtures();
    }
  }

  public getAuthorizationUrl(state: string): string {
    return `http://localhost:3000/api/email/oauth/fixture-callback?code=fixture-auth-code&state=${encodeURIComponent(state)}`;
  }

  public async exchangeCodeForTokens(_code: string): Promise<{
    tokens: OAuthTokens;
    emailAddress: string;
    grantedScopes: string[];
    tokenExpiresAt?: Date;
  }> {
    return {
      tokens: {
        accessToken: 'fixture-access-token-xyz',
        refreshToken: 'fixture-refresh-token-abc',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
        scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      },
      emailAddress: 'bek.fixture.candidate@example.com',
      grantedScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      tokenExpiresAt: new Date(Date.now() + 86400 * 1000),
    };
  }

  public async refreshTokens(tokens: OAuthTokens): Promise<{
    tokens: OAuthTokens;
    tokenExpiresAt?: Date;
  }> {
    return {
      tokens: {
        ...tokens,
        accessToken: 'fixture-refreshed-token-xyz',
        expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
      },
      tokenExpiresAt: new Date(Date.now() + 86400 * 1000),
    };
  }

  public async fetchMessages(_options: FetchMessagesOptions): Promise<FetchMessagesResult> {
    return {
      messages: [...this.fixtureMessages],
      hasMore: false,
    };
  }

  public async getMessage(
    _tokens: OAuthTokens,
    messageId: string,
  ): Promise<NormalizedEmailMessage> {
    const msg = this.fixtureMessages.find((m) => m.externalId === messageId);
    if (!msg) {
      throw new Error(`Fixture message with ID ${messageId} not found`);
    }
    return msg;
  }

  public addFixtureMessage(message: NormalizedEmailMessage): void {
    this.fixtureMessages.unshift(message);
  }

  public setFixtureMessages(messages: NormalizedEmailMessage[]): void {
    this.fixtureMessages = [...messages];
  }

  public resetToDefaultFixtures(): void {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 86400 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 86400 * 1000);

    this.fixtureMessages = [
      // 1. Job Alert Email
      {
        externalId: 'fixture-msg-101-job-alert',
        externalThreadId: 'fixture-thread-101',
        from: { name: 'LinkedIn Job Alerts', email: 'jobalerts-noreply@linkedin.com' },
        to: ['bek.fixture.candidate@example.com'],
        subject: '3 new jobs for "Senior Backend Engineer"',
        receivedAt: oneDayAgo,
        snippet:
          'Jobs matching your alert: Senior Backend Engineer at Acme Corp, Staff Platform Engineer at Globex...',
        plainText: `Here are new jobs matching your search criteria:
1. Senior Backend Engineer
Acme Corp — Zurich, Switzerland (Hybrid)
View job: https://jobs.example.com/acme/sr-backend-101

2. Staff Platform Engineer
Globex Software — Remote
View job: https://jobs.example.com/globex/staff-platform-102

3. Rust Systems Architect
Initech Corp — Berlin, Germany
View job: https://jobs.example.com/initech/rust-arch-103
`,
        labels: ['INBOX', 'ALERTS'],
        provider: 'FIXTURE',
      },

      // 2. Application Confirmation
      {
        externalId: 'fixture-msg-102-app-confirm',
        externalThreadId: 'fixture-thread-102',
        from: { name: 'Acme Corp Careers', email: 'no-reply@greenhouse.io' },
        to: ['bek.fixture.candidate@example.com'],
        subject: 'Thank you for applying to Acme Corp (Senior Backend Engineer)',
        receivedAt: twoDaysAgo,
        snippet:
          'Thank you for submitting your application for the Senior Backend Engineer position at Acme Corp...',
        plainText: `Hi Bek,

Thank you for applying for the Senior Backend Engineer position at Acme Corp. We have received your application materials and our talent team is currently reviewing them.

Your application reference ID is: APP-ACME-98421.

We will get back to you with next steps shortly.

Best regards,
The Acme Corp Recruiting Team
`,
        labels: ['INBOX', 'APPLICATIONS'],
        provider: 'FIXTURE',
      },

      // 3. Recruiter Outreach
      {
        externalId: 'fixture-msg-103-recruiter-outreach',
        externalThreadId: 'fixture-thread-103',
        from: { name: 'Sarah Connor', email: 'sarah.connor@techcorp.io' },
        to: ['bek.fixture.candidate@example.com'],
        subject: 'Staff Software Engineer role at TechCorp',
        receivedAt: now,
        snippet:
          'I came across your profile and was really impressed by your background in distributed systems...',
        plainText: `Hi Bek,

I hope this note finds you well! I came across your profile and was really impressed by your background in distributed systems and Node.js/TypeScript architecture.

We are currently looking for a Staff Software Engineer to join our Core Platform team at TechCorp (Remote or Zurich). We are scaling rapidly and looking for someone who can drive high-throughput services.

Would you be open for a brief 15-minute introductory chat this week? You can pick a convenient time on my calendar here: https://calendly.com/sarah-techcorp/15min

Looking forward to connecting!

Best,
Sarah Connor
Lead Talent Partner | TechCorp
`,
        labels: ['INBOX'],
        provider: 'FIXTURE',
      },

      // 4. Screening Request
      {
        externalId: 'fixture-msg-104-screening-request',
        externalThreadId: 'fixture-thread-104',
        from: { name: 'Dave Wayne', email: 'dave.recruiting@wayne.com' },
        to: ['bek.fixture.candidate@example.com'],
        subject: 'Wayne Enterprises: Next steps for your application (Recruiter Screen)',
        receivedAt: now,
        snippet:
          'We would love to schedule a 30-minute introductory phone call to discuss your background...',
        plainText: `Hi Bek,

Thank you for your patience! We reviewed your application for the Senior Infrastructure Engineer role at Wayne Enterprises and would love to move forward to a 30-minute recruiter phone screen.

Please let me know if any of the following times work for you:
- Thursday, 14:00 CET
- Friday, 10:00 CET

Looking forward to speaking with you!

Dave Wayne
Wayne Enterprises Recruiting
`,
        labels: ['INBOX'],
        provider: 'FIXTURE',
      },

      // 5. Assessment Request
      {
        externalId: 'fixture-msg-105-assessment-request',
        externalThreadId: 'fixture-thread-105',
        from: { name: 'Stark Industries Recruiting', email: 'recruiting@hackerrank.net' },
        to: ['bek.fixture.candidate@example.com'],
        subject: 'Coding Assessment: Lead Developer at Stark Industries',
        receivedAt: now,
        snippet:
          'As part of our evaluation process, please complete the technical assessment on HackerRank...',
        plainText: `Hi Bek,

Thank you for applying to Stark Industries for the Lead Developer role.

As the next step in our interview process, we invite you to complete a 90-minute timed coding assessment on HackerRank.

Assessment link: https://www.hackerrank.com/tests/stark-lead-dev-774
Deadline: Please complete this assessment within 5 days (by Sunday midnight).

Good luck!
Stark Industries Talent Acquisition
`,
        labels: ['INBOX'],
        provider: 'FIXTURE',
      },

      // 6. Interview Request
      {
        externalId: 'fixture-msg-106-interview-request',
        externalThreadId: 'fixture-thread-106',
        from: { name: 'Wayne Enterprises Talent', email: 'dave.recruiting@wayne.com' },
        to: ['bek.fixture.candidate@example.com'],
        subject: 'Interview Invitation: Senior Infrastructure Engineer with Wayne Enterprises',
        receivedAt: now,
        snippet:
          'We would like to invite you to interview for the next round of our hiring process...',
        plainText: `Hi Bek,

Following up on your initial conversation, we would love to invite you to interview for the next round of interviews for the Senior Infrastructure Engineer position at Wayne Enterprises.

Please let us know your availability for an interview loop next week.

Best regards,
Wayne Enterprises Talent Team
`,
        labels: ['INBOX'],
        provider: 'FIXTURE',
      },

      // 7. Interview Confirmation
      {
        externalId: 'fixture-msg-107-interview-confirm',
        externalThreadId: 'fixture-thread-107',
        from: { name: 'Recruiting Coordinator', email: 'coordination@acme.com' },
        to: ['bek.fixture.candidate@example.com'],
        subject: 'Interview Scheduled: Technical System Design with Acme Corp',
        receivedAt: now,
        snippet:
          'Your upcoming Technical System Design interview for the Senior Backend Engineer role is confirmed...',
        plainText: `Hi Bek,

Your interview with Acme Corp has been confirmed!

Details:
Role: Senior Backend Engineer
Round: Technical System Design (60 mins)
Date: Friday, Oct 12, 2026 at 15:00 CET
Interviewers: Alex Miller (VP Engineering), Lisa Vance (Principal Architect)
Google Meet: https://meet.google.com/abc-defg-hij

Please test your microphone and camera beforehand.

Best regards,
Acme Corp Talent Coordination
`,
        labels: ['INBOX'],
        provider: 'FIXTURE',
      },

      // 8. Application Rejection (Clear & Unambiguous)
      {
        externalId: 'fixture-msg-108-rejection',
        externalThreadId: 'fixture-thread-108',
        from: { name: 'Cyberdyne Systems Talent Team', email: 'no-reply@workday.com' },
        to: ['bek.fixture.candidate@example.com'],
        subject: 'Update on your application with Cyberdyne Systems',
        receivedAt: now,
        snippet:
          'Thank you for your interest in the Senior Security Engineer role at Cyberdyne Systems...',
        plainText: `Dear Bek,

Thank you for taking the time to speak with our team and apply for the Senior Security Engineer position at Cyberdyne Systems.

While your background and experience are impressive, we have decided to move forward with other candidates whose qualifications more closely align with the specific needs of this role at this time.

We will keep your resume on file for future opportunities that match your skill set. We wish you every success in your job search and future professional endeavors.

Sincerely,
Cyberdyne Systems Talent Acquisition
`,
        labels: ['INBOX'],
        provider: 'FIXTURE',
      },

      // 9. Offer Letter (High Stakes)
      {
        externalId: 'fixture-msg-109-offer',
        externalThreadId: 'fixture-thread-109',
        from: { name: 'Pepper Potts', email: 'pepper.potts@starkindustries.com' },
        to: ['bek.fixture.candidate@example.com'],
        subject: 'Offer of Employment: Lead Developer at Stark Industries',
        receivedAt: now,
        snippet:
          'We are delighted to extend an offer of employment for the Lead Developer role at Stark Industries...',
        plainText: `Dear Bek,

On behalf of Stark Industries, we are pleased to offer you the position of Lead Developer at Stark Industries!

We were exceptionally impressed with your technical vision and problem-solving abilities throughout the interviews. Attached please find your formal offer letter detailing compensation, equity, and benefits.

Base Salary: €145,000 / year
Target Bonus: 15%
Location: Zurich, Switzerland

Please review and sign the attached document by next Monday.

Warm regards,
Pepper Potts
CEO | Stark Industries
`,
        labels: ['INBOX'],
        provider: 'FIXTURE',
      },

      // 10. Irrelevant Marketing / Spam
      {
        externalId: 'fixture-msg-110-marketing',
        externalThreadId: 'fixture-thread-110',
        from: { name: 'Retail Deals', email: 'promotions@shopdeals-weekly.com' },
        to: ['bek.fixture.candidate@example.com'],
        subject: 'Weekend Mega Sale - Up to 50% Off Electronics',
        receivedAt: now,
        snippet: 'Do not miss our biggest electronics clearance sale of the season...',
        plainText: `Hi Customer,

Don't miss our biggest electronics clearance sale of the season! Save up to 50% on headphones, smartwatches, and laptop accessories.

Visit our store today: https://shopdeals-weekly.com/sale

If you no longer wish to receive these promotional emails, you can unsubscribe here: https://shopdeals-weekly.com/unsubscribe
`,
        labels: ['PROMOTIONS'],
        provider: 'FIXTURE',
      },

      // 11. UNKNOWN / Ambiguous Application Update (Human Review Required)
      {
        externalId: 'fixture-msg-111-ambiguous-update',
        externalThreadId: 'fixture-thread-111',
        from: { name: 'Enterprise Career Portal', email: 'notifications@candidate-portal.com' },
        to: ['bek.fixture.candidate@example.com'],
        subject: 'Update regarding your application',
        receivedAt: now,
        snippet: 'There has been an update regarding your application. Please check your portal...',
        plainText: `Dear Applicant,

There has been an update regarding your application. Please check your candidate portal for further details and instructions.

Portal link: https://candidate-portal.com/login

Please do not reply to this automated message.

Best regards,
Talent Operations Team
`,
        labels: ['INBOX'],
        provider: 'FIXTURE',
      },
    ];
  }
}
