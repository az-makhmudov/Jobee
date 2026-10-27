export type DiscoverySource = 'ARBEITNOW' | 'GREENHOUSE' | 'LEVER' | 'ASHBY' | 'SMARTRECRUITERS';
export interface SearchBoard {
  source: Exclude<DiscoverySource, 'ARBEITNOW'>;
  slug: string;
}
export interface JobSearchSettings {
  sources: DiscoverySource[];
  boards: SearchBoard[];
  selectedCvId: string | null;
  dailyDiscovery: boolean;
  dailyPreparation: boolean;
  dailyDigest: boolean;
  dailyLimit: number;
}
export const DEFAULT_SEARCH_SETTINGS: JobSearchSettings = {
  sources: ['ARBEITNOW', 'GREENHOUSE', 'LEVER', 'ASHBY', 'SMARTRECRUITERS'],
  boards: [
    { source: 'SMARTRECRUITERS', slug: 'BoschGroup' },
    { source: 'SMARTRECRUITERS', slug: 'NielsenIQ' },
    { source: 'GREENHOUSE', slug: 'canonical' },
    { source: 'GREENHOUSE', slug: 'gitlab' },
    { source: 'GREENHOUSE', slug: 'stripe' },
    { source: 'LEVER', slug: 'spotify' },
  ],
  selectedCvId: null,
  dailyDiscovery: false,
  dailyPreparation: false,
  dailyDigest: true,
  dailyLimit: 10,
};
export type PreparationStatus =
  'QUEUED' | 'PREPARING' | 'READY' | 'NEEDS_REVIEW' | 'FAILED' | 'CANCELLED';
export interface PreparationItemDto {
  id: string;
  jobId: string;
  title: string;
  company: string;
  status: PreparationStatus;
  packageId: string | null;
  applicationId: string | null;
  error: string | null;
  versionNumber: number | null;
  outstandingQuestions: number;
  method: 'AUTOMATIC_FORM' | 'MANUAL';
  methodNote: string;
  runStatus: string | null;
}
export interface PreparationBatchDto {
  id: string;
  createdAt: string;
  cancelledAt: string | null;
  items: PreparationItemDto[];
}
