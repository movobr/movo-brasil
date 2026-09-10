-- Fase 38: rota calculada no request (distância/ETA), nula em corridas legadas.
alter table rides
  add column if not exists route_distance_meters bigint null,
  add column if not exists route_duration_seconds bigint null;
