'use server';

import { redirect } from 'next/navigation';
import type { BrandingConfig } from '@movo/brasil/src/domain/branding.js';
import { getBackend } from '../../../../lib/backend.js';
import { requireSession } from '../../../../lib/require-session.js';

/**
 * Branding do tenant (06/07): escrita via server action, permissão
 * `branding.manage` com escopo, validação no serviço, auditoria.
 * Upload binário de assets (tipo/dimensão/conteúdo) é ativação de assets,
 * fora deste escopo: aqui URLs https + tokens (06 Asset rules, parte textual).
 */
export async function updateBrandingAction(tenantId: string, slug: string, formData: FormData): Promise<never> {
  const actor = await requireSession();
  const backend = await getBackend();
  const colors: Record<string, string> = {};
  const primary = String(formData.get('primaryColor') ?? '').trim();
  if (primary !== '') colors['primary'] = primary;
  const branding: BrandingConfig = {
    ...(String(formData.get('commercialName') ?? '').trim() !== ''
      ? { commercialName: String(formData.get('commercialName') ?? '').trim() }
      : {}),
    ...(String(formData.get('primaryLogoUrl') ?? '').trim() !== ''
      ? { primaryLogoUrl: String(formData.get('primaryLogoUrl') ?? '').trim() }
      : {}),
    colors,
  };
  try {
    await backend.tenants.updateBranding(actor, tenantId, branding);
  } catch (error) {
    redirect(
      `/admin/tenants/${slug}?brandError=${encodeURIComponent(error instanceof Error ? error.message : 'Falha.')}`,
    );
  }
  redirect(`/admin/tenants/${slug}?brandSaved=1`);
}
