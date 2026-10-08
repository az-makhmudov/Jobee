import { EmailClassificationType, type NormalizedEmailMessage } from '@job-agent/shared';

export interface ClassificationResult {
  classification: EmailClassificationType;
  confidence: number;
  reason: string;
  extractedDetails: {
    company?: string;
    role?: string;
    recruiterName?: string;
    recruiterEmail?: string;
    externalReferenceId?: string;
    assessmentProvider?: string;
    assessmentUrl?: string;
    dueDate?: string;
    interviewDate?: string;
    meetingUrl?: string;
    [key: string]: unknown;
  };
}

export class DeterministicEmailClassifier {
  public static classify(message: NormalizedEmailMessage): ClassificationResult {
    const subject = (message.subject || '').trim();
    const body = (message.plainText || '').trim();
    const fromEmail = (message.from.email || '').toLowerCase();
    const fromName = message.from.name || '';
    const fullText = `${subject}\n${body}`;

    const extractedDetails: ClassificationResult['extractedDetails'] = {
      recruiterEmail: fromEmail,
      recruiterName: fromName || undefined,
    };

    // Extract reference IDs like APP-ACME-98421, Ref: #12345, or "reference ID is: XYZ"
    const refMatch = fullText.match(
      /(?:reference\s+(?:id|code|number|#)?\s*(?:is)?[:\s]+|application\s+(?:id|code|number|#)?\s*(?:is)?[:\s]+|ref[:\s]+#?)([A-Z0-9-]{5,30})/i,
    );
    if (refMatch) {
      extractedDetails.externalReferenceId = refMatch[1]?.trim();
    }

    // Extract assessment links (HackerRank, Codility, TestGorilla, Byteboard)
    const assessmentMatch = fullText.match(
      /https?:\/\/(?:www\.)?(hackerrank\.com|codility\.com|testgorilla\.com|byteboard\.dev|codesignal\.com)\/[^\s)>]+/i,
    );
    if (assessmentMatch) {
      extractedDetails.assessmentUrl = assessmentMatch[0];
      extractedDetails.assessmentProvider = assessmentMatch[1];
    }

    // Extract meeting links (Google Meet, Zoom, Teams, Calendly)
    const meetingMatch = fullText.match(
      /https?:\/\/(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|calendly\.com)\/[^\s)>]+/i,
    );
    if (meetingMatch) {
      extractedDetails.meetingUrl = meetingMatch[0];
    }

    // Extract company / role heuristics
    const thankYouMatch = subject.match(/Thank you for applying to\s+([^()]+)(?:\(([^)]+)\))?/i);
    if (thankYouMatch) {
      extractedDetails.company = thankYouMatch[1]?.trim();
      if (thankYouMatch[2]) {
        extractedDetails.role = thankYouMatch[2]?.trim();
      }
    }

    // Heuristic 2: "[Title] at/with [Company]"
    const roleAtCompanyMatch = fullText.match(
      /(?:role|position|for|assessment:)\s+([A-Z][A-Za-z0-9\s/]+?(?:Engineer|Developer|Architect|Lead|Manager|Specialist|Designer|Analyst))\s+(?:at|with)\s+([A-Z][A-Za-z0-9\s&.-]+?)(?:\.|\n|\r|,|\(|$)/i,
    );
    if (roleAtCompanyMatch) {
      if (!extractedDetails.role) extractedDetails.role = roleAtCompanyMatch[1]?.trim();
      if (!extractedDetails.company) extractedDetails.company = roleAtCompanyMatch[2]?.trim();
    }

    // Heuristic 3: Company in sender name e.g. "Stark Industries Recruiting"
    if (fromName && !extractedDetails.company) {
      const fromCompanyMatch = fromName.match(
        /^([A-Z][A-Za-z0-9\s&.-]+?)\s+(?:Recruiting|Talent|Careers|Team|HR)/i,
      );
      if (fromCompanyMatch) {
        extractedDetails.company = fromCompanyMatch[1]?.trim();
      }
    }

    // Heuristic 4: "for the [Title] position/role" in body
    if (!extractedDetails.role) {
      const forRoleMatch = fullText.match(
        /(?:for the|for a)\s+([A-Z][A-Za-z0-9\s/]+?(?:Engineer|Developer|Architect|Lead|Manager|Specialist|Designer|Analyst))\s+(?:position|role)/i,
      );
      if (forRoleMatch) {
        extractedDetails.role = forRoleMatch[1]?.trim();
      }
    }

    // 1. Job Alert Detection
    if (
      fromEmail.includes('jobalerts') ||
      fromEmail.includes('alert@indeed.com') ||
      /\bjob alert\b/i.test(subject) ||
      /\b\d+\s+new jobs?\b/i.test(subject) ||
      /matching your (job )?search/i.test(body)
    ) {
      return {
        classification: EmailClassificationType.JOB_ALERT,
        confidence: 0.96,
        reason: 'Detected job alert sender and keyword patterns in subject and body',
        extractedDetails,
      };
    }

    // 2. Application Rejection Detection
    const isRejection =
      /decided (not to|to not) move forward/i.test(fullText) ||
      /move forward with other candidates/i.test(fullText) ||
      /will not be moving forward/i.test(fullText) ||
      /pursue other candidates/i.test(fullText) ||
      /not selected for this (position|role)/i.test(fullText) ||
      /regret to inform you/i.test(fullText) ||
      /unsuccessful on this occasion/i.test(fullText);

    if (isRejection) {
      const withCompanyMatch = subject.match(/(?:at|with)\s+([A-Z][A-Za-z0-9\s&.-]+)/);
      if (withCompanyMatch && !extractedDetails.company) {
        extractedDetails.company = withCompanyMatch[1]?.trim();
      }

      return {
        classification: EmailClassificationType.APPLICATION_REJECTION,
        confidence: 0.98,
        reason: 'Unambiguous application rejection phrasing detected',
        extractedDetails,
      };
    }

    // 3. Application Confirmation
    const isConfirmation =
      /thank you for (your )?application/i.test(subject) ||
      /application (received|confirmed)/i.test(subject) ||
      /we('?ve| have) received your application/i.test(fullText) ||
      /received your application for/i.test(fullText);

    if (isConfirmation) {
      return {
        classification: EmailClassificationType.APPLICATION_CONFIRMATION,
        confidence: 0.95,
        reason: 'Application submission receipt and confirmation phrases detected',
        extractedDetails,
      };
    }

    // 4. Recruiter Cold Outreach (Priority over screening if profile sourcing detected)
    const isDirectSourcing =
      /came across your profile/i.test(fullText) ||
      /impressed by your background/i.test(fullText) ||
      (/headhunter|talent partner|lead recruiter/i.test(fullText) &&
        /open to a (quick )?chat|considering new/i.test(fullText));

    if (isDirectSourcing) {
      return {
        classification: EmailClassificationType.RECRUITER_OUTREACH,
        confidence: 0.9,
        reason: 'Direct recruiter sourcing and candidate profile outreach detected',
        extractedDetails,
      };
    }

    // 5. Assessment Request
    const isAssessment =
      Boolean(extractedDetails.assessmentUrl) ||
      /coding assessment/i.test(fullText) ||
      /technical assessment/i.test(fullText) ||
      /online test/i.test(fullText) ||
      /timed (coding|technical) test/i.test(fullText) ||
      /take-home (challenge|project|assignment)/i.test(fullText);

    if (isAssessment) {
      return {
        classification: EmailClassificationType.ASSESSMENT_REQUEST,
        confidence: 0.94,
        reason: 'Technical assessment invitation and test provider signals detected',
        extractedDetails,
      };
    }

    // 6. Interview Scheduled / Confirmed
    const isInterviewConfirmed =
      /interview scheduled/i.test(subject) ||
      /interview (is )?confirmed/i.test(subject) ||
      /invitation: .*interview/i.test(subject) ||
      (/interview/i.test(subject) && /google meet|zoom\.us|teams\.microsoft\.com/i.test(fullText));

    if (isInterviewConfirmed) {
      return {
        classification: EmailClassificationType.INTERVIEW_CONFIRMATION,
        confidence: 0.93,
        reason: 'Confirmed interview scheduling and video meeting link detected',
        extractedDetails,
      };
    }

    // 7. Screening Request
    const isScreening =
      /recruiter (screen|call|chat)/i.test(fullText) ||
      /phone screen/i.test(fullText) ||
      /introductory (call|chat|phone)/i.test(fullText) ||
      /initial (screening|conversation)/i.test(fullText);

    if (isScreening) {
      return {
        classification: EmailClassificationType.SCREENING_REQUEST,
        confidence: 0.91,
        reason: 'Recruiter phone screening invitation patterns detected',
        extractedDetails,
      };
    }

    // 8. General Interview Request
    const isInterviewRequest =
      /schedule (an?|your) interview/i.test(fullText) ||
      /availability for (an?|the) interview/i.test(fullText) ||
      /invite you to interview/i.test(fullText) ||
      /next round of interviews/i.test(fullText);

    if (isInterviewRequest) {
      return {
        classification: EmailClassificationType.INTERVIEW_REQUEST,
        confidence: 0.9,
        reason: 'Interview scheduling request or availability query detected',
        extractedDetails,
      };
    }

    // 9. Offer Related
    const isOffer =
      /offer letter/i.test(fullText) ||
      /job offer/i.test(subject) ||
      /pleased to offer you the position/i.test(fullText) ||
      /extend an offer/i.test(fullText);

    if (isOffer) {
      return {
        classification: EmailClassificationType.OFFER_RELATED,
        confidence: 0.95,
        reason: 'Job offer letter or employment offer terms detected',
        extractedDetails,
      };
    }

    // 10. General Application Update
    if (/application update|status of your application/i.test(subject)) {
      return {
        classification: EmailClassificationType.APPLICATION_UPDATE,
        confidence: 0.8,
        reason: 'General application status update email header detected',
        extractedDetails,
      };
    }

    // 11. Marketing / Newsletters / Irrelevant
    if (/unsubscribe/i.test(body) && !/interview|application|hiring|recruiter/i.test(fullText)) {
      return {
        classification: EmailClassificationType.IRRELEVANT,
        confidence: 0.85,
        reason: 'Generic marketing newsletter without recruitment context',
        extractedDetails,
      };
    }

    // Ambiguous / Default
    return {
      classification: EmailClassificationType.UNKNOWN,
      confidence: 0.4,
      reason: 'No clear recruitment pattern or unambiguous classification markers matched',
      extractedDetails,
    };
  }
}
