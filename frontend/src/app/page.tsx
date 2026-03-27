"use client";

import { useEffect, useState, useCallback } from "react";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import UploadZone from "@/components/UploadZone";
import Link from "next/link";

interface MusterPosition {
  id?: string;
  name: string;
  isin: string | null;
  zielgewicht_prozent: number;
  branche: string | null;
  region: string | null;
}

interface Musterportfolio {
  id: string;
  name: string;
  beschreibung: string | null;
  positionen: MusterPosition[];
}

const EMPTY_POSITION: MusterPosition = {
  name: "",
  isin: null,
  zielgewicht_prozent: 0,
  branche: null,
  region: null,
};

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [mp, setMp] = useState<Musterportfolio | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MusterPosition[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMusterportfolio = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await authFetch("/musterportfolio");
      if (res.ok) {
        const data = await res.json();
        setMp(data);
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadMusterportfolio();
  }, [loadMusterportfolio]);

  function startEdit() {
    setDraft(mp?.positionen.map((p) => ({ ...p })) || []);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft([]);
  }

  function addRow() {
    setDraft([...draft, { ...EMPTY_POSITION }]);
  }

  function removeRow(index: number) {
    setDraft(draft.filter((_, i) => i !== index));
  }

  function updateRow(index: number, field: string, value: string | number | null) {
    setDraft(
      draft.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await authFetch("/musterportfolio", {
        method: "PUT",
        body: JSON.stringify({ positionen: draft }),
      });
      if (res.ok) {
        const data = await res.json();
        setMp(data);
        setEditing(false);
      } else {
        setSaveError("Speichern fehlgeschlagen. Bitte erneut versuchen.");
      }
    } finally {
      setSaving(false);
    }
  }

  const totalWeight = editing
    ? draft.reduce((s, p) => s + (p.zielgewicht_prozent || 0), 0)
    : (mp?.positionen.reduce((s, p) => s + p.zielgewicht_prozent, 0) || 0);

  // Unauthenticated view
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-6">
        <div className="max-w-lg text-center opacity-0 animate-slide-up">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <svg
              className="h-7 w-7 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
              />
            </svg>
          </div>
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-text-primary">
            Portfolio Analyzer
          </h1>
          <p className="mb-8 text-text-muted text-balance">
            Intelligente Portfolioanalyse fuer Finanzberater.
            Positionen vergleichen, Strukturen analysieren, Marktdaten abrufen.
          </p>
          <Link href="/login" className="btn-primary px-6 py-3 text-base">
            Anmelden
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-text-muted">Wird geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Musterportfolio Section */}
      <div className="mb-10 opacity-0 animate-fade-in">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="section-heading text-2xl">
              {mp?.name || "Musterportfolio"}
            </h1>
            {mp?.beschreibung && (
              <p className="mt-3 text-sm text-text-muted">{mp.beschreibung}</p>
            )}
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={cancelEdit} className="btn-ghost text-[13px]">
                  Abbrechen
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary text-[13px]"
                >
                  {saving ? "Speichert..." : "Speichern"}
                </button>
              </>
            ) : (
              <button onClick={startEdit} className="btn-primary text-[13px]">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
                Bearbeiten
              </button>
            )}
          </div>
        </div>

        {saveError && (
          <div className="mb-4 rounded-lg bg-accent-rose/10 px-3 py-2 text-sm text-accent-rose">
            {saveError}
          </div>
        )}

        {/* Weight indicator */}
        <div className="mb-4">
          <span
            className={
              totalWeight === 100 ? "stat-pill-green" : "stat-pill-amber"
            }
          >
            Gesamtgewichtung: {totalWeight.toFixed(1)}%
          </span>
          {totalWeight !== 100 && (
            <span className="ml-2 text-xs text-text-muted">(Soll: 100%)</span>
          )}
        </div>

        <div className="glass-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>ISIN</th>
                <th className="text-right">Zielgewicht (%)</th>
                <th>Branche</th>
                <th>Region</th>
                {editing && <th className="w-12"></th>}
              </tr>
            </thead>
            <tbody>
              {editing ? (
                <>
                  {draft.map((pos, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          value={pos.name}
                          onChange={(e) => updateRow(i, "name", e.target.value)}
                          className="w-full rounded-lg border border-surface-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                          placeholder="Name"
                        />
                      </td>
                      <td>
                        <input
                          value={pos.isin || ""}
                          onChange={(e) => updateRow(i, "isin", e.target.value || null)}
                          className="w-full rounded-lg border border-surface-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                          placeholder="Optional"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          value={pos.zielgewicht_prozent}
                          onChange={(e) => updateRow(i, "zielgewicht_prozent", parseFloat(e.target.value) || 0)}
                          className="w-24 rounded-lg border border-surface-border bg-surface-raised px-2.5 py-1.5 text-right text-sm text-text-primary focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                        />
                      </td>
                      <td>
                        <input
                          value={pos.branche || ""}
                          onChange={(e) => updateRow(i, "branche", e.target.value || null)}
                          className="w-full rounded-lg border border-surface-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                          placeholder="Optional"
                        />
                      </td>
                      <td>
                        <input
                          value={pos.region || ""}
                          onChange={(e) => updateRow(i, "region", e.target.value || null)}
                          className="w-full rounded-lg border border-surface-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                          placeholder="Optional"
                        />
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => removeRow(i)}
                          className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-accent-rose/10 hover:text-accent-rose"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={6}>
                      <button
                        onClick={addRow}
                        className="inline-flex items-center gap-1.5 text-sm text-primary transition-colors hover:text-primary-light"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Position hinzufuegen
                      </button>
                    </td>
                  </tr>
                </>
              ) : mp?.positionen.length ? (
                mp.positionen.map((pos, i) => (
                  <tr key={pos.id || i}>
                    <td className="font-medium text-text-primary">{pos.name}</td>
                    <td className="font-mono text-text-muted">{pos.isin || "--"}</td>
                    <td className="text-right font-mono text-text-secondary">
                      {pos.zielgewicht_prozent.toFixed(1)}%
                    </td>
                    <td className="text-text-muted">{pos.branche || "--"}</td>
                    <td className="text-text-muted">{pos.region || "--"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-text-muted">
                    Noch keine Positionen. Klicke &quot;Bearbeiten&quot; um Positionen hinzuzufuegen.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Section */}
      <div className="opacity-0 animate-slide-up stagger-2">
        <h2 className="section-heading mb-5 text-xl">Portfolio hochladen</h2>
        <UploadZone />
      </div>
    </div>
  );
}
