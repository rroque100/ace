# Fase 4 — Pulido final: Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 5 polish improvements: password strength indicator, numbering mini-mockup, larger member preview with zoom overlay, duplicate holiday detection.

**Architecture:** Small targeted changes and new utility helpers.

**Tech Stack:** React 19 + TypeScript strict + Tailwind CSS.

**Global Constraints:**
- All changes must pass `npm run lint && npm run typecheck && npm run test`
- No new dependencies

---

### Task 1: Duplicate holiday detection

**Files:**
- Modify: `feriados-tab.tsx`

- [ ] **Step 1: Show warning when date already exists**

In the "Nuevo feriado" form, when user picks a date that already exists in the list, show inline warning:

```tsx
{feriados.some(f => f.fecha === nuevaFecha && f.id !== editingId) && (
  <p className="tw-text-xs tw-text-amber-600 tw-mt-1">
    Ya existe un feriado en esta fecha: «{feriados.find(f => f.fecha === nuevaFecha)?.nombre}».
    Puedes añadirlo de todas formas.
  </p>
)}
```

This doesn't block — it's informational.

- [ ] **Step 2: Run lint + typecheck**

- [ ] **Step 3: Commit**

---

### Task 2: Password strength indicator

**Files:**
- Create: `lib/password-strength.ts`
- Modify: `usuarios-tab.tsx`

- [ ] **Step 1: Create helper**

```tsx
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
  'weak': 'tw-bg-red-500',
  'acceptable': 'tw-bg-orange-500',
  'strong': 'tw-bg-green-500',
  'very-strong': 'tw-bg-emerald-500',
};

export const STRENGTH_LABELS: Record<StrengthLevel, string> = {
  'weak': 'Débil',
  'acceptable': 'Aceptable',
  'strong': 'Fuerte',
  'very-strong': 'Muy fuerte',
};
```

- [ ] **Step 2: Write test**

```tsx
import { describe, it, expect } from 'vitest';
import { getPasswordStrength } from '../lib/password-strength';

describe('getPasswordStrength', () => {
  it('returns weak for short password', () => {
    expect(getPasswordStrength('abc')).toBe('weak');
  });
  it('returns very-strong for long complex password', () => {
    expect(getPasswordStrength('Str0ng!P@ssw0rd#2026')).toBe('very-strong');
  });
  it('returns strong for 16-char alpha-numeric', () => {
    expect(getPasswordStrength('abcdefgh12345678')).toBe('strong');
  });
});
```

- [ ] **Step 3: Show indicator in component**

Next to the generated password in the credentials panel:

```tsx
const level = getPasswordStrength(cred.password);
const width = { 'weak': '25%', 'acceptable': '50%', 'strong': '75%', 'very-strong': '100%' }[level];

<div className="tw-flex tw-items-center tw-gap-2 tw-mt-1">
  <div className="tw-h-1.5 tw-w-20 tw-bg-muted tw-rounded-full tw-overflow-hidden">
    <div className={`tw-h-full tw-rounded-full ${STRENGTH_COLORS[level]}`} style={{ width: width }} />
  </div>
  <span className="tw-text-xs tw-text-muted-foreground">{STRENGTH_LABELS[level]}</span>
</div>
```

- [ ] **Step 4: Run lint + typecheck + test**

- [ ] **Step 5: Commit**

---

### Task 3: Numbering mini-mockup

**Files:**
- Modify: `numeracion-tab.tsx`

- [ ] **Step 1: Add mockup next to preview text**

Find the preview area (around line 271). Next to the text preview, add:

```tsx
<div className="tw-relative tw-w-48 tw-h-64 tw-bg-white tw-border tw-border-gray-300 tw-rounded-sm tw-shadow-sm tw-overflow-hidden">
  <div className="tw-absolute tw-top-4 tw-right-4 tw-text-right">
    <p className="tw-text-[9px] tw-text-gray-400 tw-font-mono">{correlativo.prefijo}</p>
    <p className="tw-text-xs tw-font-bold tw-text-gray-700">
      {correlativo.prefijo} N° {correlativo.ultimo + 1:04d}-{año}
    </p>
  </div>
  <div className="tw-absolute tw-bottom-2 tw-left-0 tw-right-0 tw-text-center">
    <span className="tw-text-[8px] tw-text-gray-300 tw-italic">Ejemplo</span>
  </div>
</div>
```

- [ ] **Step 2: Run lint + typecheck**

- [ ] **Step 3: Commit**

---

### Task 4: Larger member preview + zoom overlay

**Files:**
- Modify: `membrete-tab.tsx`

- [ ] **Step 1: Increase preview height**

Change `240px` to `320px` on desktop. Use responsive class or media query.

- [ ] **Step 2: Make fullscreen button primary**

Replace secondary button styling with primary:
```tsx
className="tw-px-3 tw-py-1.5 tw-text-xs tw-font-medium tw-text-white tw-bg-primary tw-rounded-md hover:tw-bg-primary/90"
```

- [ ] **Step 3: Add click-to-zoom overlay**

```tsx
const [zoomed, setZoomed] = useState(false);

{zoomed && (
  <div className="tw-fixed tw-inset-0 tw-z-50 tw-bg-black/60 tw-flex tw-items-center tw-justify-center tw-p-8" onClick={() => setZoomed(false)}>
    <div className="tw-max-w-3xl tw-max-h-[90vh] tw-overflow-auto tw-shadow-2xl" onClick={e => e.stopPropagation()}>
      {/* larger version of preview */}
    </div>
  </div>
)}
```

Make the regular preview clickable: `onClick={() => setZoomed(true)}` with `tw-cursor-pointer`.

- [ ] **Step 4: Run lint + typecheck**

- [ ] **Step 5: Commit**

---

## Verification

```bash
npm run lint; if ($?) { npm run typecheck; } if ($?) { npm run test; }
```
