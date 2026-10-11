import { createAuthClient } from 'better-auth/react';
import type {
  CreateInvitationRequest,
  PilotInvitationDto,
  VerifyInvitationResponse,
} from '@job-agent/shared';

// Create Better Auth React Client.
// When in browser, baseURL defaults to the current origin (which is proxied by Vite to Fastify API).
export const authClient = createAuthClient();

export const { useSession, signIn, signUp, signOut } = authClient;

// Helper to retrieve API base path (proxied through /api in Vite dev server)
const API_BASE = '/api';

/**
 * Verify an invitation code before registration
 */
export async function verifyPilotInvite(
  code: string,
  email?: string,
): Promise<VerifyInvitationResponse> {
  const params = new URLSearchParams({ code });
  if (email) params.append('email', email);

  const res = await fetch(`${API_BASE}/pilot/verify?${params.toString()}`);
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error?.message || 'Invalid or expired invitation code');
  }

  return json.data;
}

/**
 * Admin: Generate a new pilot invitation
 */
export async function createPilotInvite(req: CreateInvitationRequest): Promise<PilotInvitationDto> {
  const res = await fetch(`${API_BASE}/pilot/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error?.message || 'Failed to create invitation');
  }

  return json.data;
}

/**
 * Admin: List all pilot invitations
 */
export async function listPilotInvites(): Promise<PilotInvitationDto[]> {
  const res = await fetch(`${API_BASE}/pilot/invitations`);
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error?.message || 'Failed to list invitations');
  }

  return json.data;
}

/**
 * Admin: Revoke an invitation
 */
export async function revokePilotInvite(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/pilot/invitations/${id}/revoke`, {
    method: 'POST',
  });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error?.message || 'Failed to revoke invitation');
  }
}
