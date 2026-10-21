export type StrengthLevel = 'weak' | 'acceptable' | 'strong' | 'very-strong';

export function getPasswordStrength(password: string): StrengthLevel {
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return 'weak';
  if (score <= 3) return 'acceptable';
  if (score <= 4) return 'strong';
  return 'very-strong';
}

export const STRENGTH_COLORS: Record<StrengthLevel, string> = {
  'weak': 'bg-red-500',
  'acceptable': 'bg-orange-500',
  'strong': 'bg-green-500',
  'very-strong': 'bg-emerald-500',
};

export const STRENGTH_LABELS: Record<StrengthLevel, string> = {
  'weak': 'Débil',
  'acceptable': 'Aceptable',
  'strong': 'Fuerte',
  'very-strong': 'Muy fuerte',
};
