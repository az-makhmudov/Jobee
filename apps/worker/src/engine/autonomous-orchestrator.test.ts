import { describe, it, expect, vi } from 'vitest';
import { AutonomousOrchestrator } from './autonomous-orchestrator.js';

describe('AutonomousOrchestrator Unit Tests', () => {
  describe('Exponential Backoff Calculation', () => {
    it('calculates deterministic exponential backoff with bounded jitter', () => {
      const delay0 = AutonomousOrchestrator.calculateBackoff(0, 1000, 30000);
      expect(delay0).toBeGreaterThanOrEqual(1000);
      expect(delay0).toBeLessThanOrEqual(1200);

      const delay1 = AutonomousOrchestrator.calculateBackoff(1, 1000, 30000);
      expect(delay1).toBeGreaterThanOrEqual(2000);
      expect(delay1).toBeLessThanOrEqual(2400);

      const delay2 = AutonomousOrchestrator.calculateBackoff(2, 1000, 30000);
      expect(delay2).toBeGreaterThanOrEqual(4000);
      expect(delay2).toBeLessThanOrEqual(4800);

      const maxDelay = AutonomousOrchestrator.calculateBackoff(10, 1000, 10000);
      expect(maxDelay).toBeGreaterThanOrEqual(10000);
      expect(maxDelay).toBeLessThanOrEqual(12000);
    });
  });

  describe('Policy Invariant: Auto-Apply Circuit Breaker', () => {
    it('strictly skips auto-apply when autoApplyEnabled is false', async () => {
      const mockDb: any = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'test-run-123' }]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        query: {
          jobs: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          jobPreferences: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
          applicationPolicy: {
            findFirst: vi.fn().mockResolvedValue({
              autoApplyEnabled: false,
              maxApplicationsPerDay: 5,
            }),
          },
          applications: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          approvalRequests: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          applicationInterviews: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
      };

      const orchestrator = new AutonomousOrchestrator(mockDb);
      const runId = await orchestrator.executeRun('user-uuid-1', 'AUTO_APPLY', 'MANUAL');

      expect(runId).toBe('test-run-123');
      // Verifies that no browser runs were queued
      expect(mockDb.insert).toHaveBeenCalledTimes(1); // Only for the orchestration run itself
    });
  });

  describe('Policy Invariant: Daily Rate Limit Quota', () => {
    it('does not queue submissions from a legacy enabled flag', async () => {
      const mockDb: any = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'test-run-456' }]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 5 }]), // 5 already submitted today
          }),
        }),
        query: {
          applicationPolicy: {
            findFirst: vi.fn().mockResolvedValue({
              autoApplyEnabled: true,
              maxApplicationsPerDay: 5, // Limit is 5
            }),
          },
          notificationPreferences: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
          applications: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          approvalRequests: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
      };

      const orchestrator = new AutonomousOrchestrator(mockDb);
      const runId = await orchestrator.executeRun('user-uuid-1', 'AUTO_APPLY', 'MANUAL');

      expect(runId).toBe('test-run-456');
      // Dispatches RATE_LIMIT_EXCEEDED notification, but queues 0 browser runs
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });
  });
});
