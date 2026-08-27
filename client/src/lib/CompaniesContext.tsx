import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Company } from "../types";

interface CompaniesContextValue {
  companies: Company[];
  loading: boolean;
  refresh: () => void;
}

const CompaniesContext = createContext<CompaniesContextValue | null>(null);

export function CompaniesProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/companies")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`status ${res.status}`))))
      .then((data: Company[]) => {
        if (!cancelled) setCompanies(data);
      })
      .catch((err) => console.error("Failed to load company directory:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return (
    <CompaniesContext.Provider value={{ companies, loading, refresh: () => setTick((t) => t + 1) }}>
      {children}
    </CompaniesContext.Provider>
  );
}

export function useCompanies() {
  const ctx = useContext(CompaniesContext);
  if (!ctx) throw new Error("useCompanies must be used within CompaniesProvider");
  return ctx;
}
