import { eq, desc, and } from 'drizzle-orm';
import type { Database } from '@job-agent/database';
import {
  candidateProfiles,
  candidateExperiences,
  candidateEducation,
  candidateProjects,
  candidateSkills,
  candidateLanguages,
  candidateCertifications,
  candidateLinks,
  candidateFacts,
  candidateDocuments,
  answerLibrary,
  jobPreferences,
  applicationPolicy,
  candidateAuditEvents,
  getOrCreatePrimaryUser,
  type AuditAction,
} from '@job-agent/database';
import {
  AppError,
  calculateProfileCompleteness,
  type CandidateOverviewDto,
  type CandidateProfileDto,
  type CandidateExperienceDto,
  type CandidateEducationDto,
  type CandidateProjectDto,
  type CandidateSkillDto,
  type CandidateLanguageDto,
  type CandidateCertificationDto,
  type CandidateLinkDto,
  type CandidateFactDto,
  type CandidateDocumentDto,
  type AnswerLibraryEntryDto,
  type JobPreferencesDto,
  type ApplicationPolicyDto,
  type CandidateAuditEventDto,
  type FileStorageProvider,
} from '@job-agent/shared';

export class CandidateService {
  constructor(
    private readonly db: Database,
    private readonly storage: FileStorageProvider,
  ) {}

  public async getPrimaryUserId(): Promise<string> {
    const user = await getOrCreatePrimaryUser(this.db);
    return user.id;
  }

  private async recordAudit(options: {
    userId: string;
    entityType: string;
    entityId: string;
    action: AuditAction;
    changedFields?: string[];
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    try {
      await this.db.insert(candidateAuditEvents).values({
        userId: options.userId,
        entityType: options.entityType,
        entityId: options.entityId,
        action: options.action,
        actor: 'USER',
        changedFields: options.changedFields ?? [],
        metadata: options.metadata ?? null,
      });
    } catch {
      // Audit failures must not break the primary operational flow
    }
  }

  private mapProfileToDto(row: any): CandidateProfileDto {
    return {
      ...row,
      transferableCapabilities: (row.transferableCapabilities as string[]) || [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapExperienceToDto(row: any): CandidateExperienceDto {
    return {
      ...row,
      verificationStatus: row.verificationStatus as any,
      responsibilities: (row.responsibilities as string[]) || [],
      skills: (row.skills as string[]) || [],
      transferableCapabilities: (row.transferableCapabilities as string[]) || [],
      lastConfirmedAt: row.lastConfirmedAt ? row.lastConfirmedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapEducationToDto(row: any): CandidateEducationDto {
    return {
      ...row,
      verificationStatus: row.verificationStatus as any,
      lastConfirmedAt: row.lastConfirmedAt ? row.lastConfirmedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapSkillToDto(row: any): CandidateSkillDto {
    return {
      ...row,
      verificationStatus: row.verificationStatus as any,
      transferableCapabilities: (row.transferableCapabilities as string[]) || [],
      lastConfirmedAt: row.lastConfirmedAt ? row.lastConfirmedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapLanguageToDto(row: any): CandidateLanguageDto {
    return {
      ...row,
      verificationStatus: row.verificationStatus as any,
      lastConfirmedAt: row.lastConfirmedAt ? row.lastConfirmedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapCertificationToDto(row: any): CandidateCertificationDto {
    return {
      ...row,
      verificationStatus: row.verificationStatus as any,
      lastConfirmedAt: row.lastConfirmedAt ? row.lastConfirmedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapProjectToDto(row: any): CandidateProjectDto {
    return {
      ...row,
      verificationStatus: row.verificationStatus as any,
      lastConfirmedAt: row.lastConfirmedAt ? row.lastConfirmedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapFactToDto(row: any): CandidateFactDto {
    return {
      ...row,
      verificationStatus: row.verificationStatus as any,
      sources: (row.sources as string[]) || [],
      lastConfirmedAt: row.lastConfirmedAt ? row.lastConfirmedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapPreferencesToDto(row: any): JobPreferencesDto {
    return {
      ...row,
      adjacentRoles: (row.adjacentRoles as string[]) || [],
      preferredIndustries: (row.preferredIndustries as string[]) || [],
      careerTransitions: (row.careerTransitions as string[]) || [],
      developmentPriorities: (row.developmentPriorities as string[]) || [],
      workAuthorizationCountries: (row.workAuthorizationCountries as string[]) || [],
      learnedPreferences: (row.learnedPreferences as any) || null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // --- Profile ---
  public async getProfile(userId: string): Promise<CandidateProfileDto | null> {
    const profile = await this.db.query.candidateProfiles.findFirst({
      where: eq(candidateProfiles.userId, userId),
    });
    if (!profile) return null;
    return this.mapProfileToDto(profile);
  }

  public async upsertProfile(
    userId: string,
    data: {
      preferredName?: string | null;
      fullName?: string | null;
      headline?: string | null;
      email?: string | null;
      phone?: string | null;
      city?: string | null;
      region?: string | null;
      country?: string | null;
      summary?: string | null;
      availability?: string | null;
    },
  ): Promise<CandidateProfileDto> {
    const existing = await this.getProfile(userId);
    let result: CandidateProfileDto;

    if (existing) {
      const [updated] = await this.db
        .update(candidateProfiles)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(candidateProfiles.userId, userId))
        .returning();
      result = this.mapProfileToDto(updated!);
      await this.recordAudit({
        userId,
        entityType: 'PROFILE',
        entityId: result.id,
        action: 'UPDATE',
        changedFields: Object.keys(data),
        metadata: null,
      });
    } else {
      const [created] = await this.db
        .insert(candidateProfiles)
        .values({
          userId,
          ...data,
        })
        .returning();
      result = this.mapProfileToDto(created!);
      await this.recordAudit({
        userId,
        entityType: 'PROFILE',
        entityId: result.id,
        action: 'CREATE',
        changedFields: Object.keys(data),
        metadata: null,
      });
    }

    return result;
  }

  // --- Experience ---
  public async getExperiences(userId: string): Promise<CandidateExperienceDto[]> {
    const rows = await this.db.query.candidateExperiences.findMany({
      where: eq(candidateExperiences.userId, userId),
      orderBy: [candidateExperiences.displayOrder, desc(candidateExperiences.startDate)],
    });
    return rows.map((r) => this.mapExperienceToDto(r));
  }

  public async createExperience(
    userId: string,
    data: {
      organization: string;
      position: string;
      location?: string | null;
      employmentType?: string | null;
      startDate: string;
      endDate?: string | null;
      isCurrent?: boolean;
      description?: string | null;
      achievements?: string[];
      displayOrder?: number;
      verificationStatus?: string;
    },
  ): Promise<CandidateExperienceDto> {
    const [row] = await this.db
      .insert(candidateExperiences)
      .values({
        userId,
        organization: data.organization.trim(),
        position: data.position.trim(),
        location: data.location?.trim() || null,
        employmentType: data.employmentType?.trim() || null,
        startDate: data.startDate.trim(),
        endDate: data.endDate?.trim() || null,
        isCurrent: data.isCurrent ?? false,
        description: data.description?.trim() || null,
        achievements: data.achievements ?? [],
        displayOrder: data.displayOrder ?? 0,
        verificationStatus: data.verificationStatus ?? 'UNVERIFIED',
      })
      .returning();

    await this.recordAudit({
      userId,
      entityType: 'EXPERIENCE',
      entityId: row!.id,
      action: 'CREATE',
      changedFields: Object.keys(data),
      metadata: null,
    });

    return this.mapExperienceToDto(row!);
  }

  public async updateExperience(
    userId: string,
    id: string,
    data: Partial<{
      organization: string;
      position: string;
      location: string | null;
      employmentType: string | null;
      startDate: string;
      endDate: string | null;
      isCurrent: boolean;
      description: string | null;
      achievements: string[];
      displayOrder: number;
      verificationStatus: string;
    }>,
  ): Promise<CandidateExperienceDto> {
    const [row] = await this.db
      .update(candidateExperiences)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(candidateExperiences.id, id), eq(candidateExperiences.userId, userId)))
      .returning();

    if (!row) throw AppError.notFound(`Experience record ${id} not found`);

    await this.recordAudit({
      userId,
      entityType: 'EXPERIENCE',
      entityId: id,
      action: data.verificationStatus ? 'VERIFY' : 'UPDATE',
      changedFields: Object.keys(data),
      metadata: null,
    });

    return this.mapExperienceToDto(row);
  }

  public async deleteExperience(userId: string, id: string): Promise<void> {
    const [row] = await this.db
      .delete(candidateExperiences)
      .where(and(eq(candidateExperiences.id, id), eq(candidateExperiences.userId, userId)))
      .returning();
    if (!row) throw AppError.notFound(`Experience record ${id} not found`);

    await this.recordAudit({
      userId,
      entityType: 'EXPERIENCE',
      entityId: id,
      action: 'DELETE',
      changedFields: [],
      metadata: null,
    });
  }

  // --- Education ---
  public async getEducation(userId: string): Promise<CandidateEducationDto[]> {
    const rows = await this.db.query.candidateEducation.findMany({
      where: eq(candidateEducation.userId, userId),
      orderBy: [candidateEducation.displayOrder, desc(candidateEducation.startDate)],
    });
    return rows.map((r) => this.mapEducationToDto(r));
  }

  public async createEducation(
    userId: string,
    data: {
      institution: string;
      degree?: string | null;
      fieldOfStudy?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      isCurrent?: boolean;
      location?: string | null;
      description?: string | null;
      activities?: string | null;
      displayOrder?: number;
      verificationStatus?: string;
    },
  ): Promise<CandidateEducationDto> {
    const [row] = await this.db
      .insert(candidateEducation)
      .values({
        userId,
        institution: data.institution.trim(),
        degree: data.degree?.trim() || null,
        fieldOfStudy: data.fieldOfStudy?.trim() || null,
        startDate: data.startDate?.trim() || null,
        endDate: data.endDate?.trim() || null,
        isCurrent: data.isCurrent ?? false,
        location: data.location?.trim() || null,
        description: data.description?.trim() || null,
        activities: data.activities?.trim() || null,
        displayOrder: data.displayOrder ?? 0,
        verificationStatus: data.verificationStatus ?? 'UNVERIFIED',
      })
      .returning();

    await this.recordAudit({
      userId,
      entityType: 'EDUCATION',
      entityId: row!.id,
      action: 'CREATE',
      changedFields: Object.keys(data),
      metadata: null,
    });

    return this.mapEducationToDto(row!);
  }

  public async updateEducation(
    userId: string,
    id: string,
    data: Partial<{
      institution: string;
      degree: string | null;
      fieldOfStudy: string | null;
      startDate: string | null;
      endDate: string | null;
      isCurrent: boolean;
      location: string | null;
      description: string | null;
      activities: string | null;
      displayOrder: number;
      verificationStatus: string;
    }>,
  ): Promise<CandidateEducationDto> {
    const [row] = await this.db
      .update(candidateEducation)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(candidateEducation.id, id), eq(candidateEducation.userId, userId)))
      .returning();

    if (!row) throw AppError.notFound(`Education record ${id} not found`);

    await this.recordAudit({
      userId,
      entityType: 'EDUCATION',
      entityId: id,
      action: 'UPDATE',
      changedFields: Object.keys(data),
      metadata: null,
    });

    return this.mapEducationToDto(row);
  }

  public async deleteEducation(userId: string, id: string): Promise<void> {
    const [row] = await this.db
      .delete(candidateEducation)
      .where(and(eq(candidateEducation.id, id), eq(candidateEducation.userId, userId)))
      .returning();
    if (!row) throw AppError.notFound(`Education record ${id} not found`);

    await this.recordAudit({
      userId,
      entityType: 'EDUCATION',
      entityId: id,
      action: 'DELETE',
      changedFields: [],
      metadata: null,
    });
  }

  // --- Projects ---
  public async getProjects(userId: string): Promise<CandidateProjectDto[]> {
    const rows = await this.db.query.candidateProjects.findMany({
      where: eq(candidateProjects.userId, userId),
      orderBy: [candidateProjects.displayOrder, desc(candidateProjects.startDate)],
    });
    return rows.map((r) => this.mapProjectToDto(r));
  }

  public async createProject(
    userId: string,
    data: {
      name: string;
      role?: string | null;
      description?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      projectUrl?: string | null;
      skills?: string[];
      achievements?: string[];
      isActive?: boolean;
      displayOrder?: number;
      verificationStatus?: string;
    },
  ): Promise<CandidateProjectDto> {
    const [row] = await this.db
      .insert(candidateProjects)
      .values({
        userId,
        name: data.name.trim(),
        role: data.role?.trim() || null,
        description: data.description?.trim() || null,
        startDate: data.startDate?.trim() || null,
        endDate: data.endDate?.trim() || null,
        projectUrl: data.projectUrl?.trim() || null,
        skills: data.skills ?? [],
        achievements: data.achievements ?? [],
        isActive: data.isActive ?? false,
        displayOrder: data.displayOrder ?? 0,
        verificationStatus: data.verificationStatus ?? 'UNVERIFIED',
      })
      .returning();

    await this.recordAudit({
      userId,
      entityType: 'PROJECT',
      entityId: row!.id,
      action: 'CREATE',
      changedFields: Object.keys(data),
      metadata: null,
    });

    return this.mapProjectToDto(row!);
  }

  public async updateProject(
    userId: string,
    id: string,
    data: Partial<{
      name: string;
      role: string | null;
      description: string | null;
      startDate: string | null;
      endDate: string | null;
      projectUrl: string | null;
      skills: string[];
      achievements: string[];
      isActive: boolean;
      displayOrder: number;
      verificationStatus: string;
    }>,
  ): Promise<CandidateProjectDto> {
    const [row] = await this.db
      .update(candidateProjects)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(candidateProjects.id, id), eq(candidateProjects.userId, userId)))
      .returning();

    if (!row) throw AppError.notFound(`Project record ${id} not found`);

    await this.recordAudit({
      userId,
      entityType: 'PROJECT',
      entityId: id,
      action: 'UPDATE',
      changedFields: Object.keys(data),
      metadata: null,
    });

    return this.mapProjectToDto(row);
  }

  public async deleteProject(userId: string, id: string): Promise<void> {
    const [row] = await this.db
      .delete(candidateProjects)
      .where(and(eq(candidateProjects.id, id), eq(candidateProjects.userId, userId)))
      .returning();
    if (!row) throw AppError.notFound(`Project record ${id} not found`);

    await this.recordAudit({
      userId,
      entityType: 'PROJECT',
      entityId: id,
      action: 'DELETE',
      changedFields: [],
      metadata: null,
    });
  }

  // --- Skills ---
  public async getSkills(userId: string): Promise<CandidateSkillDto[]> {
    const rows = await this.db.query.candidateSkills.findMany({
      where: eq(candidateSkills.userId, userId),
      orderBy: [candidateSkills.category, candidateSkills.name],
    });
    return rows.map((r) => this.mapSkillToDto(r));
  }

  public async createSkill(
    userId: string,
    data: {
      name: string;
      category?: string | null;
      proficiency?: string | null;
      yearsExperience?: number | null;
      isActive?: boolean;
      verificationStatus?: string;
    },
  ): Promise<CandidateSkillDto> {
    const [row] = await this.db
      .insert(candidateSkills)
      .values({
        userId,
        name: data.name.trim(),
        category: data.category?.trim() || null,
        proficiency: data.proficiency?.trim() || null,
        yearsExperience: data.yearsExperience ?? null,
        isActive: data.isActive ?? true,
        verificationStatus: data.verificationStatus ?? 'UNVERIFIED',
      })
      .returning();

    await this.recordAudit({
      userId,
      entityType: 'SKILL',
      entityId: row!.id,
      action: 'CREATE',
      changedFields: Object.keys(data),
      metadata: null,
    });

    return this.mapSkillToDto(row!);
  }

  public async updateSkill(
    userId: string,
    id: string,
    data: Partial<{
      name: string;
      category: string | null;
      proficiency: string | null;
      yearsExperience: number | null;
      isActive: boolean;
      verificationStatus: string;
    }>,
  ): Promise<CandidateSkillDto> {
    const [row] = await this.db
      .update(candidateSkills)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(candidateSkills.id, id), eq(candidateSkills.userId, userId)))
      .returning();

    if (!row) throw AppError.notFound(`Skill ${id} not found`);

    await this.recordAudit({
      userId,
      entityType: 'SKILL',
      entityId: id,
      action: 'UPDATE',
      changedFields: Object.keys(data),
      metadata: null,
    });

    return this.mapSkillToDto(row);
  }

  public async deleteSkill(userId: string, id: string): Promise<void> {
    const [row] = await this.db
      .delete(candidateSkills)
      .where(and(eq(candidateSkills.id, id), eq(candidateSkills.userId, userId)))
      .returning();
    if (!row) throw AppError.notFound(`Skill ${id} not found`);

    await this.recordAudit({
      userId,
      entityType: 'SKILL',
      entityId: id,
      action: 'DELETE',
      changedFields: [],
      metadata: null,
    });
  }

  // --- Languages ---
  public async getLanguages(userId: string): Promise<CandidateLanguageDto[]> {
    const rows = await this.db.query.candidateLanguages.findMany({
      where: eq(candidateLanguages.userId, userId),
    });
    return rows.map((r) => this.mapLanguageToDto(r));
  }

  public async createLanguage(
    userId: string,
    data: {
      language: string;
      proficiency?: string | null;
      cefrLevel?: string | null;
      notes?: string | null;
      verificationStatus?: string;
    },
  ): Promise<CandidateLanguageDto> {
    const [row] = await this.db
      .insert(candidateLanguages)
      .values({
        userId,
        language: data.language.trim(),
        proficiency: data.proficiency?.trim() || null,
        cefrLevel: data.cefrLevel?.trim() || null,
        notes: data.notes?.trim() || null,
        verificationStatus: data.verificationStatus ?? 'UNVERIFIED',
      })
      .returning();

    await this.recordAudit({
      userId,
      entityType: 'LANGUAGE',
      entityId: row!.id,
      action: 'CREATE',
      changedFields: Object.keys(data),
      metadata: null,
    });

    return this.mapLanguageToDto(row!);
  }

  public async updateLanguage(
    userId: string,
    id: string,
    data: Partial<{
      language: string;
      proficiency: string | null;
      cefrLevel: string | null;
      notes: string | null;
      verificationStatus: string;
    }>,
  ): Promise<CandidateLanguageDto> {
    const [row] = await this.db
      .update(candidateLanguages)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(candidateLanguages.id, id), eq(candidateLanguages.userId, userId)))
      .returning();

    if (!row) throw AppError.notFound(`Language ${id} not found`);

    await this.recordAudit({
      userId,
      entityType: 'LANGUAGE',
      entityId: id,
      action: 'UPDATE',
      changedFields: Object.keys(data),
      metadata: null,
    });

    return this.mapLanguageToDto(row);
  }

  public async deleteLanguage(userId: string, id: string): Promise<void> {
    const [row] = await this.db
      .delete(candidateLanguages)
      .where(and(eq(candidateLanguages.id, id), eq(candidateLanguages.userId, userId)))
      .returning();
    if (!row) throw AppError.notFound(`Language ${id} not found`);

    await this.recordAudit({
      userId,
      entityType: 'LANGUAGE',
      entityId: id,
      action: 'DELETE',
      changedFields: [],
      metadata: null,
    });
  }

  // --- Certifications ---
  public async getCertifications(userId: string): Promise<CandidateCertificationDto[]> {
    const rows = await this.db.query.candidateCertifications.findMany({
      where: eq(candidateCertifications.userId, userId),
    });
    return rows.map((r) => this.mapCertificationToDto(r));
  }

  public async createCertification(
    userId: string,
    data: {
      name: string;
      issuingOrganization: string;
      issueDate?: string | null;
      expirationDate?: string | null;
      credentialId?: string | null;
      credentialUrl?: string | null;
      verificationStatus?: string;
    },
  ): Promise<CandidateCertificationDto> {
    const [row] = await this.db
      .insert(candidateCertifications)
      .values({
        userId,
        name: data.name.trim(),
        issuingOrganization: data.issuingOrganization.trim(),
        issueDate: data.issueDate?.trim() || null,
        expirationDate: data.expirationDate?.trim() || null,
        credentialId: data.credentialId?.trim() || null,
        credentialUrl: data.credentialUrl?.trim() || null,
        verificationStatus: data.verificationStatus ?? 'UNVERIFIED',
      })
      .returning();

    await this.recordAudit({
      userId,
      entityType: 'CERTIFICATION',
      entityId: row!.id,
      action: 'CREATE',
      changedFields: Object.keys(data),
      metadata: null,
    });

    return this.mapCertificationToDto(row!);
  }

  public async updateCertification(
    userId: string,
    id: string,
    data: Partial<{
      name: string;
      issuingOrganization: string;
      issueDate: string | null;
      expirationDate: string | null;
      credentialId: string | null;
      credentialUrl: string | null;
      verificationStatus: string;
    }>,
  ): Promise<CandidateCertificationDto> {
    const [row] = await this.db
      .update(candidateCertifications)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(candidateCertifications.id, id), eq(candidateCertifications.userId, userId)))
      .returning();

    if (!row) throw AppError.notFound(`Certification ${id} not found`);

    await this.recordAudit({
      userId,
      entityType: 'CERTIFICATION',
      entityId: id,
      action: 'UPDATE',
      changedFields: Object.keys(data),
      metadata: null,
    });

    return this.mapCertificationToDto(row);
  }

  public async deleteCertification(userId: string, id: string): Promise<void> {
    const [row] = await this.db
      .delete(candidateCertifications)
      .where(and(eq(candidateCertifications.id, id), eq(candidateCertifications.userId, userId)))
      .returning();
    if (!row) throw AppError.notFound(`Certification ${id} not found`);

    await this.recordAudit({
      userId,
      entityType: 'CERTIFICATION',
      entityId: id,
      action: 'DELETE',
      changedFields: [],
      metadata: null,
    });
  }

  // --- Links ---
  public async getLinks(userId: string): Promise<CandidateLinkDto[]> {
    const rows = await this.db.query.candidateLinks.findMany({
      where: eq(candidateLinks.userId, userId),
      orderBy: [candidateLinks.displayOrder],
    });
    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  public async createLink(
    userId: string,
    data: {
      label: string;
      url: string;
      displayOrder?: number;
    },
  ): Promise<CandidateLinkDto> {
    const [row] = await this.db
      .insert(candidateLinks)
      .values({
        userId,
        label: data.label.trim(),
        url: data.url.trim(),
        displayOrder: data.displayOrder ?? 0,
      })
      .returning();

    await this.recordAudit({
      userId,
      entityType: 'LINK',
      entityId: row!.id,
      action: 'CREATE',
      changedFields: Object.keys(data),
      metadata: null,
    });

    return {
      ...row!,
      createdAt: row!.createdAt.toISOString(),
      updatedAt: row!.updatedAt.toISOString(),
    };
  }

  public async updateLink(
    userId: string,
    id: string,
    data: Partial<{
      label: string;
      url: string;
      displayOrder: number;
    }>,
  ): Promise<CandidateLinkDto> {
    const [row] = await this.db
      .update(candidateLinks)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(candidateLinks.id, id), eq(candidateLinks.userId, userId)))
      .returning();

    if (!row) throw AppError.notFound(`Link ${id} not found`);

    await this.recordAudit({
      userId,
      entityType: 'LINK',
      entityId: id,
      action: 'UPDATE',
      changedFields: Object.keys(data),
      metadata: null,
    });

    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  public async deleteLink(userId: string, id: string): Promise<void> {
    const [row] = await this.db
      .delete(candidateLinks)
      .where(and(eq(candidateLinks.id, id), eq(candidateLinks.userId, userId)))
      .returning();
    if (!row) throw AppError.notFound(`Link ${id} not found`);

    await this.recordAudit({
      userId,
      entityType: 'LINK',
      entityId: id,
      action: 'DELETE',
      changedFields: [],
      metadata: null,
    });
  }

  // --- Candidate Facts ---
  public async getFacts(
    userId: string,
    filters?: { verificationStatus?: string; allowAiUseOnly?: boolean },
  ): Promise<CandidateFactDto[]> {
    const conditions = [eq(candidateFacts.userId, userId)];
    if (filters?.verificationStatus) {
      conditions.push(eq(candidateFacts.verificationStatus, filters.verificationStatus));
    }
    if (filters?.allowAiUseOnly) {
      conditions.push(eq(candidateFacts.allowAiUse, true));
    }
    const rows = await this.db.query.candidateFacts.findMany({
      where: and(...conditions),
      orderBy: [desc(candidateFacts.createdAt)],
    });
    return rows.map((r) => this.mapFactToDto(r));
  }

  public async createFact(
    userId: string,
    data: {
      category: string;
      factKey: string;
      statement: string;
      structuredValue?: unknown;
      sourceType?: string;
      sourceEntityId?: string | null;
      verificationStatus?: string;
      allowAiUse?: boolean;
    },
  ): Promise<CandidateFactDto> {
    const status = data.verificationStatus ?? 'UNVERIFIED';
    // Invariant: Unverified facts cannot be used by AI
    const allowAi = status === 'VERIFIED' ? (data.allowAiUse ?? false) : false;

    const [row] = await this.db
      .insert(candidateFacts)
      .values({
        userId,
        category: data.category.trim(),
        factKey: data.factKey.trim(),
        statement: data.statement.trim(),
        structuredValue: data.structuredValue ?? null,
        sourceType: data.sourceType ?? 'MANUAL',
        sourceEntityId: data.sourceEntityId ?? null,
        verificationStatus: status,
        allowAiUse: allowAi,
      })
      .returning();

    await this.recordAudit({
      userId,
      entityType: 'FACT',
      entityId: row!.id,
      action: 'CREATE',
      changedFields: Object.keys(data),
      metadata: { factKey: row!.factKey, category: row!.category },
    });

    return this.mapFactToDto(row!);
  }

  public async updateFact(
    userId: string,
    id: string,
    data: Partial<{
      category: string;
      factKey: string;
      statement: string;
      structuredValue: unknown;
      sourceType: string;
      sourceEntityId: string | null;
      verificationStatus: string;
      allowAiUse: boolean;
    }>,
  ): Promise<CandidateFactDto> {
    const [existing] = await this.db
      .select()
      .from(candidateFacts)
      .where(and(eq(candidateFacts.id, id), eq(candidateFacts.userId, userId)))
      .limit(1);

    if (!existing) throw AppError.notFound(`Candidate fact ${id} not found`);

    const effectiveStatus = data.verificationStatus ?? existing.verificationStatus;
    let allowAi = data.allowAiUse !== undefined ? data.allowAiUse : existing.allowAiUse;
    if (effectiveStatus !== 'VERIFIED') {
      allowAi = false;
    }

    const [row] = await this.db
      .update(candidateFacts)
      .set({
        ...data,
        allowAiUse: allowAi,
        updatedAt: new Date(),
      })
      .where(and(eq(candidateFacts.id, id), eq(candidateFacts.userId, userId)))
      .returning();

    if (!row) throw AppError.notFound(`Candidate fact ${id} not found`);

    await this.recordAudit({
      userId,
      entityType: 'FACT',
      entityId: id,
      action: data.verificationStatus ? 'VERIFY' : 'UPDATE',
      changedFields: Object.keys(data),
      metadata: { factKey: row.factKey, category: row.category },
    });

    return this.mapFactToDto(row);
  }

  public async deleteFact(userId: string, id: string): Promise<void> {
    const [row] = await this.db
      .delete(candidateFacts)
      .where(and(eq(candidateFacts.id, id), eq(candidateFacts.userId, userId)))
      .returning();
    if (!row) throw AppError.notFound(`Candidate fact ${id} not found`);

    await this.recordAudit({
      userId,
      entityType: 'FACT',
      entityId: id,
      action: 'DELETE',
      changedFields: [],
      metadata: null,
    });
  }

  // --- Documents ---
  public async getDocuments(userId: string): Promise<CandidateDocumentDto[]> {
    const rows = await this.db.query.candidateDocuments.findMany({
      where: eq(candidateDocuments.userId, userId),
      orderBy: [desc(candidateDocuments.createdAt)],
    });
    return rows.map((r) => ({
      ...r,
      documentType: r.documentType as any,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  public async uploadDocument(
    userId: string,
    fileBuffer: Buffer,
    fileMeta: { originalFilename: string; mimeType: string },
    docMeta: {
      documentType: string;
      displayName?: string;
      roleFocus?: string | null;
      version?: string;
      isMaster?: boolean;
    },
  ): Promise<CandidateDocumentDto> {
    const storageResult = await this.storage.saveFile(fileBuffer, fileMeta);

    // If marked as isMaster, unset isMaster on existing documents
    const isMaster = docMeta.documentType === 'MASTER_CV' || !!docMeta.isMaster;
    if (isMaster) {
      await this.db
        .update(candidateDocuments)
        .set({ isMaster: false, updatedAt: new Date() })
        .where(eq(candidateDocuments.userId, userId));
    }

    const [row] = await this.db
      .insert(candidateDocuments)
      .values({
        userId,
        documentType: docMeta.documentType,
        displayName: docMeta.displayName?.trim() || storageResult.originalFilename,
        originalFilename: storageResult.originalFilename,
        mimeType: storageResult.mimeType,
        sizeBytes: storageResult.sizeBytes,
        storageKey: storageResult.storageKey,
        sha256Checksum: storageResult.sha256Checksum,
        roleFocus: docMeta.roleFocus?.trim() || null,
        version: docMeta.version?.trim() || '1.0',
        isActive: true,
        isMaster,
      })
      .returning();

    await this.recordAudit({
      userId,
      entityType: 'DOCUMENT',
      entityId: row!.id,
      action: 'UPLOAD',
      changedFields: ['file', 'documentType', 'displayName', 'roleFocus', 'version', 'isMaster'],
      metadata: {
        documentType: row!.documentType,
        sizeBytes: row!.sizeBytes,
      },
    });

    return {
      ...row!,
      documentType: row!.documentType as any,
      createdAt: row!.createdAt.toISOString(),
      updatedAt: row!.updatedAt.toISOString(),
    };
  }

  public async getDocumentById(
    userId: string,
    id: string,
  ): Promise<{ doc: CandidateDocumentDto; buffer: Buffer }> {
    const doc = await this.db.query.candidateDocuments.findFirst({
      where: and(eq(candidateDocuments.id, id), eq(candidateDocuments.userId, userId)),
    });
    if (!doc) throw AppError.notFound(`Document ${id} not found`);

    const { buffer } = await this.storage.getFile(doc.storageKey);

    return {
      doc: {
        ...doc,
        documentType: doc.documentType as any,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      },
      buffer,
    };
  }

  public async deleteDocument(userId: string, id: string): Promise<void> {
    const doc = await this.db.query.candidateDocuments.findFirst({
      where: and(eq(candidateDocuments.id, id), eq(candidateDocuments.userId, userId)),
    });
    if (!doc) throw AppError.notFound(`Document ${id} not found`);

    await this.storage.deleteFile(doc.storageKey);
    await this.db.delete(candidateDocuments).where(eq(candidateDocuments.id, id));

    await this.recordAudit({
      userId,
      entityType: 'DOCUMENT',
      entityId: id,
      action: 'DELETE',
      changedFields: [],
      metadata: null,
    });
  }

  // --- Answer Library ---
  public async getAnswers(userId: string): Promise<AnswerLibraryEntryDto[]> {
    const rows = await this.db.query.answerLibrary.findMany({
      where: eq(answerLibrary.userId, userId),
      orderBy: [answerLibrary.category, answerLibrary.question],
    });
    return rows.map((r) => ({
      ...r,
      automationLevel: r.automationLevel as any,
      verificationStatus: r.verificationStatus as any,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  public async createAnswer(
    userId: string,
    data: {
      question: string;
      category?: string;
      answer: string;
      notes?: string | null;
      automationLevel?: string;
      verificationStatus?: string;
      isSensitive?: boolean;
      conditions?: unknown;
    },
  ): Promise<AnswerLibraryEntryDto> {
    const isSensitive = data.isSensitive ?? false;
    const automationLevel = data.automationLevel ?? 'REVIEW';
    const verificationStatus = data.verificationStatus ?? 'UNVERIFIED';

    if (isSensitive && automationLevel === 'AUTO' && verificationStatus !== 'VERIFIED') {
      throw AppError.badRequest(
        'Sensitive answers cannot have AUTO automation level unless explicitly VERIFIED',
      );
    }

    const [row] = await this.db
      .insert(answerLibrary)
      .values({
        userId,
        question: data.question.trim(),
        category: data.category?.trim() || 'GENERAL',
        answer: data.answer.trim(),
        notes: data.notes?.trim() || null,
        automationLevel,
        verificationStatus,
        isSensitive,
        conditions: data.conditions ?? null,
      })
      .returning();

    await this.recordAudit({
      userId,
      entityType: 'ANSWER',
      entityId: row!.id,
      action: 'CREATE',
      changedFields: Object.keys(data),
      metadata: {
        category: row!.category,
        automationLevel: row!.automationLevel,
        isSensitive: row!.isSensitive,
      },
    });

    return {
      ...row!,
      automationLevel: row!.automationLevel as any,
      verificationStatus: row!.verificationStatus as any,
      createdAt: row!.createdAt.toISOString(),
      updatedAt: row!.updatedAt.toISOString(),
    };
  }

  public async updateAnswer(
    userId: string,
    id: string,
    data: Partial<{
      question: string;
      category: string;
      answer: string;
      notes: string | null;
      automationLevel: string;
      verificationStatus: string;
      isSensitive: boolean;
      conditions: unknown;
    }>,
  ): Promise<AnswerLibraryEntryDto> {
    const existing = await this.db.query.answerLibrary.findFirst({
      where: and(eq(answerLibrary.id, id), eq(answerLibrary.userId, userId)),
    });
    if (!existing) throw AppError.notFound(`Answer entry ${id} not found`);

    const effectiveSensitive = data.isSensitive ?? existing.isSensitive;
    const effectiveLevel = data.automationLevel ?? existing.automationLevel;
    const effectiveStatus = data.verificationStatus ?? existing.verificationStatus;

    if (effectiveSensitive && effectiveLevel === 'AUTO' && effectiveStatus !== 'VERIFIED') {
      throw AppError.badRequest(
        'Sensitive answers cannot have AUTO automation level unless explicitly VERIFIED',
      );
    }

    const [row] = await this.db
      .update(answerLibrary)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(answerLibrary.id, id), eq(answerLibrary.userId, userId)))
      .returning();

    await this.recordAudit({
      userId,
      entityType: 'ANSWER',
      entityId: id,
      action: 'UPDATE',
      changedFields: Object.keys(data),
      metadata: {
        category: row!.category,
        automationLevel: row!.automationLevel,
        isSensitive: row!.isSensitive,
      },
    });

    return {
      ...row!,
      automationLevel: row!.automationLevel as any,
      verificationStatus: row!.verificationStatus as any,
      createdAt: row!.createdAt.toISOString(),
      updatedAt: row!.updatedAt.toISOString(),
    };
  }

  public async deleteAnswer(userId: string, id: string): Promise<void> {
    const [row] = await this.db
      .delete(answerLibrary)
      .where(and(eq(answerLibrary.id, id), eq(answerLibrary.userId, userId)))
      .returning();
    if (!row) throw AppError.notFound(`Answer entry ${id} not found`);

    await this.recordAudit({
      userId,
      entityType: 'ANSWER',
      entityId: id,
      action: 'DELETE',
      changedFields: [],
      metadata: null,
    });
  }

  // --- Job Preferences ---
  public async getPreferences(userId: string): Promise<JobPreferencesDto | null> {
    const row = await this.db.query.jobPreferences.findFirst({
      where: eq(jobPreferences.userId, userId),
    });
    if (!row) return null;
    return this.mapPreferencesToDto(row);
  }

  public async upsertPreferences(
    userId: string,
    data: {
      targetTitles?: string[];
      targetCategories?: string[];
      preferredLocations?: string[];
      workModes?: string[];
      employmentTypes?: string[];
      seniorityLevels?: string[];
      minSalary?: number | null;
      maxSalary?: number | null;
      currency?: string;
      preferredLanguages?: string[];
      excludedCompanies?: string[];
      excludedKeywords?: string[];
      acceptUnpaid?: boolean;
      willingToRelocate?: boolean | null;
      needsSponsorship?: boolean | null;
      customPreferences?: unknown;
    },
  ): Promise<JobPreferencesDto> {
    const existing = await this.getPreferences(userId);
    let result: JobPreferencesDto;

    if (existing) {
      const [updated] = await this.db
        .update(jobPreferences)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(jobPreferences.userId, userId))
        .returning();
      result = this.mapPreferencesToDto(updated!);
    } else {
      const [created] = await this.db
        .insert(jobPreferences)
        .values({
          userId,
          targetTitles: data.targetTitles ?? [],
          targetCategories: data.targetCategories ?? [],
          preferredLocations: data.preferredLocations ?? [],
          workModes: data.workModes ?? [],
          employmentTypes: data.employmentTypes ?? [],
          seniorityLevels: data.seniorityLevels ?? [],
          minSalary: data.minSalary ?? null,
          maxSalary: data.maxSalary ?? null,
          currency: data.currency ?? 'USD',
          preferredLanguages: data.preferredLanguages ?? [],
          excludedCompanies: data.excludedCompanies ?? [],
          excludedKeywords: data.excludedKeywords ?? [],
          acceptUnpaid: data.acceptUnpaid ?? false,
          willingToRelocate: data.willingToRelocate ?? null,
          needsSponsorship: data.needsSponsorship ?? null,
          customPreferences: data.customPreferences ?? null,
        })
        .returning();
      result = this.mapPreferencesToDto(created!);
    }

    await this.recordAudit({
      userId,
      entityType: 'PREFERENCES',
      entityId: result.id,
      action: existing ? 'UPDATE' : 'CREATE',
      changedFields: Object.keys(data),
      metadata: null,
    });

    return result;
  }

  // --- Application Policy ---
  public async getPolicy(userId: string): Promise<ApplicationPolicyDto> {
    let row = await this.db.query.applicationPolicy.findFirst({
      where: eq(applicationPolicy.userId, userId),
    });

    if (!row) {
      // Create with conservative defaults
      const [created] = await this.db
        .insert(applicationPolicy)
        .values({
          userId,
          autoApplyEnabled: false,
          minScoreForReview: 70,
          autoApplyMinScore: 90,
          maxApplicationsPerDay: 5,
          blockOnUnresolvedReview: true,
          blockOnManual: true,
          blockOnUnknownSensitive: true,
        })
        .returning();
      row = created!;
    }

    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  public async updatePolicy(
    userId: string,
    data: Partial<{
      autoApplyEnabled: boolean;
      minScoreForReview: number;
      autoApplyMinScore: number;
      maxApplicationsPerDay: number;
      blockOnUnresolvedReview: boolean;
      blockOnManual: boolean;
      blockOnUnknownSensitive: boolean;
    }>,
  ): Promise<ApplicationPolicyDto> {
    // Ensure policy exists first
    await this.getPolicy(userId);

    const [updated] = await this.db
      .update(applicationPolicy)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(applicationPolicy.userId, userId))
      .returning();

    await this.recordAudit({
      userId,
      entityType: 'POLICY',
      entityId: updated!.id,
      action: 'UPDATE',
      changedFields: Object.keys(data),
      metadata: null,
    });

    return {
      ...updated!,
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
    };
  }

  // --- Overview & Completeness ---
  public async getOverview(userId: string): Promise<CandidateOverviewDto> {
    const [
      profile,
      experiences,
      education,
      skills,
      languages,
      documents,
      preferences,
      facts,
      answers,
    ] = await Promise.all([
      this.getProfile(userId),
      this.getExperiences(userId),
      this.getEducation(userId),
      this.getSkills(userId),
      this.getLanguages(userId),
      this.getDocuments(userId),
      this.getPreferences(userId),
      this.getFacts(userId),
      this.getAnswers(userId),
    ]);

    const completeness = calculateProfileCompleteness({
      profile,
      experiences,
      education,
      skills,
      languages,
      documents,
      preferences,
    });

    const hasActiveMasterCv = documents.some(
      (d) => d.documentType === 'MASTER_CV' && d.isActive && d.isMaster,
    );
    const roleCvCount = documents.filter((d) => d.documentType === 'ROLE_CV').length;
    const verifiedFactCount = facts.filter((f) => f.verificationStatus === 'VERIFIED').length;

    return {
      profile,
      experienceCount: experiences.length,
      educationCount: education.length,
      skillCount: skills.length,
      languageCount: languages.length,
      factCount: facts.length,
      verifiedFactCount,
      answerCount: answers.length,
      documentCount: documents.length,
      hasActiveMasterCv,
      roleCvCount,
      completeness,
    };
  }

  public async getAuditEvents(userId: string, limit = 50): Promise<CandidateAuditEventDto[]> {
    const rows = await this.db.query.candidateAuditEvents.findMany({
      where: eq(candidateAuditEvents.userId, userId),
      orderBy: [desc(candidateAuditEvents.createdAt)],
      limit,
    });
    return rows.map((r) => ({
      ...r,
      changedFields: (r.changedFields as string[]) ?? [],
      metadata: (r.metadata as Record<string, unknown> | null) ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
