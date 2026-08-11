import React, { createContext, useContext, useRef, useState, useCallback } from "react";

const DataCacheContext = createContext(null);

export const DataCacheProvider = ({ children }) => {
  // In-memory cache store: Map<key, { data, timestamp }>
  const cacheRef = useRef(new Map());
  const [version, setVersion] = useState(0);

  const getCachedData = useCallback((key, maxAgeMs = 300000) => {
    if (!key) return null;
    const entry = cacheRef.current.get(key);
    if (!entry) return null;
    const isStale = Date.now() - entry.timestamp > maxAgeMs;
    return { data: entry.data, isStale, timestamp: entry.timestamp };
  }, []);

  const setCachedData = useCallback((key, data) => {
    if (!key) return;
    cacheRef.current.set(key, { data, timestamp: Date.now() });
    setVersion((v) => v + 1);
  }, []);

  const invalidateCache = useCallback((keyOrPattern) => {
    if (!keyOrPattern) {
      cacheRef.current.clear();
      setVersion((v) => v + 1);
      return;
    }

    if (cacheRef.current.has(keyOrPattern)) {
      cacheRef.current.delete(keyOrPattern);
    } else {
      for (const k of cacheRef.current.keys()) {
        if (k.includes(keyOrPattern)) {
          cacheRef.current.delete(k);
        }
      }
    }
    setVersion((v) => v + 1);
  }, []);

  return (
    <DataCacheContext.Provider
      value={{
        getCachedData,
        setCachedData,
        invalidateCache,
        cacheVersion: version,
      }}
    >
      {children}
    </DataCacheContext.Provider>
  );
};

export const useDataCache = () => {
  const context = useContext(DataCacheContext);
  if (!context) {
    return {
      getCachedData: () => null,
      setCachedData: () => {},
      invalidateCache: () => {},
      cacheVersion: 0,
    };
  }
  return context;
};
