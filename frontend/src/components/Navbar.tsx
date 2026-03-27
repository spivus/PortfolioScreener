"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Portfolios", href: "/portfolio" },
  { label: "KI-Chat", href: "/chat" },
  { label: "Einstellungen", href: "/einstellungen" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-50 border-b border-surface-border bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20 transition-all group-hover:bg-primary/15 group-hover:ring-primary/30">
            <svg
              className="h-3.5 w-3.5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight text-text-primary">
            Portfolio Analyzer
          </span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-0.5">
          {isAuthenticated ? (
            <>
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                      isActive
                        ? "text-primary-light"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {item.label}
                    {isActive && (
                      <span className="absolute -bottom-[17px] left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-full bg-primary" />
                    )}
                  </Link>
                );
              })}
              <div className="ml-4 flex items-center gap-2 border-l border-surface-border pl-4">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  {user?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <span className="text-[13px] text-text-muted">
                  {user?.name}
                </span>
                <button
                  onClick={logout}
                  className="ml-1 rounded-md px-2 py-1 text-[12px] text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary"
                >
                  Abmelden
                </button>
              </div>
            </>
          ) : (
            <Link href="/login" className="btn-primary text-[13px]">
              Anmelden
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
