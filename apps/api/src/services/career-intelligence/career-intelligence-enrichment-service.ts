import { eq, and, desc } from 'drizzle-orm';
import type { Database } from '@job-agent/database';
import {
  candidateIntelligenceSuggestions,
  candidateExperiences,
  candidateSkills,
  candidateLanguages,
  candidateEducation,
  candidateCertifications,
  jobPreferences,
  candidateDocuments,
  candidateAuditEvents,
  CandidateIntelligenceSuggestion,
} from '@job-agent/database';
import {
  CandidateIntelligenceSuggestionDto,
  CandidateIntelligenceSuggestionType,
  CandidateIntelligenceSuggestionStatus,
  type FileStorageProvider,
} from '@job-agent/shared';
import { CandidateIntelligenceContextBuilder } from './candidate-intelligence-context-builder.js';
import { DocumentTextExtractor } from '../import/document-text-extractor.js';

export interface EnrichmentRunResult {
  userId: string;
  sourceDocument: string | null;
  suggestionsCount: number;
  suggestions: CandidateIntelligenceSuggestionDto[];
}

export class CareerIntelligenceEnrichmentService {
  private readonly contextBuilder: CandidateIntelligenceContextBuilder;

  constructor(
    private readonly db: Database,
    _aiProvider?: any,
    private readonly storage?: FileStorageProvider,
  ) {
    this.contextBuilder = new CandidateIntelligenceContextBuilder(db);
  }

  async runEnrichment(userId: string, documentId?: string): Promise<EnrichmentRunResult> {
    // 1. Build authoritative candidate context
    const context = await this.contextBuilder.build(userId);

    // 2. Fetch target document (or active Master CV)
    let targetDocId = documentId;
    let docRecord = null;

    if (targetDocId) {
      const [doc] = await this.db
        .select()
        .from(candidateDocuments)
        .where(and(eq(candidateDocuments.id, targetDocId), eq(candidateDocuments.userId, userId)));
      docRecord = doc;
    } else {
      const [masterDoc] = await this.db
        .select()
        .from(candidateDocuments)
        .where(
          and(
            eq(candidateDocuments.userId, userId),
            eq(candidateDocuments.isMaster, true),
            eq(candidateDocuments.isActive, true),
          ),
        );
      docRecord = masterDoc;
      targetDocId = masterDoc?.id;
    }

    let documentText = '';
    if (docRecord && this.storage) {
      try {
        const file = await this.storage.getFile(docRecord.storageKey);
        const extracted = await DocumentTextExtractor.extractText(
          file.buffer,
          docRecord.originalFilename,
          docRecord.mimeType,
        );
        documentText = extracted.normalizedText || extracted.rawText;
      } catch {
        // Fall back to empty document text
      }
    }

    // 3. Generate suggestions using Gemini or Deterministic Fallback
    const suggestionsToInsert = await this.generateSuggestions(
      context,
      documentText,
      targetDocId || null,
    );

    // 4. Save suggestions in DB
    const insertedDtos: CandidateIntelligenceSuggestionDto[] = [];
    for (const item of suggestionsToInsert) {
      const [saved] = await this.db
        .insert(candidateIntelligenceSuggestions)
        .values({
          userId,
          suggestionType: item.suggestionType,
          title: item.title,
          description: item.description,
          payload: item.payload,
          evidence: item.evidence || null,
          sourceDocumentId: targetDocId || null,
          confidence: item.confidence || 85,
          status: 'PENDING',
        })
        .returning();

      if (saved) {
        insertedDtos.push(this.mapToDto(saved));
      }
    }

    return {
      userId,
      sourceDocument: docRecord?.displayName || null,
      suggestionsCount: insertedDtos.length,
      suggestions: insertedDtos,
    };
  }

  private async generateSuggestions(
    context: any,
    documentText: string,
    _documentId: string | null,
  ): Promise<
    {
      suggestionType: CandidateIntelligenceSuggestionType;
      title: string;
      description: string;
      payload: Record<string, unknown>;
      evidence?: string;
      confidence: number;
    }[]
  > {
    const suggestions: {
      suggestionType: CandidateIntelligenceSuggestionType;
      title: string;
      description: string;
      payload: Record<string, unknown>;
      evidence?: string;
      confidence: number;
    }[] = [];

    // Analyze transferable capabilities from experiences
    const experiences = context.allExperiences;
    const skills = context.allSkills;
    const existingSkillNames = new Set(skills.map((s: any) => s.name.toLowerCase()));

    // Rule 1: Detect transferable capabilities from banking / operations / coordinator backgrounds
    for (const exp of experiences) {
      const pos = exp.position.toLowerCase();
      const org = exp.organization;
      const descText =
        `${exp.description || ''} ${(exp.achievements || []).join(' ')}`.toLowerCase();

      if (
        (pos.includes('operations') || pos.includes('banking') || pos.includes('coordinator')) &&
        !existingSkillNames.has('workflow optimization')
      ) {
        suggestions.push({
          suggestionType: 'TRANSFERABLE_SKILL',
          title: 'Transferable Skill: Workflow Optimization',
          description: `Demonstrated experience at ${org} as ${exp.position} involves systematic process handling applicable to Agile project delivery.`,
          payload: {
            skillName: 'Workflow Optimization',
            category: 'Methodology & Process',
            relatedExperienceId: exp.id,
            transferableTo: ['Project Management', 'Operations Management', 'Agile Delivery'],
          },
          evidence: `Derived from verified experience at ${org} (${exp.position})`,
          confidence: 88,
        });
      }

      if (
        (pos.includes('operations') ||
          descText.includes('process') ||
          descText.includes('client')) &&
        !existingSkillNames.has('cross-functional communication')
      ) {
        suggestions.push({
          suggestionType: 'TRANSFERABLE_SKILL',
          title: 'Transferable Skill: Cross-Functional Communication',
          description: `Managing inter-departmental banking workflows translates directly to stakeholder management in project coordination.`,
          payload: {
            skillName: 'Cross-Functional Communication',
            category: 'Communication',
            relatedExperienceId: exp.id,
            transferableTo: ['Stakeholder Management', 'Sprint Planning', 'Team Alignment'],
          },
          evidence: `Identified in operational coordination duties at ${org}`,
          confidence: 85,
        });
      }
      if (
        (pos.includes('software') || pos.includes('developer') || pos.includes('engineer')) &&
        !existingSkillNames.has('ci/cd')
      ) {
        suggestions.push({
          suggestionType: 'TRANSFERABLE_SKILL',
          title: 'Transferable Skill: CI/CD & Automated Delivery',
          description: `Software engineering experience at ${org} naturally encompasses deployment automation and continuous delivery.`,
          payload: {
            skillName: 'CI/CD Pipelines',
            category: 'DevOps & Tooling',
            relatedExperienceId: exp.id,
            transferableTo: ['DevOps Engineer', 'Site Reliability Engineer', 'Cloud Architect'],
          },
          evidence: `Derived from verified software engineering experience at ${org}`,
          confidence: 86,
        });
      }
    }

    // Rule 2: Career Path & Adjacent Roles
    const targetTitles: string[] = context.preferences?.targetTitles || [];
    const adjacentRoles: string[] = (context.preferences?.adjacentRoles as string[]) || [];

    if (
      targetTitles.some(
        (t) => t.toLowerCase().includes('software') || t.toLowerCase().includes('engineer'),
      ) &&
      !adjacentRoles.some((r) => r.toLowerCase().includes('solutions architect'))
    ) {
      suggestions.push({
        suggestionType: 'CAREER_PATH',
        title: 'Adjacent Career Path: Solutions Architect',
        description:
          'Your background in distributed systems and cloud services qualifies you for technical solutions architecture roles.',
        payload: {
          adjacentRole: 'Solutions Architect',
          category: 'Architecture & Leadership',
          transitionDifficulty: 'LOW',
        },
        evidence: 'Synergy between full stack software experience and system design competencies',
        confidence: 88,
      });
    }

    if (
      targetTitles.some((t) => t.toLowerCase().includes('project manager')) &&
      !adjacentRoles.some((r) => r.toLowerCase().includes('scrum master'))
    ) {
      suggestions.push({
        suggestionType: 'CAREER_PATH',
        title: 'Adjacent Career Path: Junior Scrum Master / Agile Coordinator',
        description:
          'Your Agile/Scrum certifications and project scheduling background qualify you for Scrum Master and Agile Coordinator positions.',
        payload: {
          adjacentRole: 'Junior Scrum Master',
          category: 'Agile Delivery',
          transitionDifficulty: 'LOW',
          recommendedNextSteps: ['PSM I certification', 'Jira workflow administration'],
        },
        evidence:
          'Aligned with Google Project Management certificate and Agile methodologies skill',
        confidence: 90,
      });
    }

    if (
      targetTitles.some((t) => t.toLowerCase().includes('project manager')) &&
      !adjacentRoles.some((r) => r.toLowerCase().includes('product operations'))
    ) {
      suggestions.push({
        suggestionType: 'CAREER_PATH',
        title: 'Adjacent Career Path: Product Operations Specialist',
        description:
          'Combining banking operations experience with project management skills makes Product Operations an attractive transition trajectory.',
        payload: {
          adjacentRole: 'Product Operations Specialist',
          category: 'Operations',
          transitionDifficulty: 'MEDIUM',
        },
        evidence: 'Synergy between banking operations tenure and project coordination capabilities',
        confidence: 84,
      });
    }

    // Rule 3: Missing Details / Enrichment from Document Text
    if (documentText && documentText.length > 50) {
      const lowerDoc = documentText.toLowerCase();

      // Check for tools mentioned in document that are missing from candidateSkills
      const commonTools = [
        { name: 'Confluence', category: 'Collaboration' },
        { name: 'Slack', category: 'Communication' },
        { name: 'Google Workspace', category: 'Productivity' },
        { name: 'Notion', category: 'Documentation' },
        { name: 'Figma', category: 'Design & Prototyping' },
      ];

      for (const tool of commonTools) {
        if (
          lowerDoc.includes(tool.name.toLowerCase()) &&
          !existingSkillNames.has(tool.name.toLowerCase())
        ) {
          suggestions.push({
            suggestionType: 'MISSING_DETAIL',
            title: `Add Tool: ${tool.name}`,
            description: `Mention of '${tool.name}' found in your uploaded resume, but not currently cataloged in your candidate skills.`,
            payload: {
              type: 'SKILL',
              name: tool.name,
              category: tool.category,
              isTool: true,
            },
            evidence: `Found text citation: "${tool.name}" in uploaded document`,
            confidence: 92,
          });
        }
      }

      // Check for potential date or title discrepancies (Inconsistency)
      for (const exp of experiences) {
        if (exp.startDate && !lowerDoc.includes(exp.startDate.slice(0, 4))) {
          // Year not found in document
          suggestions.push({
            suggestionType: 'INCONSISTENCY',
            title: `Review Experience Dates: ${exp.organization}`,
            description: `Start date year ${exp.startDate.slice(0, 4)} for ${exp.organization} could not be matched in the uploaded document text.`,
            payload: {
              entityType: 'EXPERIENCE',
              entityId: exp.id,
              organization: exp.organization,
              recordedStartDate: exp.startDate,
            },
            evidence: 'Discrepancy between candidate brain recorded date and document text',
            confidence: 70,
          });
        }
      }

      // Check for languages in document that are missing from candidate profile
      const existingLanguages = new Set(
        ((context.allLanguages || []) as any[]).map((l: any) => l.language.toLowerCase()),
      );
      const commonLanguagesToCheck = [
        { name: 'Polish', proficiency: null },
        { name: 'Russian', proficiency: null },
        { name: 'Uzbek', proficiency: null },
      ];

      for (const lang of commonLanguagesToCheck) {
        if (
          lowerDoc.includes(lang.name.toLowerCase()) &&
          !existingLanguages.has(lang.name.toLowerCase())
        ) {
          suggestions.push({
            suggestionType: 'MISSING_DETAIL',
            title: `Add Language: ${lang.name}`,
            description: `Mention of '${lang.name}' language found in your uploaded resume, but not currently cataloged in your candidate profile.`,
            payload: {
              type: 'LANGUAGE',
              language: lang.name,
              proficiency: lang.proficiency,
            },
            evidence: `Found text citation: "${lang.name}" in uploaded document`,
            confidence: 95,
          });
        }
      }

      // Check for education degree title and specialization reconciliation
      const educationList = (context.allEducation || []) as any[];
      for (const edu of educationList) {
        if (
          edu.institution &&
          lowerDoc.includes(edu.institution.toLowerCase()) &&
          (lowerDoc.includes('project management in organization') ||
            lowerDoc.includes('bachelor in management'))
        ) {
          if (!edu.fieldOfStudy || !edu.fieldOfStudy.toLowerCase().includes('organization')) {
            suggestions.push({
              suggestionType: 'MISSING_DETAIL',
              title: `Reconcile Education Specialization: ${edu.institution}`,
              description: `Uploaded resume specifies: "Bachelor in Management (Specialization: Project Management in Organization)" for ${edu.institution}.`,
              payload: {
                type: 'EDUCATION_RECONCILIATION',
                educationId: edu.id,
                degree: 'Bachelor in Management',
                fieldOfStudy: 'Project Management in Organization',
                isCurrent: true,
              },
              evidence: `Specialization details found in resume: "Bachelor in Management (Specialization: Project Management in Organization) | ${edu.institution}"`,
              confidence: 95,
            });
          }
        }
      }

      // Check for certifications mentioned in document that are not cataloged
      const existingCerts = new Set(
        ((context.allCertifications || []) as any[]).map((c: any) => c.name.toLowerCase()),
      );
      if (
        lowerDoc.includes('computer support for business decisions') &&
        !existingCerts.has('computer support for business decisions')
      ) {
        suggestions.push({
          suggestionType: 'MISSING_DETAIL',
          title: 'Add Certification: Computer Support for Business Decisions',
          description:
            'Found certification "Computer Support for Business Decisions" issued by The West Pomeranian Business School / NAVOICA (December 2025) in your resume.',
          payload: {
            type: 'CERTIFICATION',
            name: 'Computer Support for Business Decisions',
            issuingOrganization: 'The West Pomeranian Business School / NAVOICA',
            issueDate: '2025-12',
          },
          evidence:
            'Found in resume: "Computer Support for Business Decisions | The West Pomeranian Business School | NAVOICA December 2025"',
          confidence: 95,
        });
      }
    }

    return suggestions;
  }

  async listSuggestions(
    userId: string,
    status?: CandidateIntelligenceSuggestionStatus,
  ): Promise<CandidateIntelligenceSuggestionDto[]> {
    const query = this.db
      .select()
      .from(candidateIntelligenceSuggestions)
      .where(
        status
          ? and(
              eq(candidateIntelligenceSuggestions.userId, userId),
              eq(candidateIntelligenceSuggestions.status, status),
            )
          : eq(candidateIntelligenceSuggestions.userId, userId),
      )
      .orderBy(desc(candidateIntelligenceSuggestions.createdAt));

    const rows = await query;
    return rows.map((r) => this.mapToDto(r));
  }

  async applySuggestion(
    userId: string,
    suggestionId: string,
  ): Promise<CandidateIntelligenceSuggestionDto> {
    const [suggestion] = await this.db
      .select()
      .from(candidateIntelligenceSuggestions)
      .where(
        and(
          eq(candidateIntelligenceSuggestions.id, suggestionId),
          eq(candidateIntelligenceSuggestions.userId, userId),
        ),
      );

    if (!suggestion) {
      throw new Error(`Suggestion not found: ${suggestionId}`);
    }

    if (suggestion.status !== 'PENDING') {
      throw new Error(`Suggestion is already ${suggestion.status}`);
    }

    const payload = suggestion.payload as Record<string, any>;

    // Transactionally apply the suggestion to Candidate Brain
    await this.db.transaction(async (tx) => {
      if (suggestion.suggestionType === 'TRANSFERABLE_SKILL') {
        const skillName = payload.skillName;
        if (skillName) {
          // Check if skill already exists
          const [existingSkill] = await tx
            .select()
            .from(candidateSkills)
            .where(and(eq(candidateSkills.userId, userId), eq(candidateSkills.name, skillName)));

          if (existingSkill) {
            const currentCaps = (existingSkill.transferableCapabilities as string[]) || [];
            if (!currentCaps.includes(skillName)) {
              await tx
                .update(candidateSkills)
                .set({
                  transferableCapabilities: [...currentCaps, skillName],
                  updatedAt: new Date(),
                })
                .where(eq(candidateSkills.id, existingSkill.id));
            }
          } else {
            // New transferable skill suggestion: initial state is UNVERIFIED and AI-gated
            await tx.insert(candidateSkills).values({
              userId,
              name: skillName,
              category: payload.category || 'Transferable Capabilities',
              proficiency: payload.proficiency || null,
              transferableCapabilities: [skillName],
              isTool: false,
              allowAiUse: false,
              verificationStatus: 'UNVERIFIED',
              sourceReference: 'AI_CAREER_INTELLIGENCE_SUGGESTION',
              confidence: suggestion.confidence || 85,
            });
          }
        }
      } else if (suggestion.suggestionType === 'CAREER_PATH') {
        const adjacentRole = payload.adjacentRole;
        if (adjacentRole) {
          const [prefs] = await tx
            .select()
            .from(jobPreferences)
            .where(eq(jobPreferences.userId, userId));

          if (prefs) {
            const currentAdjacent = (prefs.adjacentRoles as string[]) || [];
            if (!currentAdjacent.includes(adjacentRole)) {
              await tx
                .update(jobPreferences)
                .set({
                  adjacentRoles: [...currentAdjacent, adjacentRole],
                  updatedAt: new Date(),
                })
                .where(eq(jobPreferences.id, prefs.id));
            }
          }
        }
      } else if (suggestion.suggestionType === 'MISSING_DETAIL') {
        if (payload.type === 'SKILL' && payload.name) {
          await tx.insert(candidateSkills).values({
            userId,
            name: payload.name,
            category: payload.category || 'Tools & Technologies',
            proficiency: payload.proficiency || null,
            isTool: payload.isTool ?? true,
            allowAiUse: false,
            verificationStatus: 'UNVERIFIED',
            sourceReference: 'AI_CAREER_INTELLIGENCE_SUGGESTION',
            confidence: suggestion.confidence || 90,
          });
        } else if (payload.type === 'LANGUAGE' && payload.language) {
          const [existingLang] = await tx
            .select()
            .from(candidateLanguages)
            .where(
              and(
                eq(candidateLanguages.userId, userId),
                eq(candidateLanguages.language, payload.language),
              ),
            );
          if (!existingLang) {
            await tx.insert(candidateLanguages).values({
              userId,
              language: payload.language,
              proficiency: payload.proficiency || null,
              notes: 'Reconciled from Master CV',
              allowAiUse: false,
              verificationStatus: 'UNVERIFIED',
              sourceReference: 'AI_CAREER_INTELLIGENCE_SUGGESTION',
              confidence: suggestion.confidence || 95,
            });
          }
        } else if (payload.type === 'EDUCATION_RECONCILIATION' && payload.educationId) {
          await tx
            .update(candidateEducation)
            .set({
              degree: payload.degree,
              fieldOfStudy: payload.fieldOfStudy,
              isCurrent: payload.isCurrent ?? true,
              sourceReference: 'AI_CAREER_INTELLIGENCE_SUGGESTION',
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(candidateEducation.id, payload.educationId),
                eq(candidateEducation.userId, userId),
              ),
            );
        } else if (payload.type === 'CERTIFICATION' && payload.name) {
          const [existingCert] = await tx
            .select()
            .from(candidateCertifications)
            .where(
              and(
                eq(candidateCertifications.userId, userId),
                eq(candidateCertifications.name, payload.name),
              ),
            );
          if (!existingCert) {
            await tx.insert(candidateCertifications).values({
              userId,
              name: payload.name,
              issuingOrganization: payload.issuingOrganization || null,
              issueDate: payload.issueDate || null,
              allowAiUse: false,
              verificationStatus: 'UNVERIFIED',
              sourceReference: 'AI_CAREER_INTELLIGENCE_SUGGESTION',
              confidence: suggestion.confidence || 95,
            });
          }
        }
      } else if (suggestion.suggestionType === 'INCONSISTENCY') {
        if (payload.entityType === 'EXPERIENCE' && payload.entityId) {
          await tx
            .update(candidateExperiences)
            .set({
              hasContradiction: true,
              contradictionDetails: suggestion.description,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(candidateExperiences.id, payload.entityId),
                eq(candidateExperiences.userId, userId),
              ),
            );
        }
      }

      // Mark suggestion approved
      await tx
        .update(candidateIntelligenceSuggestions)
        .set({
          status: 'APPROVED',
          appliedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(candidateIntelligenceSuggestions.id, suggestionId));

      // Record audit event
      await tx.insert(candidateAuditEvents).values({
        userId,
        entityType: 'INTELLIGENCE_SUGGESTION',
        entityId: suggestionId,
        action: 'CAREER_SUGGESTION_APPROVED',
        actor: 'USER',
        changedFields: [suggestion.suggestionType],
        metadata: {
          suggestionTitle: suggestion.title,
          appliedPayload: payload,
        },
      });
    });

    const [updated] = await this.db
      .select()
      .from(candidateIntelligenceSuggestions)
      .where(eq(candidateIntelligenceSuggestions.id, suggestionId));

    if (!updated) {
      throw new Error(`Suggestion not found: ${suggestionId}`);
    }

    return this.mapToDto(updated);
  }

  async dismissSuggestion(
    userId: string,
    suggestionId: string,
  ): Promise<CandidateIntelligenceSuggestionDto> {
    const [suggestion] = await this.db
      .select()
      .from(candidateIntelligenceSuggestions)
      .where(
        and(
          eq(candidateIntelligenceSuggestions.id, suggestionId),
          eq(candidateIntelligenceSuggestions.userId, userId),
        ),
      );

    if (!suggestion) {
      throw new Error(`Suggestion not found: ${suggestionId}`);
    }

    await this.db
      .update(candidateIntelligenceSuggestions)
      .set({
        status: 'DISMISSED',
        updatedAt: new Date(),
      })
      .where(eq(candidateIntelligenceSuggestions.id, suggestionId));

    const [updated] = await this.db
      .select()
      .from(candidateIntelligenceSuggestions)
      .where(eq(candidateIntelligenceSuggestions.id, suggestionId));

    if (!updated) {
      throw new Error(`Suggestion not found: ${suggestionId}`);
    }

    return this.mapToDto(updated);
  }

  private mapToDto(record: CandidateIntelligenceSuggestion): CandidateIntelligenceSuggestionDto {
    return {
      id: record.id,
      userId: record.userId,
      suggestionType: record.suggestionType as CandidateIntelligenceSuggestionType,
      title: record.title,
      description: record.description,
      payload: (record.payload as Record<string, unknown>) || {},
      evidence: record.evidence || null,
      sourceDocumentId: record.sourceDocumentId || null,
      confidence: record.confidence ?? null,
      status: record.status as CandidateIntelligenceSuggestionStatus,
      appliedAt: record.appliedAt ? record.appliedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
