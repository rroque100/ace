# Fase 1 — Quick Wins: Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 4 quick-win improvements: design tokens, shared SaveStatus, empty states, and accessibility for switches.

**Architecture:** Cross-cutting changes that extract shared components and add design tokens; no new routes or API calls.

**Tech Stack:** React 19 + TypeScript strict + Tailwind CSS (`.tw` scoped via `@theme`)

**Global Constraints:**
- All new components go under `app/components/configuracion/`
- All changes must pass `npm run lint && npm run typecheck && npm run test`
- No new dependencies
- Tailwind classes use `.tw` prefix (`.tw-` container), no Preflight
- Existing CSS in `app/styles.css` is NOT modified — only `app/tailwind.css`

---

## File Structure

### New files:
- `app/components/configuracion/save-status.tsx` — shared SaveStatus component
- `app/components/configuracion/empty-state.tsx` — shared EmptyState component

### Modified files:
- `app/tailwind.css` — add `@theme` tokens for radius and font sizes
- `app/components/oficinas/municipalidad-tab.tsx` — replace inline SaveStatus
- `app/components/oficinas/feriados-tab.tsx` — add SaveStatus + EmptyState
- `app/components/oficinas/areas-tab.tsx` — add SaveStatus + EmptyState
- `app/components/oficinas/numeracion-tab.tsx` — add SaveStatus + EmptyState
- `app/components/oficinas/usuarios-tab.tsx` — add EmptyState
- `app/components/oficinas/admin-settings.tsx` — add SaveStatus
- `app/components/oficinas/modelos-requerimiento.tsx` — add EmptyState
- `app/components/oficinas/procesos-modal.tsx` — add aria attributes
- `app/components/oficinas/numeracion-tab.tsx` — align switch aria pattern
- Plus progressive radius/font token replacements in each tab

---

### Task 1: Design tokens (radius + font sizes)

**Files:**
- Modify: `app/tailwind.css`

**Interfaces:**
- Consumes: nothing
- Produces: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--text-xs` through `--text-xl`

- [ ] **Step 1: Add tokens to `@theme`**

Edit `app/tailwind.css`. Find the `@theme` block and add:

```css
@theme {
  /* existing tokens */

  --radius-sm: 6px;
  --radius-md: 9px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  --text-xs: 11px;
  --text-sm: 12.5px;
  --text-base: 13.5px;
  --text-md: 14.5px;
  --text-lg: 16px;
  --text-xl: 18px;
}
```

- [ ] **Step 2: Migrate radius tokens in municipalidad-tab.tsx**

Search for `rounded-[6px]` → `rounded-sm`, `rounded-[9px]` → `rounded-md`, `rounded-[12px]` → `rounded-lg`, `rounded-[16px]` → `rounded-xl` within the file. Also `rounded-[8px]` → `rounded-md`, `rounded-[10px]` → `rounded-lg`.

- [ ] **Step 3: Migrate font size tokens in municipalidad-tab.tsx**

Search for `text-[10.5px]` → `text-xs`, `text-[11.5px]` → `text-xs`, `text-[12.5px]` → `text-sm`, `text-[13.5px]` → `text-base`, `text-[14.5px]` → `text-md`.

- [ ] **Step 4: Run lint + typecheck**

```bash
npm run lint; if ($?) { npm run typecheck; }
```

- [ ] **Step 5: Commit**

```bash
git add app/tailwind.css app/components/oficinas/municipalidad-tab.tsx
git commit -m "feat(configuracion): tokens de radio y tipografia en @theme"
```

---

### Task 2: Shared SaveStatus component

**Files:**
- Create: `app/components/configuracion/save-status.tsx`
- Modify: `municipalidad-tab.tsx` — replace inline SaveStatus usage
- Modify: `feriados-tab.tsx`, `areas-tab.tsx`, `numeracion-tab.tsx`, `admin-settings.tsx` — add SaveStatus usage

**Interfaces:**
- Consumes: nothing from prior tasks
- Produces: `<SaveStatus>` component with props `{ status: 'idle' | 'saving' | 'saved' | 'dirty' | 'error'; message?: string }`

- [ ] **Step 1: Create `app/components/configuracion/save-status.tsx`**

```tsx
'use client';

import { Check, Loader2, AlertCircle, Pencil } from 'lucide-react';

export type SaveStatusType = 'idle' | 'saving' | 'saved' | 'dirty' | 'error';

interface SaveStatusProps {
  status: SaveStatusType;
  message?: string;
}

const STATUS_CONFIG: Record<SaveStatusType, {
  icon: typeof Check;
  text: string;
  className: string;
}> = {
  idle:     { icon: Check,       text: '',                     className: 'tw-opacity-0' },
  saving:   { icon: Loader2,     text: 'Guardando…',           className: 'tw-text-muted-foreground' },
  saved:    { icon: Check,       text: 'Guardado',             className: 'tw-text-green-600' },
  dirty:    { icon: Pencil,      text: 'Sin guardar',           className: 'tw-text-amber-600' },
  error:    { icon: AlertCircle, text: 'Error al guardar',     className: 'tw-text-red-600' },
};

export function SaveStatus({ status, message }: SaveStatusProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  if (status === 'idle') return null;

  return (
    <span className={`tw-inline-flex tw-items-center tw-gap-1.5 tw-text-xs tw-transition-opacity ${config.className}`}>
      <Icon className={`tw-size-3.5 ${status === 'saving' ? 'tw-animate-spin' : ''}`} />
      <span>{message ?? config.text}</span>
    </span>
  );
}
```

- [ ] **Step 2: Replace inline SaveStatus in municipalidad-tab.tsx**

Find the existing SaveStatus implementation (around line 1035) and the `guardar` function. Remove the local `SaveStatus` type, `STATUS_CONFIG`, and the `SaveStatus` function component. Replace the usage with:

```tsx
import { SaveStatus } from '@/components/configuracion/save-status';
```

Keep the local `status` state variable; it already matches the new type name. Change the JSX from the local usage to `<SaveStatus status={status} />`.

- [ ] **Step 3: Add SaveStatus to feriados-tab.tsx**

Import `SaveStatus` and `SaveStatusType`. Add a `status` state:

```tsx
const [saveStatus, setSaveStatus] = useState<SaveStatusType>('idle');
```

After the guardar button, add `<SaveStatus status={saveStatus} />`. Set status: before fetch → `'saving'`, on success → `'saved'` (auto-reset to `'idle'` after 3s), on error → `'error'`.

- [ ] **Step 4: Add SaveStatus to areas-tab.tsx, numeracion-tab.tsx, admin-settings.tsx**

Same pattern as feriados-tab.tsx: import, add state, wire to the save button.

- [ ] **Step 5: Run lint + typecheck**

- [ ] **Step 6: Commit**

---

### Task 3: Shared EmptyState component

**Files:**
- Create: `app/components/configuracion/empty-state.tsx`
- Modify: `areas-tab.tsx`, `numeracion-tab.tsx`, `usuarios-tab.tsx`, `modelos-requerimiento.tsx` — replace inline empty states

**Interfaces:**
- Consumes: nothing
- Produces: `<EmptyState>` with props `{ icon?: React.ElementType; title: string; description: string; action?: { label: string; onClick: () => void } }`

- [ ] **Step 1: Create `app/components/configuracion/empty-state.tsx`**

```tsx
import { Inbox } from 'lucide-react';
import type { ReactElement } from 'react';

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactElement;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  children,
}: EmptyStateProps) {
  return (
    <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-py-12 tw-px-4 tw-text-center">
      <Icon className="tw-size-12 tw-text-muted-foreground/40 tw-mb-4" />
      <h3 className="tw-text-base tw-font-semibold tw-text-foreground tw-mb-1">{title}</h3>
      <p className="tw-text-sm tw-text-muted-foreground tw-max-w-sm tw-mb-4">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-text-primary-foreground tw-bg-primary tw-rounded-md hover:tw-bg-primary/90"
        >
          {action.label}
        </button>
      )}
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Replace empty states in areas-tab.tsx**

Find the conditional rendering for when `areas.length === 0`. Replace with:

```tsx
{areas.length === 0 ? (
  <EmptyState
    title="No hay áreas registradas"
    description="Las áreas se usan para organizar los expedientes. Puedes importarlas desde un archivo PST o registrarlas manualmente."
    action={{ label: 'Importar áreas', onClick: () => setShowImportModal(true) }}
  />
) : (
  ...
)}
```

- [ ] **Step 3: Replace empty states in numeracion-tab.tsx**

```tsx
{correlativos.length === 0 ? (
  <EmptyState
    title="Sin correlativos configurados"
    description="Los correlativos definen el formato de numeración de los documentos. Agrega uno para empezar."
    action={{ label: 'Nuevo correlativo', onClick: () => addCorrelativo() }}
  />
) : ...}
```

- [ ] **Step 4: Replace empty states in usuarios-tab.tsx**

```tsx
{usuarios.length === 0 ? (
  <EmptyState
    title="No hay usuarios registrados"
    description="Los usuarios son las personas que accederán al sistema. Cada uno tendrá un rol con permisos específicos."
    action={{ label: 'Invitar usuario', onClick: () => { /* open invite flow */ } }}
  />
) : ...}
```

- [ ] **Step 5: Replace empty state in modelos-requerimiento.tsx**

```tsx
{modelos.length === 0 ? (
  <EmptyState
    title="Sin modelos de requerimiento"
    description="Los modelos son documentos PDF que sirven como plantilla para los requerimientos."
    action={{ label: 'Subir PDF', onClick: () => fileInputRef.current?.click() }}
  />
) : ...}
```

- [ ] **Step 6: Run lint + typecheck**

- [ ] **Step 7: Commit**

---

### Task 4: Accessibility — aria attributes on switches

**Files:**
- Modify: `procesos-modal.tsx` — add `role="switch"`, `aria-checked`, `aria-label`
- Modify: `numeracion-tab.tsx` — ensure switch pattern is consistent

**Interfaces:**
- Consumes: nothing
- Produces: accessible switch controls

- [ ] **Step 1: Update switch in procesos-modal.tsx**

Find the switch/toggle component (around line 390). Replace the `<input type="checkbox">` wrapper with:

```tsx
<label className="switchControl">
  <input
    type="checkbox"
    checked={proceso.activo}
    onChange={() => toggleProceso(proceso.id)}
    className="sr-only"
    aria-label={`${proceso.activo ? 'Desactivar' : 'Activar'} ${proceso.nombre}`}
  />
  <span
    className="..."
    role="switch"
    aria-checked={proceso.activo}
    tabIndex={0}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleProceso(proceso.id); }}
  >
    <span className="..." />
  </span>
</label>
```

- [ ] **Step 2: Review numeracion-tab.tsx switch**

Check if the existing switch already uses `role="switch"` and `aria-checked`. If not, apply the same pattern.

- [ ] **Step 3: Run lint + typecheck**

- [ ] **Step 4: Commit**

---

### Task 5: Token migration (remaining files)

**Files:**
- Modify: all `.tsx` files in `app/components/oficinas/` — replace `rounded-[...]` and `text-[...]` with token classes

- [ ] **Step 1: Migrate tokens in feriados-tab.tsx, areas-tab.tsx, numeracion-tab.tsx, usuarios-tab.tsx, admin-settings.tsx, modelos-requerimiento.tsx, procesos-modal.tsx, areas-import-modal.tsx, membrete-tab.tsx**

Use find-and-replace for each pattern:
- `rounded-[6px]` → `rounded-sm`
- `rounded-[7px]` → `rounded-sm` (rounds to nearest token)
- `rounded-[8px]` → `rounded-md`
- `rounded-[9px]` → `rounded-md`
- `rounded-[10px]` → `rounded-lg`
- `rounded-[12px]` → `rounded-lg`
- `rounded-[14px]` → `rounded-lg`
- `rounded-[16px]` → `rounded-xl`
- `text-[10.5px]` → `text-xs`
- `text-[11px]` → `text-xs`
- `text-[11.5px]` → `text-xs`
- `text-[12px]` → `text-sm`
- `text-[12.5px]` → `text-sm`
- `text-[13px]` → `text-base`
- `text-[13.5px]` → `text-base`
- `text-[14px]` → `text-md`
- `text-[14.5px]` → `text-md`
- `text-[15px]` → `text-lg`
- `text-[16px]` → `text-lg`
- `text-[18px]` → `text-xl`

- [ ] **Step 2: Run lint + typecheck**

- [ ] **Step 3: Run tests**

```bash
npm run test
```

- [ ] **Step 4: Commit**

---

## Verification

After all tasks:
```bash
npm run lint; if ($?) { npm run typecheck; } if ($?) { npm run test; }
```

Expected: 0 errors, all existing tests pass.

## Coverage against spec

- 1.1 ✓ SaveStatus compartido (Task 2)
- 1.2 ✓ Estados vacíos con guía (Task 3)
- 1.3 ✓ Tokens de radio y tipografía (Task 1 + Task 5)
- 1.4 ✓ Accessibility switches (Task 4)
