import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { fetchWatchlist, addWatchlistItem, removeWatchlistItem, setWatchlistItemAlerts } from "./api";
import type { WatchlistItem } from "../types";

interface WatchlistContextValue {
  items: WatchlistItem[];
  codes: Set<string>;
  loading: boolean;
  refresh: () => void;
  add: (code: string) => Promise<void>;
  remove: (code: string) => Promise<void>;
  setAlerts: (code: string, enabled: boolean) => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchWatchlist()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const add = useCallback(async (code: string) => {
    const item = await addWatchlistItem(code);
    setItems((prev) => (prev.some((i) => i.code === item.code) ? prev : [item, ...prev]));
  }, []);

  const remove = useCallback(async (code: string) => {
    await removeWatchlistItem(code);
    setItems((prev) => prev.filter((i) => i.code !== code));
  }, []);

  const setAlerts = useCallback(async (code: string, enabled: boolean) => {
    const updated = await setWatchlistItemAlerts(code, enabled);
    setItems((prev) => prev.map((i) => (i.code === code ? updated : i)));
  }, []);

  const codes = useMemo(() => new Set(items.map((i) => i.code)), [items]);

  return (
    <WatchlistContext.Provider value={{ items, codes, loading, refresh, add, remove, setAlerts }}>
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error("useWatchlist must be used within WatchlistProvider");
  return ctx;
}
