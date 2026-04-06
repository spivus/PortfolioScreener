"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { authFetch } from "@/lib/api";
import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import ChatSidebar from "@/components/ChatSidebar";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ── Types ── */

interface Position {
  id: string;
  name: string;
  symbol: string | null;
  stueckzahl: number;
  kurs: number;
  kaufkurs: number;
  aktueller_kurs: number | null;
  sma_200: number | null;
  abstand_sma_200: number | null;
  branche: string | null;
  im_musterportfolio: boolean;
  gewichtung: number;
  rendite: number;
  ytd_performance: number | null;
  analysten_buy: number | null;
  analysten_hold: number | null;
  analysten_sell: number | null;
  marktdaten_aktualisiert_am: string | null;
  perf_5d: number | null;
  perf_ytd: number | null;
  high_52w: number | null;
  low_52w: number | null;
  forward_pe: number | null;
  beta: number | null;
  target_price: number | null;
  target_potential: number | null;
}

interface Portfolio {
  id: string;
  kunde_name: string;
  erstellt_am: string;
  positionen: Position[];
  gesamt_wert: number;
  gesamt_perf_5d: number;
  gesamt_perf_ytd: number;
}

interface AnalyseEntry {
  name: string;
  gewichtung: number;
}

interface Analyse {
  branche: AnalyseEntry[];
  land: AnalyseEntry[];
  typ: AnalyseEntry[];
  waehrung: AnalyseEntry[];
}

interface VergleichRow {
  name: string;
  isin: string | null;
  branche: string | null;
  region: string | null;
  zielgewicht: number;
  ist_gewicht: number;
  abweichung: number;
  vorhanden: boolean;
}

/* ── Column Config ── */

type ColumnKey =
  | "stueckzahl" | "kaufkurs" | "aktueller_kurs" | "abstand_sma_200"
  | "branche" | "im_musterportfolio" | "gewichtung" | "rendite"
  | "perf_5d" | "perf_ytd" | "analysten" | "high_52w" | "abstand_52w"
  | "forward_pe" | "beta" | "target_potential";

interface ColumnDef {
  key: ColumnKey;
  label: string;
  align: "left" | "right" | "center";
  default: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "stueckzahl", label: "Stueckzahl", align: "right", default: true },
  { key: "kaufkurs", label: "Kaufkurs", align: "right", default: true },
  { key: "aktueller_kurs", label: "Akt. Kurs", align: "right", default: true },
  { key: "abstand_sma_200", label: "200 SMA", align: "right", default: true },
  { key: "high_52w", label: "52W Hoch", align: "right", default: false },
  { key: "abstand_52w", label: "Abstand 52W", align: "right", default: true },
  { key: "forward_pe", label: "Fwd. KGV", align: "right", default: false },
  { key: "beta", label: "Beta", align: "right", default: false },
  { key: "target_potential", label: "Analysten-Potenzial", align: "right", default: true },
  { key: "branche", label: "Branche", align: "left", default: true },
  { key: "im_musterportfolio", label: "Muster", align: "center", default: true },
  { key: "gewichtung", label: "Gewicht", align: "right", default: true },
  { key: "rendite", label: "Rendite", align: "right", default: true },
  { key: "perf_5d", label: "Perf. 5T", align: "right", default: true },
  { key: "perf_ytd", label: "YTD", align: "right", default: true },
  { key: "analysten", label: "Analysten (B/H/S)", align: "center", default: true },
];

const STORAGE_KEY = "portfolio-visible-columns";

function getInitialColumns(): ColumnKey[] {
  if (typeof window === "undefined") return ALL_COLUMNS.filter(c => c.default).map(c => c.key);
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return JSON.parse(stored);
  return ALL_COLUMNS.filter(c => c.default).map(c => c.key);
}

/* ── Sort ── */

type SortDir = "asc" | "desc" | null;

function getSortValue(pos: Position, key: ColumnKey): number | string {
  switch (key) {
    case "stueckzahl": return pos.stueckzahl;
    case "kaufkurs": return pos.kaufkurs;
    case "aktueller_kurs": return pos.aktueller_kurs ?? -Infinity;
    case "abstand_sma_200": return pos.abstand_sma_200 ?? -Infinity;
    case "high_52w": return pos.high_52w ?? -Infinity;
    case "abstand_52w": return pos.high_52w && pos.aktueller_kurs ? ((pos.aktueller_kurs / pos.high_52w * 100 - 100)) : -Infinity;
    case "target_potential": return pos.target_potential ?? -Infinity;
    case "forward_pe": return pos.forward_pe ?? Infinity;
    case "beta": return pos.beta ?? -Infinity;
    case "branche": return pos.branche ?? "zzz";
    case "im_musterportfolio": return pos.im_musterportfolio ? 1 : 0;
    case "gewichtung": return pos.gewichtung;
    case "rendite": return pos.rendite;
    case "perf_5d": return pos.perf_5d ?? -Infinity;
    case "perf_ytd": return pos.perf_ytd ?? -Infinity;
    case "analysten": return pos.analysten_buy ?? -Infinity;
    default: return 0;
  }
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
    <span
      className={
        positive ? "stat-pill-green" : "stat-pill-red"
      }
    >
      {positive ? "+" : ""}
      {value.toLocaleString("de-DE", { minimumFractionDigits: 2 })}%
    </span>
  );
}

function SortTh({
  label,
  sortKey,
  currentKey,
  dir,
  align = "left",
  onSort,
}: {
  label: string;
  sortKey: string;
  currentKey: string | null;
  dir: SortDir;
  align?: "left" | "right" | "center";
  onSort: (key: string, dir: SortDir) => void;
}) {
  const active = currentKey === sortKey;
  const nextDir = !active ? "asc" : dir === "asc" ? "desc" : null;
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "";
  return (
    <th
      className={`${alignClass} cursor-pointer select-none transition-colors hover:text-primary`}
      onClick={() => onSort(sortKey, nextDir)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && dir === "asc" && <span className="text-primary">&#9650;</span>}
        {active && dir === "desc" && <span className="text-primary">&#9660;</span>}
      </span>
    </th>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  delay,
}: {
  label: string;
  value: string;
  sub?: string;
  delay: string;
}) {
  return (
    <div
      className={`glass-card p-4 opacity-0 animate-slide-up ${delay}`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-text-primary">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

function DonutCard({
  title,
  data,
  delay,
}: {
  title: string;
  data: AnalyseEntry[];
  delay: string;
}) {
  return (
    <div className={`glass-card p-5 opacity-0 animate-slide-up ${delay}`}>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">
        {title}
      </h3>
      <div className="flex items-center gap-4">
        <div className="w-[140px] shrink-0">
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={data}
                dataKey="gewichtung"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={38}
                outerRadius={62}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={DONUT_COLORS[idx % DONUT_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `${Number(value).toFixed(1)}%`}
                contentStyle={{
                  backgroundColor: "#0C1425",
                  border: "1px solid rgba(148,163,184,0.1)",
                  borderRadius: "10px",
                  color: "#F1F5F9",
                  fontSize: "12px",
                  padding: "6px 10px",
                }}
                itemStyle={{ color: "#94A3B8" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-1.5 overflow-hidden">
          {data.slice(0, 6).map((entry, idx) => (
            <div key={entry.name} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    DONUT_COLORS[idx % DONUT_COLORS.length],
                }}
              />
              <span className="truncate text-text-secondary">
                {entry.name}
              </span>
              <span className="ml-auto font-mono text-text-muted">
                {entry.gewichtung.toFixed(1)}%
              </span>
            </div>
          ))}
          {data.length > 6 && (
            <span className="text-[11px] text-text-muted">
              +{data.length - 6} weitere
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Page ── */

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [vergleich, setVergleich] = useState<VergleichRow[]>([]);
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleCols, setVisibleCols] = useState<ColumnKey[]>(getInitialColumns);
  const [showColPicker, setShowColPicker] = useState(false);
  const [sortKey, setSortKey] = useState<ColumnKey | "name" | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  async function loadPortfolio() {
    const res = await authFetch(`/portfolio/${id}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Fehler beim Laden");
    }
    return res.json();
  }

  async function loadVergleich() {
    const res = await authFetch(`/portfolio/${id}/vergleich`);
    if (res.ok) {
      const data = await res.json();
      setVergleich(data.vergleich);
    }
  }

  async function loadAnalyse() {
    const res = await authFetch(`/portfolio/${id}/analyse`);
    if (res.ok) {
      setAnalyse(await res.json());
    }
  }

  useEffect(() => {
    Promise.all([
      loadPortfolio().then(setPortfolio),
      loadVergleich(),
      loadAnalyse(),
    ])
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Fehler beim Laden")
      )
      .finally(() => setLoading(false));
  }, [id]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await authFetch(`/portfolio/${id}/refresh-market-data`, {
        method: "POST",
      });
      const data = await loadPortfolio();
      setPortfolio(data);
    } catch {
      setError("Fehler beim Aktualisieren der Marktdaten");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-text-muted">Portfolio wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="glass-card p-6 text-center">
          <p className="text-accent-rose">{error || "Portfolio nicht gefunden"}</p>
          <Link href="/portfolio" className="mt-3 inline-block text-sm text-primary hover:underline">
            Zurueck zur Uebersicht
          </Link>
        </div>
      </div>
    );
  }

  const latestUpdate = portfolio.positionen
    .map((p) => p.marktdaten_aktualisiert_am)
    .filter(Boolean)
    .sort()
    .pop();

  const totalValue = portfolio.positionen.reduce(
    (s, p) => s + p.stueckzahl * (p.aktueller_kurs || p.kaufkurs),
    0
  );

  const avgRendite =
    portfolio.positionen.length > 0
      ? portfolio.positionen.reduce((s, p) => s + p.rendite, 0) /
        portfolio.positionen.length
      : 0;

  const musterCount = portfolio.positionen.filter(
    (p) => p.im_musterportfolio
  ).length;

  const sortedPositions = (() => {
    if (!sortKey || !sortDir) return portfolio.positionen;
    const sorted = [...portfolio.positionen].sort((a, b) => {
      let va: string | number;
      let vb: string | number;
      if (sortKey === "name") {
        va = a.name.toLowerCase();
        vb = b.name.toLowerCase();
      } else {
        va = getSortValue(a, sortKey as ColumnKey);
        vb = getSortValue(b, sortKey as ColumnKey);
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  })();

  return (
    <RequireAuth>
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between opacity-0 animate-fade-in">
          <div>
            <Link
              href="/portfolio"
              className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-text-muted transition-colors hover:text-text-secondary"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Alle Portfolios
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              {portfolio.kunde_name}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Erstellt am{" "}
              {new Date(portfolio.erstellt_am).toLocaleDateString("de-DE")}
              {" \u00B7 "}
              {portfolio.positionen.length} Positionen
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-primary text-[13px]"
            >
              {refreshing ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Aktualisiere...
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Marktdaten aktualisieren
                </>
              )}
            </button>
            <p className="text-[11px] text-text-muted">
              {latestUpdate
                ? `Aktualisiert: ${new Date(latestUpdate).toLocaleString("de-DE")}`
                : "Noch nicht aktualisiert"}
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
          <SummaryCard
            label="Portfoliowert"
            value={`${(portfolio.gesamt_wert || totalValue).toLocaleString("de-DE", { maximumFractionDigits: 0 })} EUR`}
            delay="stagger-1"
          />
          <SummaryCard
            label="Positionen"
            value={String(portfolio.positionen.length)}
            sub={`${musterCount} im Musterportfolio`}
            delay="stagger-2"
          />
          <SummaryCard
            label="Rendite (Durchschnitt)"
            value={`${avgRendite >= 0 ? "+" : ""}${avgRendite.toFixed(2)}%`}
            delay="stagger-3"
          />
          <SummaryCard
            label="Performance 5 Tage"
            value={`${(portfolio.gesamt_perf_5d || 0) >= 0 ? "+" : ""}${(portfolio.gesamt_perf_5d || 0).toFixed(2)}%`}
            delay="stagger-4"
          />
          <SummaryCard
            label="Performance YTD"
            value={`${(portfolio.gesamt_perf_ytd || 0) >= 0 ? "+" : ""}${(portfolio.gesamt_perf_ytd || 0).toFixed(2)}%`}
            delay="stagger-4"
          />
        </div>

        {/* Positions Table */}
        <div className="mb-10 opacity-0 animate-slide-up stagger-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-heading">Positionen</h2>
            <div className="relative">
              <button
                onClick={() => setShowColPicker(!showColPicker)}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-text-muted transition-colors hover:bg-white/10 hover:text-text-secondary"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Indikatoren
              </button>
              {showColPicker && (
                <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-xl border border-white/10 bg-[#0C1425] p-3 shadow-xl">
                  {ALL_COLUMNS.map((col) => (
                    <label key={col.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-text-secondary hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={visibleCols.includes(col.key)}
                        onChange={() => {
                          const next = visibleCols.includes(col.key)
                            ? visibleCols.filter(k => k !== col.key)
                            : [...visibleCols, col.key];
                          setVisibleCols(next);
                          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                        }}
                        className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-primary"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortTh label="Name" sortKey="name" currentKey={sortKey} dir={sortDir} onSort={(k, d) => { setSortKey(k as ColumnKey | "name"); setSortDir(d); }} />
                    {ALL_COLUMNS.filter(c => visibleCols.includes(c.key)).map(col => (
                      <SortTh key={col.key} label={col.label} sortKey={col.key} currentKey={sortKey} dir={sortDir} align={col.align} onSort={(k, d) => { setSortKey(k as ColumnKey); setSortDir(d); }} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedPositions.map((pos, i) => (
                    <tr key={pos.id || i}>
                      <td className="font-medium text-text-primary">
                        {pos.name}
                        {pos.symbol && (
                          <span className="ml-1.5 font-mono text-[11px] text-text-muted">
                            {pos.symbol}
                          </span>
                        )}
                      </td>
                      {visibleCols.includes("stueckzahl") && (
                        <td className="text-right font-mono text-text-secondary">
                          {pos.stueckzahl.toLocaleString("de-DE")}
                        </td>
                      )}
                      {visibleCols.includes("kaufkurs") && (
                        <td className="text-right font-mono text-text-secondary">
                          {pos.kaufkurs.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                        </td>
                      )}
                      {visibleCols.includes("aktueller_kurs") && (
                        <td className="text-right font-mono text-text-secondary">
                          {pos.aktueller_kurs != null
                            ? pos.aktueller_kurs.toLocaleString("de-DE", { minimumFractionDigits: 2 })
                            : "--"}
                        </td>
                      )}
                      {visibleCols.includes("abstand_sma_200") && (
                        <td className="text-right"><PctCell value={pos.abstand_sma_200} /></td>
                      )}
                      {visibleCols.includes("high_52w") && (
                        <td className="text-right font-mono text-text-secondary">
                          {pos.high_52w != null
                            ? pos.high_52w.toLocaleString("de-DE", { minimumFractionDigits: 2 })
                            : "--"}
                        </td>
                      )}
                      {visibleCols.includes("abstand_52w") && (
                        <td className="text-right">
                          {pos.high_52w != null && pos.aktueller_kurs != null ? (
                            <PctCell value={Math.round((pos.aktueller_kurs / pos.high_52w * 100 - 100) * 100) / 100} />
                          ) : <span className="text-text-muted">--</span>}
                        </td>
                      )}
                      {visibleCols.includes("forward_pe") && (
                        <td className="text-right font-mono text-text-secondary">
                          {pos.forward_pe != null ? pos.forward_pe.toFixed(1) : "--"}
                        </td>
                      )}
                      {visibleCols.includes("beta") && (
                        <td className="text-right font-mono text-text-secondary">
                          {pos.beta != null ? pos.beta.toFixed(2) : "--"}
                        </td>
                      )}
                      {visibleCols.includes("target_potential") && (
                        <td className="text-right">
                          {pos.target_potential != null ? (
                            <PctCell value={pos.target_potential} />
                          ) : <span className="text-text-muted">--</span>}
                        </td>
                      )}
                      {visibleCols.includes("branche") && (
                        <td className="text-text-muted">{pos.branche || "--"}</td>
                      )}
                      {visibleCols.includes("im_musterportfolio") && (
                        <td className="text-center">
                          {pos.im_musterportfolio ? (
                            <span className="stat-pill-green">Ja</span>
                          ) : (
                            <span className="text-text-muted">--</span>
                          )}
                        </td>
                      )}
                      {visibleCols.includes("gewichtung") && (
                        <td className="text-right font-mono text-text-secondary">{pos.gewichtung.toFixed(1)}%</td>
                      )}
                      {visibleCols.includes("rendite") && (
                        <td className="text-right"><PctCell value={pos.rendite} /></td>
                      )}
                      {visibleCols.includes("perf_5d") && (
                        <td className="text-right"><PctCell value={pos.perf_5d} /></td>
                      )}
                      {visibleCols.includes("perf_ytd") && (
                        <td className="text-right"><PctCell value={pos.perf_ytd} /></td>
                      )}
                      {visibleCols.includes("analysten") && (
                        <td className="text-center">
                          {pos.analysten_buy != null ? (
                            <span className="text-xs font-mono">
                              <span className="text-accent-emerald">{pos.analysten_buy}</span>
                              {" / "}
                              <span className="text-text-muted">{pos.analysten_hold}</span>
                              {" / "}
                              <span className="text-accent-rose">{pos.analysten_sell}</span>
                            </span>
                          ) : (
                            <span className="text-text-muted">--</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Musterportfolio-Vergleich */}
        {vergleich.length > 0 && (
          <div className="mb-10 opacity-0 animate-slide-up stagger-3">
            <h2 className="section-heading mb-5">Musterportfolio-Vergleich</h2>
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Muster-Position</th>
                      <th>Branche</th>
                      <th>Region</th>
                      <th className="text-center">Status</th>
                      <th className="text-right">Ziel</th>
                      <th className="text-right">Ist</th>
                      <th className="text-right">Abweichung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vergleich.map((row, i) => (
                      <tr
                        key={i}
                        className={!row.vorhanden ? "opacity-50" : ""}
                      >
                        <td className="font-medium text-text-primary">
                          {row.name}
                          {row.isin && (
                            <span className="ml-1.5 font-mono text-[11px] text-text-muted">
                              {row.isin}
                            </span>
                          )}
                        </td>
                        <td className="text-text-muted">
                          {row.branche || "--"}
                        </td>
                        <td className="text-text-muted">
                          {row.region || "--"}
                        </td>
                        <td className="text-center">
                          {row.vorhanden ? (
                            <span className="stat-pill-green">Vorhanden</span>
                          ) : (
                            <span className="stat-pill-red">Fehlt</span>
                          )}
                        </td>
                        <td className="text-right font-mono text-text-secondary">
                          {row.zielgewicht.toFixed(1)}%
                        </td>
                        <td className="text-right font-mono text-text-secondary">
                          {row.vorhanden
                            ? `${row.ist_gewicht.toFixed(1)}%`
                            : "--"}
                        </td>
                        <td className="text-right">
                          {row.vorhanden ? (
                            <PctCell value={row.abweichung} />
                          ) : (
                            <span className="stat-pill-red">fehlt</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Strukturanalyse */}
        {analyse && (
          <div className="mb-10 opacity-0 animate-slide-up stagger-4">
            <h2 className="section-heading mb-5">Strukturanalyse</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DonutCard title="Branche" data={analyse.branche} delay="stagger-1" />
              <DonutCard title="Land / Region" data={analyse.land} delay="stagger-2" />
              <DonutCard title="Assetklasse" data={analyse.typ} delay="stagger-3" />
              <DonutCard title="Waehrung" data={analyse.waehrung} delay="stagger-4" />
            </div>
          </div>
        )}
      </div>
      <ChatSidebar portfolioId={id} />
    </RequireAuth>
  );
}
