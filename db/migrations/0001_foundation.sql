-- MOVO Brasil — Migration 0001: fundação multi-tenant.
-- Contrato: 11-DATABASE-CONTRACT (tabelas tenants, users, audit_events).
-- PostgreSQL via Supabase Cloud é o store transacional autoritativo (V1).
-- RLS habilitado sem policies permissivas = deny-by-default no banco (00 §7,
-- 02): nenhuma role autenticada lê/escreve sem policy explícita futura; o
-- backend opera com service_role e aplica contexto/autorização (02).

create table if not exists tenants (
  id uuid primary key,
  name text not null,
  slug text unique not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists users (
  id uuid primary key,
  tenant_id uuid null references tenants (id),
  role_scope text not null,
  role text not null,
  email text null,
  phone text null,
  name text not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists users_tenant_id_idx on users (tenant_id);

create table if not exists audit_events (
  id uuid primary key,
  tenant_id uuid null references tenants (id),
  actor_user_id uuid null,
  action text not null,
  resource_type text not null,
  resource_id uuid null,
  metadata jsonb not null,
  result text not null,
  correlation_id text not null,
  created_at timestamptz not null
);

create index if not exists audit_events_tenant_id_idx on audit_events (tenant_id);
create index if not exists audit_events_created_at_idx on audit_events (created_at);

alter table tenants enable row level security;
alter table users enable row level security;
alter table audit_events enable row level security;
