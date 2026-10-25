export const PilotInvitationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
} as const;

export type PilotInvitationStatusType =
  (typeof PilotInvitationStatus)[keyof typeof PilotInvitationStatus];

export interface UserDto {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role: 'admin' | 'tester' | 'user';
  createdAt: string;
}

export interface SessionDto {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
}

export interface PilotInvitationDto {
  id: string;
  code: string;
  inviterUserId: string;
  invitedEmail: string | null;
  role: string;
  status: PilotInvitationStatusType;
  acceptedByUserId: string | null;
  acceptedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface CreateInvitationRequest {
  invitedEmail?: string;
  role?: 'user' | 'tester' | 'admin';
  expiresInDays?: number;
}

export interface VerifyInvitationResponse {
  valid: boolean;
  invitedEmail?: string | null;
  role?: string;
  expiresAt?: string;
}
