export default function HeroSection() {
  return (
    <section className="relative overflow-hidden px-6 py-20 text-center">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary-light">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Powered by Claude AI
        </div>

        <h1 className="mb-4 text-5xl font-bold tracking-tight text-white">
          Portfolio Analyzer
        </h1>

        <p className="mb-12 text-lg text-gray-400">
          Intelligente Portfolioanalyse fuer Finanzberater &mdash; Positionen
          automatisch erkennen, Struktur analysieren und mit dem
          Musterportfolio vergleichen.
        </p>
      </div>
    </section>
  );
}
