-- MOVO Brasil — Migration 0002: corridas e pagamentos (contrato 11).
-- rides carrega coordenadas, valores cotado/final e os marcos temporais do
-- contrato; payments referencia a corrida. RLS deny-by-default como em 0001.
-- DERIVED-011: nomes de coluna para conceitos documentados sem nome fixo
-- (pickup_lat/lng, dropoff_lat/lng, quoted_minor, final_minor).
-- DERIVED-012: colunas `method` (DEC-PAY-002: V1 Pix + cartão) e
-- `idempotency_key` única (15 §Pix flow: "persist external IDs and
-- idempotency key") — conceitos decididos, nomes mecânicos.
-- service_type_id segue sem FK até a migration do catálogo de serviços
-- (tabela service_types ainda não existe; FK chega com ela).

create table if not exists rides (
  id uuid primary key,
  tenant_id uuid not null references tenants (id),
  passenger_id uuid not null references users (id),
  driver_id uuid null references users (id),
  service_type_id uuid not null,
  status text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  dropoff_lat double precision not null,
  dropoff_lng double precision not null,
  quoted_minor bigint not null,
  final_minor bigint null,
  currency char(3) not null,
  requested_at timestamptz not null,
  accepted_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  cancelled_at timestamptz null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists rides_tenant_id_idx on rides (tenant_id);
create index if not exists rides_driver_id_idx on rides (driver_id);
create index if not exists rides_status_idx on rides (status);

create table if not exists payments (
  id uuid primary key,
  tenant_id uuid not null references tenants (id),
  ride_id uuid null references rides (id),
  method text not null,
  provider text not null,
  provider_reference text null,
  status text not null,
  amount_minor bigint not null,
  currency char(3) not null,
  idempotency_key text not null unique,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists payments_ride_id_idx on payments (ride_id);
create index if not exists payments_status_idx on payments (status);

alter table rides enable row level security;
alter table payments enable row level security;
