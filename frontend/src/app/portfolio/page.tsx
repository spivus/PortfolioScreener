"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/api";
import RequireAuth from "@/components/RequireAuth";
import UploadZone from "@/components/UploadZone";

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

  async function loadPortfolios() {
    const res = await authFetch("/portfolios");
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Fehler beim Laden");
    }
    return res.json();
  }

  useEffect(() => {
    loadPortfolios()
      .then(setPortfolios)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Fehler beim Laden")
      )
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Portfolio wirklich loeschen?")) return;
    await authFetch(`/portfolio/${id}`, { method: "DELETE" });
    setPortfolios((prev) => prev.filter((p) => p.id !== id));
  }

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
    <RequireAuth>
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold text-white">Meine Portfolios</h1>

      {/* Upload */}
      <div className="mb-8 opacity-0 animate-slide-up stagger-1">
        <UploadZone />
      </div>

      {/* Portfolio-Liste */}
      {portfolios.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-surface-border p-12 text-center">
          <p className="text-text-muted">
            Noch keine Portfolios vorhanden. Laden Sie oben ein Portfolio hoch.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {portfolios.map((p) => (
            <div
              key={p.id}
              className="group relative rounded-xl border border-surface-border bg-surface-card p-6 transition-colors hover:border-primary/30 hover:bg-surface-hover"
            >
              <a href={`/portfolio/${p.id}`} className="block">
                <h2 className="text-lg font-semibold text-text-primary group-hover:text-primary-light">
                  {p.kunde_name}
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  {new Date(p.erstellt_am).toLocaleDateString("de-DE")}
                </p>
              </a>
              <button
                onClick={(e) => handleDelete(e, p.id)}
                className="absolute right-4 top-4 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-accent-rose/10 hover:text-accent-rose"
              >
                Loeschen
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
    </RequireAuth>
  );
}
