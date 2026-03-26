"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { authFetch } from "@/lib/api";
import Link from "next/link";

interface Position {
  id: string;
  isin: string | null;
  wkn: string | null;
  name: string;
  stueckzahl: number;
  kurs: number;
  waehrung: string;
  land: string | null;
  branche: string | null;
  assetklasse: string | null;
  typ: string;
}

interface Portfolio {
  id: string;
  kunde_name: string;
  erstellt_am: string;
  positionen: Position[];
}

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await authFetch(`/portfolio/${id}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Fehler beim Laden");
        }
        setPortfolio(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">Portfolio wird geladen...</p>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-red-400">{error || "Portfolio nicht gefunden"}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/portfolio"
            className="mb-2 inline-block text-sm text-gray-400 hover:text-white"
          >
            &larr; Alle Portfolios
          </Link>
          <h1 className="text-2xl font-bold text-white">
            {portfolio.kunde_name}
          </h1>
          <p className="text-sm text-gray-400">
            Erstellt am{" "}
            {new Date(portfolio.erstellt_am).toLocaleDateString("de-DE")}
            {" -- "}
            {portfolio.positionen.length} Positionen
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-surface-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-gray-400">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">ISIN</th>
              <th className="px-4 py-3">Typ</th>
              <th className="px-4 py-3 text-right">Stueckzahl</th>
              <th className="px-4 py-3 text-right">Kurs</th>
              <th className="px-4 py-3">Waehrung</th>
              <th className="px-4 py-3">Assetklasse</th>
              <th className="px-4 py-3">Branche</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.positionen.map((pos, i) => (
              <tr
                key={pos.id || i}
                className="border-b border-white/5 text-white hover:bg-white/5"
              >
                <td className="px-4 py-3 font-medium">{pos.name}</td>
                <td className="px-4 py-3 text-gray-400">
                  {pos.isin || "--"}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary-light">
                    {pos.typ}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {pos.stueckzahl.toLocaleString("de-DE")}
                </td>
                <td className="px-4 py-3 text-right">
                  {pos.kurs.toLocaleString("de-DE", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="px-4 py-3">{pos.waehrung}</td>
                <td className="px-4 py-3 text-gray-400">
                  {pos.assetklasse || "--"}
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {pos.branche || "--"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
