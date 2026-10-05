import { describe, it, expect } from 'vitest';
import { HttpRetrievalService, isPrivateOrRestrictedIp } from './http-retrieval-service.js';

describe('HttpRetrievalService (SSRF and Safe Web Fetching)', () => {
  const service = new HttpRetrievalService();

  describe('isPrivateOrRestrictedIp unit tests', () => {
    it('identifies loopback addresses', () => {
      expect(isPrivateOrRestrictedIp('127.0.0.1')).toBe(true);
      expect(isPrivateOrRestrictedIp('127.0.0.2')).toBe(true);
      expect(isPrivateOrRestrictedIp('::1')).toBe(true);
    });

    it('identifies RFC1918 private IPv4 addresses', () => {
      expect(isPrivateOrRestrictedIp('10.0.0.1')).toBe(true);
      expect(isPrivateOrRestrictedIp('10.255.255.255')).toBe(true);
      expect(isPrivateOrRestrictedIp('172.16.0.1')).toBe(true);
      expect(isPrivateOrRestrictedIp('172.31.255.255')).toBe(true);
      expect(isPrivateOrRestrictedIp('192.168.0.1')).toBe(true);
      expect(isPrivateOrRestrictedIp('192.168.1.100')).toBe(true);
    });

    it('identifies link-local and cloud metadata addresses', () => {
      expect(isPrivateOrRestrictedIp('169.254.169.254')).toBe(true);
      expect(isPrivateOrRestrictedIp('169.254.1.1')).toBe(true);
    });

    it('identifies IPv6 private and local addresses', () => {
      expect(isPrivateOrRestrictedIp('fc00::1')).toBe(true);
      expect(isPrivateOrRestrictedIp('fd12:3456:789a::1')).toBe(true);
      expect(isPrivateOrRestrictedIp('fe80::1')).toBe(true);
    });

    it('allows valid public routable IP addresses', () => {
      expect(isPrivateOrRestrictedIp('8.8.8.8')).toBe(false);
      expect(isPrivateOrRestrictedIp('1.1.1.1')).toBe(false);
      expect(isPrivateOrRestrictedIp('140.82.121.4')).toBe(false); // GitHub
    });
  });

  describe('SSRF Protection - URL and Host Security Validation', () => {
    it('blocks localhost and loopback IPv4', async () => {
      await expect(service.fetchPublicPage('http://localhost:8080/job')).rejects.toThrow(
        /Access to internal hostnames or metadata endpoints is prohibited/,
      );
      await expect(service.fetchPublicPage('http://127.0.0.1:3000/job')).rejects.toThrow(
        /Access to internal, loopback, or private IP addresses is prohibited/,
      );
      await expect(service.fetchPublicPage('http://127.0.0.2/job')).rejects.toThrow(
        /Access to internal, loopback, or private IP addresses is prohibited/,
      );
    });

    it('blocks RFC1918 private IPv4 addresses', async () => {
      await expect(service.fetchPublicPage('http://10.0.0.1/job')).rejects.toThrow(
        /Access to internal, loopback, or private IP addresses is prohibited/,
      );
      await expect(service.fetchPublicPage('http://172.16.0.1/job')).rejects.toThrow(
        /Access to internal, loopback, or private IP addresses is prohibited/,
      );
      await expect(service.fetchPublicPage('http://192.168.1.1/job')).rejects.toThrow(
        /Access to internal, loopback, or private IP addresses is prohibited/,
      );
    });

    it('blocks Cloud metadata service IP (169.254.169.254)', async () => {
      await expect(
        service.fetchPublicPage('http://169.254.169.254/latest/meta-data/'),
      ).rejects.toThrow(/Access to internal, loopback, or private IP addresses is prohibited/);
      await expect(
        service.fetchPublicPage('http://metadata.google.internal/computeMetadata/v1/'),
      ).rejects.toThrow(/Access to internal hostnames or metadata endpoints is prohibited/);
    });

    it('blocks IPv6 loopback and private addresses', async () => {
      await expect(service.fetchPublicPage('http://[::1]/job')).rejects.toThrow(
        /Access to internal, loopback, or private IP addresses is prohibited/,
      );
      await expect(service.fetchPublicPage('http://[fe80::1]/job')).rejects.toThrow(
        /Access to internal, loopback, or private IP addresses is prohibited/,
      );
      await expect(service.fetchPublicPage('http://[fc00::1]/job')).rejects.toThrow(
        /Access to internal, loopback, or private IP addresses is prohibited/,
      );
    });

    it('blocks non-HTTP/HTTPS protocols', async () => {
      await expect(service.fetchPublicPage('file:///etc/passwd')).rejects.toThrow(
        /Only HTTP and HTTPS are permitted/,
      );
      await expect(service.fetchPublicPage('ftp://ftp.example.com/job')).rejects.toThrow(
        /Only HTTP and HTTPS are permitted/,
      );
      await expect(service.fetchPublicPage('javascript:alert(1)')).rejects.toThrow(
        /Only HTTP and HTTPS are permitted/,
      );
    });

    it('rejects invalid or malformed URLs', async () => {
      await expect(service.fetchPublicPage('not-a-valid-url')).rejects.toThrow(
        /Invalid URL format/,
      );
      await expect(service.fetchPublicPage('')).rejects.toThrow(/A valid URL must be provided/);
    });
  });
});
