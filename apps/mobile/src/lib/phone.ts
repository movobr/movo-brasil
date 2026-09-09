/**
 * Validação de telefone BR para entrada de OTP (21: onboarding/auth).
 * Normaliza para E.164 (+55...). Sem efeitos colaterais.
 */
export function normalizeBrPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const national = digits.startsWith('55') ? digits.slice(2) : digits;
  if (!/^\d{10,11}$/.test(national)) return null;
  if (national.length === 11 && national[2] !== '9') return null;
  return `+55${national}`;
}

export function isValidOtpCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}
