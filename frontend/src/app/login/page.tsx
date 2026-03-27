"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await login(email, password);
      setUser(data.user);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm opacity-0 animate-slide-up">
        <div className="glass-card p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <svg
                className="h-5 w-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Anmelden
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Portfolio Analyzer fuer Finanzberater
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">
                E-Mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-surface-border bg-surface-raised px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                placeholder="berater@firma.de"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">
                Passwort
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-surface-border bg-surface-raised px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-accent-rose/10 px-3 py-2 text-sm text-accent-rose">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Wird angemeldet...
                </>
              ) : (
                "Anmelden"
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-[13px] text-text-muted">
            Noch kein Konto?{" "}
            <Link
              href="/register"
              className="text-primary transition-colors hover:text-primary-light"
            >
              Registrieren
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
