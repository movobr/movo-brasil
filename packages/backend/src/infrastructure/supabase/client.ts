import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '../../domain/errors.js';

/**
 * Fábrica do client Supabase (DEC-TECH-004/005).
 * O backend usa a service_role key e é responsável por aplicar o contexto
 * de tenant + autorização antes de qualquer acesso (00 §7, 02). RLS
 * deny-by-default no banco é a segunda barreira (migration 0001).
 * DERIVED-005: uso de service_role no backend é o padrão mecânico do
 * Supabase para acesso servidor-a-servidor; nenhuma decisão de produto.
 */
export function createSupabaseClient(env: NodeJS.ProcessEnv = process.env): SupabaseClient {
  const url = env['SUPABASE_URL'];
  const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'];
  if (url === undefined || url === '' || serviceKey === undefined || serviceKey === '') {
    throw new DomainError(
      'VALIDATION_FAILED',
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for live Supabase access.',
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/**
 * Client público para Auth user-facing (Fase 31). REGRA DE SEGURANÇA:
 * o client service_role NUNCA carrega sessão de usuário — após signIn o
 * supabase-js passa a enviar o JWT do usuário e o RLS deny-by-default
 * nega as leituras do backend (além de misturar identidades). Auth de
 * usuário usa a publishable key; repositórios usam o service client.
 */
export function createPublicSupabaseClient(env: NodeJS.ProcessEnv = process.env): SupabaseClient {
  const url = env['SUPABASE_URL'] ?? env['NEXT_PUBLIC_SUPABASE_URL'];
  const publishableKey = env['SUPABASE_PUBLISHABLE_KEY'] ?? env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
  if (url === undefined || url === '' || publishableKey === undefined || publishableKey === '') {
    throw new DomainError(
      'VALIDATION_FAILED',
      'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set for user-facing auth.',
    );
  }
  return createClient(url, publishableKey, { auth: { persistSession: false } });
}
