-- MOVO Brasil — Seed 001: tenants demo neutros (contrato 39-SEED-DATA).
-- Tenant A e Tenant B, sem marcas reais. Usuários por papel virão com as
-- fases donas de cada domínio; aqui: admin de plataforma + admins dos tenants.
-- Verificação automatizada de isolamento: tests/isolation/tenant-isolation.test.ts.

insert into tenants (id, name, slug, status, created_at, updated_at) values
  ('11111111-1111-4111-8111-111111111111', 'Demo Tenant A', 'demo-tenant-a', 'ACTIVE', now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'Demo Tenant B', 'demo-tenant-b', 'ACTIVE', now(), now())
on conflict (id) do nothing;

insert into users (id, tenant_id, role_scope, role, email, phone, name, status, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000000001', null, 'PLATFORM', 'MOVO_PLATFORM_ADMIN', 'platform-admin@movo.demo', null, 'Platform Admin', 'ACTIVE', now(), now()),
  ('00000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'TENANT', 'TENANT_ADMIN', 'admin-a@movo.demo', null, 'Tenant A Admin', 'ACTIVE', now(), now()),
  ('00000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'TENANT', 'TENANT_ADMIN', 'admin-b@movo.demo', null, 'Tenant B Admin', 'ACTIVE', now(), now())
on conflict (id) do nothing;
