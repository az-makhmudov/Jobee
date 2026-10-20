import type { Job, JobMatchAnalysis } from '@job-agent/database';
import type { CandidateContext } from './tailoring-engine.js';

export interface CoverLetterResult {
  text: string;
  evidenceIds: string[];
  changeSummary: string[];
}

export class CoverLetterEngine {
  public static generateCoverLetter(
    candidate: CandidateContext,
    job: Job,
    _matchAnalysis?: JobMatchAnalysis | null,
  ): CoverLetterResult {
    const candidateName = candidate.profile.fullName || 'Candidate';
    const company = job.company || 'your team';
    const jobTitle = job.title;
    const evidenceIds: string[] = [];

    // Strict Invariant: Only records with verificationStatus === 'VERIFIED' AND allowAiUse === true
    // enter generated cover letters.
    const authorizedExperiences = (candidate.experiences || []).filter(
      (e) => e.verificationStatus === 'VERIFIED' && e.allowAiUse === true,
    );
    const authorizedSkills = (candidate.skills || []).filter(
      (s) => s.verificationStatus === 'VERIFIED' && s.allowAiUse === true,
    );

    // Relevant experience from candidate
    const topExp = authorizedExperiences[0];
    let expMention = '';
    if (topExp) {
      const expRole = topExp.position;
      const expOrg = topExp.organization;
      const achievements = Array.isArray(topExp.achievements)
        ? (topExp.achievements as string[])
        : [];

      if (topExp.description && topExp.description.trim().length > 0) {
        const desc = topExp.description.trim().replace(/\.$/, '');
        const verbStart =
          /^(built|developed|managed|assisted|led|designed|implemented|coordinated|directed)/i.test(
            desc,
          );
        expMention = `In my role as ${expRole} at ${expOrg}, I ${verbStart ? desc : 'focused on ' + desc}. `;
      } else {
        expMention = `I worked as ${expRole} at ${expOrg}. `;
      }

      const firstAchievement = achievements[0];
      if (firstAchievement) {
        expMention += `Key contributions include: ${firstAchievement.trim().replace(/\.$/, '')}. `;
      }

      evidenceIds.push(`candidate_experience:${topExp.id}`);
    }

    // Top verified skills
    const skillNames = authorizedSkills.slice(0, 4).map((s) => s.name);
    let skillsMention = '';
    if (skillNames.length > 0) {
      skillsMention = `My skills include ${skillNames.join(', ')}. `;
      for (const s of authorizedSkills.slice(0, 4)) {
        evidenceIds.push(`candidate_skill:${s.id}`);
      }
    }

    const bodyParagraph = `${expMention}${skillsMention}`.trim();

    const paragraphs: string[] = [
      `Dear Hiring Team at ${company},`,

      `I am applying for the ${jobTitle} position at ${company}.`,

      bodyParagraph,

      `I would welcome the opportunity to discuss this role and how I could contribute to your team.`,

      `Thank you for your time and consideration.\n\nSincerely,\n${candidateName}`,
    ].filter(Boolean);

    const text = paragraphs.join('\n\n');

    return {
      text,
      evidenceIds,
      changeSummary: [
        `Generated grounded cover letter for ${jobTitle} at ${company}.`,
        `Referenced verified experience and core proficiencies (${skillNames.join(', ')}).`,
        'Truthfulness invariant preserved: zero synthetic claims or invented achievements.',
      ],
    };
  }
}
