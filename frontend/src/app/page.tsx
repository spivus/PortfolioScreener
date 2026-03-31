"use client";

import { useEffect, useState, useCallback } from "react";
import { authFetch, uploadMusterportfolio } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ── Types ── */

interface MusterPosition {
  id?: string;
  name: string;
  isin: string | null;
  symbol: string | null;
  stueckzahl: number;
  kurs: number;
  aktueller_kurs: number | null;
  sma_200: number | null;
  abstand_sma_200: number | null;
  gewichtung: number;
  branche: string | null;
  region: string | null;
  land: string | null;
  typ: string | null;
  analysten_buy: number | null;
  analysten_hold: number | null;
  analysten_sell: number | null;
  marktdaten_aktualisiert_am: string | null;
  waehrung: string | null;
  kurswert_eur: number | null;
  perf_5d: number | null;
  perf_ytd: number | null;
}

interface Musterportfolio {
  id: string;
  name: string;
  beschreibung: string | null;
  positionen: MusterPosition[];
  gesamt_wert: number;
  gesamt_perf_5d: number;
  gesamt_perf_ytd: number;
}

interface AnalyseEntry {
  name: string;
  gewichtung: number;
}

/* ── Constants ── */

const DONUT_COLORS = [
  "#0EA5E9", "#10B981", "#F59E0B", "#F43F5E", "#8B5CF6",
  "#06B6D4", "#EC4899", "#14B8A6", "#F97316", "#A855F7",
  "#64748B", "#84CC16",
];

/* ── Helpers ── */

function PctCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-text-muted">--</span>;
  const positive = value >= 0;
  return (
    <span className={positive ? "stat-pill-green" : "stat-pill-red"}>
      {positive ? "+" : ""}{value.toLocaleString("de-DE", { minimumFractionDigits: 2 })}%
    </span>
  );
}

function AnalystenCell({ buy, hold, sell }: { buy: number | null; hold: number | null; sell: number | null }) {
  if (buy == null) return <span className="text-text-muted">--</span>;
  return (
    <span className="text-xs font-mono">
      <span className="text-accent-emerald">{buy}</span>
      {" / "}
      <span className="text-text-muted">{hold}</span>
      {" / "}
      <span className="text-accent-rose">{sell}</span>
    </span>
  );
}

function DonutCard({ title, data, delay }: { title: string; data: AnalyseEntry[]; delay: string }) {
  return (
    <div className={`glass-card p-5 opacity-0 animate-slide-up ${delay}`}>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">{title}</h3>
      <div className="flex items-center gap-4">
        <div className="w-[140px] shrink-0">
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={data} dataKey="gewichtung" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={2} strokeWidth={0}>
                {data.map((_, idx) => (
                  <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `${Number(value).toFixed(1)}%`}
                contentStyle={{ backgroundColor: "#0C1425", border: "1px solid rgba(148,163,184,0.1)", borderRadius: "10px", color: "#F1F5F9", fontSize: "12px", padding: "6px 10px" }}
                itemStyle={{ color: "#94A3B8" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-1.5 overflow-hidden">
          {data.slice(0, 6).map((entry, idx) => (
            <div key={entry.name} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
              <span className="truncate text-text-secondary">{entry.name}</span>
              <span className="ml-auto font-mono text-text-muted">{entry.gewichtung.toFixed(1)}%</span>
            </div>
          ))}
          {data.length > 6 && <span className="text-[11px] text-text-muted">+{data.length - 6} weitere</span>}
        </div>
      </div>
    </div>
  );
}

/* ── Page ── */

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [mp, setMp] = useState<Musterportfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadMusterportfolio = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await authFetch("/musterportfolio");
      if (res.ok) setMp(await res.json());
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadMusterportfolio();
  }, [loadMusterportfolio]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const data = await uploadMusterportfolio(file);
      setMp(data as unknown as Musterportfolio);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await authFetch("/musterportfolio/refresh-market-data", { method: "POST" });
      await loadMusterportfolio();
    } finally {
      setRefreshing(false);
    }
  }

  // Unauthenticated view
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-6">
        <div className="max-w-lg text-center opacity-0 animate-slide-up">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-text-primary">Portfolio Analyzer</h1>
          <p className="mb-8 text-text-muted text-balance">
            Intelligente Portfolioanalyse fuer Finanzberater.
            Positionen vergleichen, Strukturen analysieren, Marktdaten abrufen.
          </p>
          <Link href="/login" className="btn-primary px-6 py-3 text-base">Anmelden</Link>
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

  const positions = mp?.positionen || [];

  function positionValueEur(p: MusterPosition): number {
    return p.kurswert_eur || p.stueckzahl * (p.aktueller_kurs || p.kurs);
  }

  const totalValue = positions.reduce((s, p) => s + positionValueEur(p), 0);

  // Analyse-Daten berechnen
  function buildBreakdown(field: keyof MusterPosition): AnalyseEntry[] {
    const buckets: Record<string, number> = {};
    for (const p of positions) {
      const key = (p[field] as string) || "Unbekannt";
      const value = positionValueEur(p);
      buckets[key] = (buckets[key] || 0) + value;
    }
    return Object.entries(buckets)
      .sort((a, b) => b[1] - a[1])
      .map(([name, val]) => ({
        name,
        gewichtung: totalValue > 0 ? Math.round(val / totalValue * 1000) / 10 : 0,
      }));
  }

  const latestUpdate = positions
    .map((p) => p.marktdaten_aktualisiert_am)
    .filter(Boolean)
    .sort()
    .pop();

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between opacity-0 animate-fade-in">
        <div>
          <h1 className="section-heading text-2xl">{mp?.name || "Musterportfolio"}</h1>
          {mp?.beschreibung && <p className="mt-1 text-sm text-text-muted">{mp.beschreibung}</p>}
          <p className="mt-1 text-sm text-text-muted">
            {positions.length} Positionen
            {totalValue > 0 && ` \u00B7 ${totalValue.toLocaleString("de-DE", { maximumFractionDigits: 0 })} EUR`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Upload */}
          <label className={`btn-ghost text-[13px] cursor-pointer ${uploading ? "opacity-50" : ""}`}>
            <input type="file" className="hidden" accept=".xlsx,.xls,.csv,.pdf" onChange={handleFileUpload} disabled={uploading} />
            {uploading ? "Wird hochgeladen..." : "Excel hochladen"}
          </label>

          {/* Refresh */}
          <button onClick={handleRefresh} disabled={refreshing} className="btn-primary text-[13px]">
            {refreshing ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Aktualisiere...
              </>
            ) : (
              "Marktdaten aktualisieren"
            )}
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="mb-4 rounded-lg bg-accent-rose/10 px-3 py-2 text-sm text-accent-rose">
          {uploadError}
        </div>
      )}

      {latestUpdate && (
        <p className="mb-4 text-[11px] text-text-muted">
          Marktdaten aktualisiert: {new Date(latestUpdate).toLocaleString("de-DE")}
        </p>
      )}

      {/* Performance Summary */}
      {positions.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-4 opacity-0 animate-fade-in">
          <div className="glass-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Gesamtwert</p>
            <p className="mt-1 text-xl font-bold text-text-primary">
              {(mp?.gesamt_wert || totalValue).toLocaleString("de-DE", { maximumFractionDigits: 0 })} EUR
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Performance 5 Tage</p>
            <p className={`mt-1 text-xl font-bold ${(mp?.gesamt_perf_5d || 0) >= 0 ? "text-accent-emerald" : "text-accent-rose"}`}>
              {(mp?.gesamt_perf_5d || 0) >= 0 ? "+" : ""}{(mp?.gesamt_perf_5d || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })}%
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Performance YTD</p>
            <p className={`mt-1 text-xl font-bold ${(mp?.gesamt_perf_ytd || 0) >= 0 ? "text-accent-emerald" : "text-accent-rose"}`}>
              {(mp?.gesamt_perf_ytd || 0) >= 0 ? "+" : ""}{(mp?.gesamt_perf_ytd || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })}%
            </p>
          </div>
        </div>
      )}

      {/* Positions Table */}
      {positions.length > 0 ? (
        <div className="mb-10 opacity-0 animate-slide-up stagger-1">
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="text-right">Stueckzahl</th>
                    <th className="text-right">Kaufkurs</th>
                    <th>Whg.</th>
                    <th className="text-right">Gesamtposition (EUR)</th>
                    <th className="text-right">Akt. Kurs</th>
                    <th className="text-right">Gewichtung</th>
                    <th className="text-right">Perf. 5T</th>
                    <th className="text-right">YTD</th>
                    <th className="text-right">200 SMA</th>
                    <th>Branche</th>
                    <th>Region</th>
                    <th className="text-center">Analysten (B/H/S)</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos, i) => (
                    <tr key={pos.id || i}>
                      <td className="font-medium text-text-primary">
                        {pos.name}
                        {pos.symbol && <span className="ml-1.5 font-mono text-[11px] text-text-muted">{pos.symbol}</span>}
                      </td>
                      <td className="text-right font-mono text-text-secondary">{pos.stueckzahl.toLocaleString("de-DE")}</td>
                      <td className="text-right font-mono text-text-secondary">{pos.kurs.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td>
                      <td className="text-text-muted">{pos.waehrung || "EUR"}</td>
                      <td className="text-right font-mono text-text-secondary">
                        {positionValueEur(pos).toLocaleString("de-DE", { maximumFractionDigits: 0 })} EUR
                      </td>
                      <td className="text-right font-mono text-text-secondary">
                        {pos.aktueller_kurs != null ? pos.aktueller_kurs.toLocaleString("de-DE", { minimumFractionDigits: 2 }) : "--"}
                      </td>
                      <td className="text-right font-mono text-text-secondary">{pos.gewichtung.toFixed(1)}%</td>
                      <td className="text-right"><PctCell value={pos.perf_5d} /></td>
                      <td className="text-right"><PctCell value={pos.perf_ytd} /></td>
                      <td className="text-right"><PctCell value={pos.abstand_sma_200} /></td>
                      <td className="text-text-muted">{pos.branche || "--"}</td>
                      <td className="text-text-muted">{pos.region || pos.land || "--"}</td>
                      <td className="text-center"><AnalystenCell buy={pos.analysten_buy} hold={pos.analysten_hold} sell={pos.analysten_sell} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-10 rounded-2xl border-2 border-dashed border-surface-border p-12 text-center opacity-0 animate-slide-up stagger-1">
          <p className="text-text-muted">
            Noch keine Positionen. Laden Sie eine Excel-Datei hoch.
          </p>
        </div>
      )}

      {/* Strukturanalyse */}
      {positions.length > 0 && (
        <div className="mb-10 opacity-0 animate-slide-up stagger-2">
          <h2 className="section-heading mb-5">Strukturanalyse</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DonutCard title="Branche" data={buildBreakdown("branche")} delay="stagger-1" />
            <DonutCard title="Region / Land" data={buildBreakdown("region")} delay="stagger-2" />
            <DonutCard title="Assetklasse" data={buildBreakdown("typ")} delay="stagger-3" />
            <DonutCard title="Waehrung" data={buildBreakdown("waehrung")} delay="stagger-4" />
          </div>
        </div>
      )}
    </div>
  );
}
