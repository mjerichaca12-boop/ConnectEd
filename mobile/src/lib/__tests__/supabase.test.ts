import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isConnectionLostError, resilientFetch } from '../supabase';

describe('supabase network resilience', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('isConnectionLostError', () => {
    it('should identify UnexpectedException: The network connection was lost', () => {
      const err = new Error('UnexpectedException: The network connection was lost. (at ExpoModulesCore/Promise.swift:56)');
      expect(isConnectionLostError(err)).toBe(true);
    });

    it('should identify standard network connection lost error strings', () => {
      expect(isConnectionLostError('the network connection was lost')).toBe(true);
      expect(isConnectionLostError(new Error('Network request failed'))).toBe(true);
      expect(isConnectionLostError(new Error('failed to fetch'))).toBe(true);
      expect(isConnectionLostError(new Error('ECONNRESET'))).toBe(true);
    });

    it('should return false for unrelated errors', () => {
      expect(isConnectionLostError(new Error('SyntaxError'))).toBe(false);
      expect(isConnectionLostError(new Error('User not found'))).toBe(false);
      expect(isConnectionLostError(null)).toBe(false);
      expect(isConnectionLostError(undefined)).toBe(false);
    });
  });

  describe('resilientFetch', () => {
    it('should return response on first attempt if successful', async () => {
      const mockResponse = new Response('ok', { status: 200 });
      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const res = await resilientFetch('https://example.com');
      expect(res).toBe(mockResponse);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry and succeed when encountering UnexpectedException: The network connection was lost', async () => {
      const lostError = new Error('UnexpectedException: The network connection was lost. (at ExpoModulesCore/Promise.swift:56)');
      const mockSuccess = new Response('ok', { status: 200 });

      global.fetch = vi.fn()
        .mockRejectedValueOnce(lostError)
        .mockResolvedValueOnce(mockSuccess);

      const res = await resilientFetch('https://example.com');
      expect(res).toBe(mockSuccess);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should re-throw if max retries are exceeded', async () => {
      const lostError = new Error('The network connection was lost');
      global.fetch = vi.fn().mockRejectedValue(lostError);

      await expect(resilientFetch('https://example.com')).rejects.toThrow('The network connection was lost');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-network errors', async () => {
      const appError = new Error('Invalid JSON payload');
      global.fetch = vi.fn().mockRejectedValueOnce(appError);

      await expect(resilientFetch('https://example.com')).rejects.toThrow('Invalid JSON payload');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
