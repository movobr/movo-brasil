-- MOVO Brasil — Migration 0003: onboarding (contrato 11).
-- driver_profiles, passenger_profiles e vehicles com propriedade por tenant
-- e vínculo de usuário. RLS deny-by-default como nas anteriores.
-- DERIVED-013: coluna `available` (13 exige "online/available" como critério
-- de elegibilidade; 20 exige home/availability) e `service_category`
-- (compatibilidade exigida em 13) — conceitos decididos, nomes mecânicos.
-- user_id UNIQUE: um usuário, um perfil por papel.
-- type_id segue sem FK até a migration do catálogo de serviços.

create table if not exists driver_profiles (
  id uuid primary key,
  tenant_id uuid not null references tenants (id),
  user_id uuid unique not null references users (id),
  status text not null,
  verification_status text not null,
  available boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists driver_profiles_tenant_id_idx on driver_profiles (tenant_id);

create table if not exists passenger_profiles (
  id uuid primary key,
  tenant_id uuid not null references tenants (id),
  user_id uuid unique not null references users (id),
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists passenger_profiles_tenant_id_idx on passenger_profiles (tenant_id);

create table if not exists vehicles (
  id uuid primary key,
  tenant_id uuid not null references tenants (id),
  driver_user_id uuid not null references users (id),
  type_id uuid not null,
  service_category text not null,
  plate text not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists vehicles_tenant_id_idx on vehicles (tenant_id);
create index if not exists vehicles_driver_user_id_idx on vehicles (driver_user_id);

alter table driver_profiles enable row level security;
alter table passenger_profiles enable row level security;
alter table vehicles enable row level security;
