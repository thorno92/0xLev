/**
 * Favorite tokens hook with localStorage persistence.
 * Stores a Set of token addresses that the user has starred.
 */

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = '0xleverage-favorites';

function loadFavorites(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {
    // Corrupted data -- reset
  }
  return new Set();
}

function saveFavorites(favorites: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(favorites)));
  } catch {
    // Storage full or unavailable -- silently fail
  }
}

// Shared state across all hook instances
let globalFavorites = loadFavorites();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function useFavorites() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const isFavorite = useCallback((address: string) => {
    return globalFavorites.has(address);
  }, []);

  const toggleFavorite = useCallback((address: string) => {
    if (globalFavorites.has(address)) {
      globalFavorites.delete(address);
    } else {
      globalFavorites.add(address);
    }
    saveFavorites(globalFavorites);
    notify();
  }, []);

  const favoriteAddresses = globalFavorites;

  return { isFavorite, toggleFavorite, favoriteAddresses };
}
