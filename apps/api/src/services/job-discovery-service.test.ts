import { describe, it, expect, vi } from 'vitest';
import { JobDiscoveryService } from './job-discovery-service.js';

describe('JobDiscoveryService Unit Tests', () => {
  it('discovers and ingests opportunities from Arbeitnow matching candidate keywords', async () => {
    const mockDb: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                targetTitles: ['Project Manager'],
              },
            ]),
          }),
        }),
      }),
    };

    const mockJobService: any = {
      ingestText: vi.fn().mockResolvedValue({
        job: { id: 'job-1', title: 'Technical Project Manager' },
        isDuplicate: false,
      }),
      ingestUrl: vi.fn().mockResolvedValue({
        job: { id: 'job-2', title: 'Senior Project Manager' },
        isDuplicate: false,
      }),
    };

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('arbeitnow')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  title: 'Technical Project Manager',
                  company_name: 'Tech Innovations Corp',
                  description:
                    '<p>Seeking an experienced project manager to lead distributed teams.</p>',
                  url: 'https://example.com/job/pm-1',
                  location: 'Warsaw, Poland',
                  remote: true,
                  tags: ['project-management', 'agile'],
                },
                {
                  title: 'Frontend React Developer',
                  company_name: 'App Studios',
                  description: '<p>Senior React specialist needed.</p>',
                  url: 'https://example.com/job/react-1',
                  location: 'Berlin, Germany',
                  tags: ['react', 'frontend'],
                },
              ],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ jobs: [] }),
      });
    });

    const discoveryService = new JobDiscoveryService(mockDb, mockJobService, {
      fetchFn: mockFetch as any,
    });

    const summary = await discoveryService.discoverForCandidate('test-user-id', {
      sources: ['ARBEITNOW'],
    });

    expect(summary.totalDiscovered).toBe(2);
    expect(summary.newJobsIngested).toBe(1); // Only the Project Manager matched
    expect(mockJobService.ingestText).toHaveBeenCalledTimes(1);
    expect(mockJobService.ingestText).toHaveBeenCalledWith(
      'test-user-id',
      expect.objectContaining({
        title: 'Technical Project Manager',
        company: 'Tech Innovations Corp',
      }),
    );
  });

  it('handles duplicate jobs gracefully and tallies duplicate count', async () => {
    const mockDb: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                targetRoles: ['Engineering Lead'],
              },
            ]),
          }),
        }),
      }),
    };

    const mockJobService: any = {
      ingestText: vi.fn().mockResolvedValue({
        job: { id: 'job-dup', title: 'Engineering Lead' },
        isDuplicate: true,
      }),
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              title: 'Engineering Lead',
              company_name: 'ScaleUp Inc',
              description: '<p>Lead engineering projects.</p>',
              url: 'https://example.com/job/lead',
              tags: ['leadership'],
            },
          ],
        }),
    });

    const discoveryService = new JobDiscoveryService(mockDb, mockJobService, {
      fetchFn: mockFetch as any,
    });

    const summary = await discoveryService.discoverForCandidate('test-user-id', {
      sources: ['ARBEITNOW'],
    });

    expect(summary.newJobsIngested).toBe(0);
    expect(summary.duplicatesSkipped).toBe(1);
  });
});
