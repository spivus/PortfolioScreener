-- Portfolio Analyzer – Supabase Schema
-- Ausfuehren in Supabase SQL Editor

-- ============================================================
-- PORTFOLIOS
-- ============================================================
create table if not exists portfolio (
    id            uuid primary key default gen_random_uuid(),
    berater_id    uuid not null references auth.users(id) on delete cascade,
    kunde_name    text not null,
    erstellt_am   timestamptz not null default now(),
    aktualisiert_am timestamptz not null default now()
);

alter table portfolio enable row level security;

create policy "Berater sieht eigene Portfolios"
    on portfolio for select
    using (auth.uid() = berater_id);

create policy "Berater erstellt eigene Portfolios"
    on portfolio for insert
    with check (auth.uid() = berater_id);

create policy "Berater loescht eigene Portfolios"
    on portfolio for delete
    using (auth.uid() = berater_id);

-- ============================================================
-- POSITIONEN
-- ============================================================
create table if not exists position (
    id            uuid primary key default gen_random_uuid(),
    portfolio_id  uuid not null references portfolio(id) on delete cascade,
    isin          text,
    wkn           text,
    symbol        text,
    name          text not null,
    stueckzahl    double precision not null default 0,
    kurs          double precision not null default 0,
    waehrung      text not null default 'EUR',
    kurswert_eur  double precision,
    land          text,
    region        text,
    branche       text,
    assetklasse   text,
    typ           text check (typ in ('Aktie','ETF','Fonds','Anleihe','Zertifikat','Sonstige')),
    aktueller_kurs double precision,
    sma_200       double precision,
    perf_5d       double precision,
    perf_ytd      double precision,
    analysten_buy   integer,
    analysten_hold  integer,
    analysten_sell  integer,
    marktdaten_aktualisiert_am timestamptz
);

alter table position enable row level security;

create policy "Positionen ueber Portfolio-Berater sichtbar"
    on position for select
    using (
        exists (
            select 1 from portfolio p
            where p.id = position.portfolio_id
              and p.berater_id = auth.uid()
        )
    );

create policy "Positionen ueber Portfolio-Berater einfuegen"
    on position for insert
    with check (
        exists (
            select 1 from portfolio p
            where p.id = position.portfolio_id
              and p.berater_id = auth.uid()
        )
    );

create policy "Positionen ueber Portfolio-Berater aktualisieren"
    on position for update
    using (
        exists (
            select 1 from portfolio p
            where p.id = position.portfolio_id
              and p.berater_id = auth.uid()
        )
    );

-- ============================================================
-- MUSTERPORTFOLIO (genau eines, global, nicht loeschbar)
-- ============================================================
create table if not exists musterportfolio (
    id            uuid primary key default gen_random_uuid(),
    name          text not null default 'Standard-Musterportfolio',
    beschreibung  text,
    erstellt_am   timestamptz not null default now()
);

alter table musterportfolio enable row level security;

-- Alle eingeloggten Berater duerfen lesen und bearbeiten
create policy "Alle Berater sehen Musterportfolio"
    on musterportfolio for select
    using (auth.uid() is not null);

create policy "Alle Berater bearbeiten Musterportfolio"
    on musterportfolio for update
    using (auth.uid() is not null);

-- Kein DELETE-Policy → Musterportfolio kann nicht geloescht werden

-- ============================================================
-- MUSTER-POSITIONEN
-- ============================================================
create table if not exists muster_position (
    id                  uuid primary key default gen_random_uuid(),
    musterportfolio_id  uuid not null references musterportfolio(id) on delete cascade,
    isin                text,
    symbol              text,
    name                text not null,
    stueckzahl          double precision not null default 0,
    kurs                double precision not null default 0,
    zielgewicht_prozent double precision not null default 0,
    assetklasse         text,
    branche             text,
    region              text,
    typ                 text,
    land                text,
    waehrung            text default 'EUR',
    kurswert_eur        double precision,
    aktueller_kurs      double precision,
    sma_200             double precision,
    perf_5d             double precision,
    perf_ytd            double precision,
    analysten_buy       integer,
    analysten_hold      integer,
    analysten_sell      integer,
    marktdaten_aktualisiert_am timestamptz
);

alter table muster_position enable row level security;

create policy "Alle Berater sehen Muster-Positionen"
    on muster_position for select
    using (auth.uid() is not null);

create policy "Alle Berater bearbeiten Muster-Positionen"
    on muster_position for all
    using (auth.uid() is not null);

-- ============================================================
-- SEED: Ein initiales Musterportfolio anlegen
-- ============================================================
insert into musterportfolio (name, beschreibung)
values ('Standard-Musterportfolio', 'Globales Musterportfolio fuer alle Berater')
on conflict do nothing;
