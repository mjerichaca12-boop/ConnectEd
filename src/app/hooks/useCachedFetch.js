import { useState, useEffect, useCallback } from "react";
import { useDataCache } from "../context/DataCacheContext";

/**
 * Custom hook for Stale-While-Revalidate data fetching with instant cache rendering
 * @param {string} cacheKey - Unique key for caching data in memory
 * @param {Function} fetchFn - Async function returning fresh data from Supabase
 * @param {Object} options - { initialData: null, ttlMs: 300000, deps: [] }
 */
export function useCachedFetch(cacheKey, fetchFn, options = {}) {
  const { initialData = null, ttlMs = 300000, deps = [] } = options;
  const { getCachedData, setCachedData, invalidateCache, cacheVersion } = useDataCache();

  const cachedEntry = getCachedData(cacheKey, ttlMs);
  const [data, setData] = useState(cachedEntry?.data !== undefined ? cachedEntry.data : initialData);
  const [loading, setLoading] = useState(cachedEntry?.data === undefined);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [error, setError] = useState(null);

  const executeFetch = useCallback(async (isBackground = false) => {
    if (!fetchFn || !cacheKey) return;

    if (!isBackground && cachedEntry?.data === undefined) {
      setLoading(true);
    } else {
      setIsRevalidating(true);
    }

    try {
      const freshData = await fetchFn();
      if (freshData !== undefined && freshData !== null) {
        setData(freshData);
        setCachedData(cacheKey, freshData);
      }
      setError(null);
    } catch (err) {
      console.error(`[useCachedFetch] Error fetching ${cacheKey}:`, err);
      setError(err);
    } finally {
      setLoading(false);
      setIsRevalidating(false);
    }
  }, [cacheKey, fetchFn, setCachedData]);

  useEffect(() => {
    if (!cacheKey) return;
    const entry = getCachedData(cacheKey, ttlMs);
    if (entry?.data !== undefined && entry?.data !== null) {
      setData(entry.data);
      setLoading(false);
      if (entry.isStale) {
        executeFetch(true);
      }
    } else {
      executeFetch(false);
    }
  }, [cacheKey, cacheVersion, ...deps]);

  const mutate = useCallback((updater) => {
    setData((prev) => {
      const nextData = typeof updater === "function" ? updater(prev) : updater;
      if (cacheKey) {
        setCachedData(cacheKey, nextData);
      }
      return nextData;
    });
  }, [cacheKey, setCachedData]);

  const refetch = useCallback(() => executeFetch(data !== null), [executeFetch, data]);
  const invalidate = useCallback(() => invalidateCache(cacheKey), [cacheKey, invalidateCache]);

  return {
    data,
    loading,
    isRevalidating,
    error,
    mutate,
    refetch,
    invalidate,
  };
}
