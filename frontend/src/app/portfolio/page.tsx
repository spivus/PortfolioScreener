"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/api";
import Link from "next/link";

interface PortfolioSummary {
  id: string;
  kunde_name: string;
  erstellt_am: string;
  positionen_count?: number;
}

export default function PortfolioListPage() {
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await authFetch("/portfolios");
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Fehler beim Laden");
        }
        setPortfolios(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">Portfolios werden geladen...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold text-white">Meine Portfolios</h1>

      {portfolios.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-white/10 p-12 text-center">
          <p className="text-gray-400">
            Noch keine Portfolios vorhanden. Laden Sie ein Portfolio auf der
            Startseite hoch.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/80"
          >
            Portfolio hochladen
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {portfolios.map((p) => (
            <Link
              key={p.id}
              href={`/portfolio/${p.id}`}
              className="group rounded-xl border border-white/10 bg-surface-card p-6 transition-colors hover:border-primary/30 hover:bg-surface-hover"
            >
              <h2 className="text-lg font-semibold text-white group-hover:text-primary-light">
                {p.kunde_name}
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                {new Date(p.erstellt_am).toLocaleDateString("de-DE")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
