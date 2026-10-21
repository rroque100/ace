# Fase 2 — Mejoras medias: Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 6 medium-effort improvements: permission matrix, official holiday import, drag & drop modelos, error row highlighting, PAC clarity, contract threshold promotion.

**Architecture:** Mix of new UI components, static data files, and inline form improvements.

**Tech Stack:** React 19 + TypeScript strict + Tailwind CSS + standard file I/O for JSON data.

**Global Constraints:**
- All changes must pass `npm run lint && npm run typecheck && npm run test`
- No new dependencies
- Holiday data is static JSON in repo, not fetched from external API

---

## File Structure

### New files:
- `lib/feriados-oficiales/2026.json` — official Peruvian holidays
- `lib/feriados-oficiales/2027.json`
- `lib/feriados-oficiales/index.ts` — loader helper

### Modified files:
- `app/components/oficinas/usuarios-tab.tsx` — permission matrix
- `app/components/oficinas/feriados-tab.tsx` — import button
- `app/components/oficinas/modelos-requerimiento.tsx` — drag & drop zone
- `app/components/oficinas/areas-import-modal.tsx` — error row highlighting
- `app/components/oficinas/municipalidad-tab.tsx` — PAC helper text, UIT card

---

### Task 1: Static holiday data files

**Files:**
- Create: `lib/feriados-oficiales/2026.json`
- Create: `lib/feriados-oficiales/2027.json`
- Create: `lib/feriados-oficiales/index.ts`

- [ ] **Step 1: Create `lib/feriados-oficiales/2026.json`**

```json
[
  { "fecha": "2026-01-01", "nombre": "Año Nuevo" },
  { "fecha": "2026-04-09", "nombre": "Jueves Santo" },
  { "fecha": "2026-04-10", "nombre": "Viernes Santo" },
  { "fecha": "2026-05-01", "nombre": "Día del Trabajo" },
  { "fecha": "2026-06-29", "nombre": "San Pedro y San Pablo" },
  { "fecha": "2026-07-28", "nombre": "Fiestas Patrias" },
  { "fecha": "2026-07-29", "nombre": "Fiestas Patrias" },
  { "fecha": "2026-08-30", "nombre": "Santa Rosa de Lima" },
  { "fecha": "2026-10-08", "nombre": "Combate de Angamos" },
  { "fecha": "2026-11-01", "nombre": "Todos los Santos" },
  { "fecha": "2026-12-08", "nombre": "Inmaculada Concepción" },
  { "fecha": "2026-12-25", "nombre": "Navidad" }
]
```

- [ ] **Step 2: Create `lib/feriados-oficiales/2027.json`**

Same structure, with 2027 dates.

- [ ] **Step 3: Create `lib/feriados-oficiales/index.ts`**

```tsx
import feriados2026 from './2026.json';
import feriados2027 from './2027.json';

interface FeriadoOficial {
  fecha: string;
  nombre: string;
}

const DATA: Record<string, FeriadoOficial[]> = {
  '2026': feriados2026 as FeriadoOficial[],
  '2027': feriados2027 as FeriadoOficial[],
};

export function getFeriadosOficiales(year: string): FeriadoOficial[] {
  return DATA[year] ?? [];
}
```

- [ ] **Step 4: Write test**

Create `tests/feriados-oficiales.test.ts`:

```tsx
import { describe, it, expect } from 'vitest';
import { getFeriadosOficiales } from '../lib/feriados-oficiales/index';

describe('getFeriadosOficiales', () => {
  it('returns 2026 holidays', () => {
    const feriados = getFeriadosOficiales('2026');
    expect(feriados.length).toBeGreaterThan(0);
    expect(feriados[0]).toHaveProperty('fecha');
    expect(feriados[0]).toHaveProperty('nombre');
  });

  it('returns empty array for unknown year', () => {
    expect(getFeriadosOficiales('2030')).toEqual([]);
  });

  it('first holiday of 2026 is Año Nuevo', () => {
    const feriados = getFeriadosOficiales('2026');
    expect(feriados.find(f => f.fecha === '2026-01-01')?.nombre).toBe('Año Nuevo');
  });
});
```

- [ ] **Step 5: Run test**

```bash
npx vitest run tests/feriados-oficiales.test.ts -v
```

- [ ] **Step 6: Commit**

---

### Task 2: Import button in feriados-tab.tsx

**Files:**
- Modify: `feriados-tab.tsx`

- [ ] **Step 1: Import the holidays data and add import button**

Add at top:
```tsx
import { getFeriadosOficiales } from '@/lib/feriados-oficiales/index';
```

Add a button in the header area (next to "Nuevo feriado"):

```tsx
<button
  onClick={() => importarFeriadosOficiales(añoActual)}
  className="tw-px-3 tw-py-1.5 tw-text-xs tw-font-medium tw-text-primary tw-border tw-border-primary/30 tw-rounded-md hover:tw-bg-primary/5"
>
  Importar feriados oficiales {añoActual}
</button>
```

Where `añoActual` comes from the year context. Implement `importarFeriadosOficiales`:

```tsx
function importarFeriadosOficiales(year: string) {
  const oficiales = getFeriadosOficiales(year);
  if (oficiales.length === 0) return;

  const existentes = new Set(feriados.map(f => f.fecha));
  const nuevos = oficiales.filter(f => !existentes.has(f.fecha));

  if (nuevos.length === 0) {
    // toast: "Todos los feriados oficiales ya están registrados"
    return;
  }

  const confirmar = window.confirm(
    `Se importarán ${nuevos.length} feriado(s) oficial(es) para ${year}. ¿Continuar?`
  );
  if (!confirmar) return;

  setFeriados(prev => [...prev, ...nuevos.map(f => ({
    id: crypto.randomUUID(),
    fecha: f.fecha,
    nombre: f.nombre,
  }))]);
  // trigger save
}
```

- [ ] **Step 2: Run lint + typecheck**

- [ ] **Step 3: Commit**

---

### Task 3: Permission matrix in usuarios-tab.tsx

**Files:**
- Modify: `usuarios-tab.tsx`

- [ ] **Step 1: Install/import the permission types**

Ensure `lib/permisos-contratacion.ts` exports are being used. The matrix gets roles from `ROLES` (or whatever the exported constant is) and capabilities from the permission definitions.

- [ ] **Step 2: Replace the `<code>` block (around line 358)**

Find the `<code>` block that shows permissions. Replace with a table:

```tsx
const CAPACIDADES = [
  { key: 'ver_expedientes', label: 'Ver expedientes' },
  { key: 'editar_expediente', label: 'Editar expediente' },
  { key: 'aprobar_dec', label: 'Aprobar DEC' },
  { key: 'gestionar_usuarios', label: 'Gestionar usuarios' },
  // ... actual capabilities from permisos-contratacion.ts
];

// In the JSX:
<table className="tw-w-full tw-text-xs tw-border-collapse">
  <thead>
    <tr className="tw-border-b">
      <th className="tw-text-left tw-py-2 tw-pr-4 tw-font-medium">Capacidad</th>
      {ROLES.filter(r => r !== 'superadmin').map(rol => (
        <th key={rol} className="tw-text-center tw-py-2 tw-px-2 tw-font-medium tw-capitalize">{rol}</th>
      ))}
    </tr>
  </thead>
  <tbody>
    {CAPACIDADES.map(cap => (
      <tr key={cap.key} className="tw-border-b last:tw-border-0">
        <td className="tw-py-2 tw-pr-4">{cap.label}</td>
        {ROLES.filter(r => r !== 'superadmin').map(rol => {
          const tiene = rolePermissions[rol]?.includes(cap.key);
          return (
            <td key={rol} className="tw-text-center tw-py-2">
              <span className={`tw-inline-flex tw-items-center tw-justify-center tw-w-5 tw-h-5 tw-rounded-sm ${tiene ? 'tw-text-green-600' : 'tw-text-red-400'}`}>
                {tiene ? '✓' : '✗'}
              </span>
            </td>
          );
        })}
      </tr>
    ))}
  </tbody>
</table>
```

- [ ] **Step 3: Write test for permission matrix flattening**

If `lib/permisos-contratacion.ts` has a helper, test it. Otherwise test the component.

- [ ] **Step 4: Run lint + typecheck**

- [ ] **Step 5: Commit**

---

### Task 4: Drag & drop in modelos-requerimiento.tsx

**Files:**
- Modify: `modelos-requerimiento.tsx`

- [ ] **Step 1: Add drag & drop zone**

Find the upload section (around the "Subir PDF" button). Wrap it:

```tsx
const [isDragging, setIsDragging] = useState(false);

const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragging(true);
};

const handleDragLeave = (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragging(false);
};

const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragging(false);
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    upload(file);
  }
};
```

In the JSX:

```tsx
<div
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
  className={`tw-border-2 tw-border-dashed tw-rounded-lg tw-p-8 tw-text-center tw-transition-colors ${
    isDragging
      ? 'tw-border-primary tw-bg-primary/5'
      : 'tw-border-border tw-bg-transparent'
  }`}
>
  <p className="tw-text-sm tw-text-muted-foreground tw-mb-2">
    Arrastra un PDF aquí o haz clic para seleccionar
  </p>
  <button onClick={() => fileInputRef.current?.click()} className="...existing...">
    Subir PDF
  </button>
</div>
```

- [ ] **Step 2: Run lint + typecheck**

- [ ] **Step 3: Commit**

---

### Task 5: Error row highlighting in areas-import-modal.tsx

**Files:**
- Modify: `areas-import-modal.tsx`

- [ ] **Step 1: Add error class to rows**

Find the table row rendering. Add conditional styling:

```tsx
{filas.map((fila, idx) => {
  const errorFila = errores.find(e => e.fila === idx);
  return (
    <tr
      key={idx}
      className={`${
        errorFila
          ? 'tw-bg-red-50 dark:tw-bg-red-950/20'
          : idx % 2 === 0 ? 'tw-bg-muted/20' : ''
      } tw-border-b last:tw-border-0`}
    >
      {errorFila && (
        <td className="tw-py-2 tw-px-2 tw-w-6">
          <span
            className="tw-inline-flex tw-items-center tw-justify-center tw-w-5 tw-h-5 tw-rounded-full tw-bg-red-100 tw-text-red-600 tw-text-xs tw-font-bold"
            title={errorFila.mensaje}
          >
            !
          </span>
        </td>
      )}
      {/* existing cells */}
    </tr>
  );
})}
```

- [ ] **Step 2: Run lint + typecheck**

- [ ] **Step 3: Commit**

---

### Task 6: PAC clarity + contract threshold in municipalidad-tab.tsx

**Files:**
- Modify: `municipalidad-tab.tsx`

- [ ] **Step 1: Add helper text to PAC obras field**

Find the "PAC obras" read-only field. Add below it:

```tsx
<p className="tw-text-xs tw-text-muted-foreground tw-mt-1">
  Calculado: PAC total − bienes y servicios. Para ajustar, modifica uno de los dos.
</p>
```

- [ ] **Step 2: Promote contract threshold card**

Find the 8 UIT calculation card (around line 950). Extract it to a visible position above the PAC section:

```tsx
<div className="tw-bg-blue-50 dark:tw-bg-blue-950/20 tw-border tw-border-blue-200 dark:tw-border-blue-800 tw-rounded-lg tw-p-4 tw-mb-6">
  <p className="tw-text-sm tw-font-medium tw-text-blue-800 dark:tw-text-blue-200">
    Umbral del contrato menor: <strong>S/ {calcular8UIT()}</strong>
  </p>
  <p className="tw-text-xs tw-text-blue-600 dark:tw-text-blue-400 tw-mt-1">
    Contrataciones cuyo valor estimado no supere este monto pueden agruparse por ítems.
  </p>
</div>
```

- [ ] **Step 3: Run lint + typecheck**

- [ ] **Step 4: Commit**

---

## Verification

```bash
npm run lint; if ($?) { npm run typecheck; } if ($?) { npm run test; }
```
