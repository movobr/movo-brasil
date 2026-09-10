-- MOVO Brasil — Migration 0004: branding por tenant (06/07).
-- Um branding por tenant (tenant_id único); RLS deny-by-default como as
-- demais tabelas; JSONB validado no domínio (validateBranding), nunca
-- JSON arbitrário silencioso (07 Safety).
create table if not exists tenant_branding (
  tenant_id uuid primary key references tenants (id),
  branding jsonb not null,
  updated_at timestamptz not null
);

alter table tenant_branding enable row level security;
