# Pendientes Configuración — Mini-mockup, tokens, tests

> **Goal:** Cerrar los 3 items pendientes del spec de mejoras de Configuración

**Architecture:** Mini-mockup se implementa inline en `numeracion-tab.tsx` como una hoja A4 estilizada (no un componente separado). Migración de tokens se hace por reemplazo exacto en cada archivo del módulo. Tests se añaden a `tests/`.

**Tech Stack:** React 19 + Tailwind v4 + TypeScript + Vitest

---

### Task 1: Mini-mockup en Numeración

**Files:**
- Modify: `app/components/oficinas/numeracion-tab.tsx`

**Interfaces:**
- Consumes: nada nuevo
- Produces: preview visual de hoja A4 con datos simulados + marca de agua "Ejemplo"

- [ ] **1. Añadir preview A4 estilizada**

Donde hoy hay texto plano (`DEC N° 001-2026-MDCH/LOG` como `<span>`), reemplazar con una hoja A4 visual con:
- Fondo blanco con sombra sutil (`shadow-pop`)
- Borde `border-line` con `rounded-xl`
- Layout con grid: escudo municipal + nombre entidad + título "DECRETO DE ALCALDÍA"
- Número correlativo grande: `DEC N° 001-2026-MDCH/LOG`
- Fecha y motivo simulados
- Marca de agua diagonal "EJEMPLO" en gris claro (rotada, opacidad baja, pointer-events none)
- Altura fija `h-[280px]` con `overflow-hidden`

---

### Task 2: Migrar ad-hoc values a tokens de diseño

**Files:** Todos los archivos bajo `app/components/configuracion/`, `app/components/oficinas/`, `app/configuracion/page.tsx`

**Search/Replace rules for `rounded-*`:**

| Ad-hoc | Token |
|---|---|
| `rounded-[999px]` | `rounded-full` |
| `rounded-[14px]` | `rounded-xl` |
| `rounded-[12px]` | `rounded-lg` |
| `rounded-[10px]` | `rounded-lg` |
| `rounded-[9px]` | `rounded-md` |
| `rounded-[8px]` | `rounded-md` |
| `rounded-[7px]` | `rounded-md` |
| `rounded-[6px]` | `rounded-sm` |
| `rounded-[5px]` | `rounded-sm` |
| `rounded-[4px]` | `rounded-sm` |
| `rounded-[13px]` | `rounded-xl` |
| `rounded-[11px]` | `rounded-lg` |

**Search/Replace rules for `text-*` (font-size):**

| Ad-hoc | Token |
|---|---|
| `text-[12.5px]` | `text-sm` |
| `text-[13.5px]` | `text-base` |
| `text-[12px]` | `text-xs` |
| `text-[13px]` | `text-sm` |
| `text-[14px]` | `text-sm` |
| `text-[15px]` | `text-md` |
| `text-[16px]` | `text-lg` |
| `text-[11px]` | `text-xs` |
| `text-[10px]` | `text-xs` |
| `text-[22px]` | `text-xl` |
| `text-[9px]` | `text-xs` |
| `text-[8px]` | `text-xs` |

**Exceptions:** `text-[#...]` (colors) must NOT be touched.

**Search/Replace rules for `gap-*`:**

| Ad-hoc | Token |
|---|---|
| `gap-[3px]` | `gap-1` |
| `gap-[7px]` | `gap-1.5` |
| `gap-[9px]` | `gap-2` |
| `gap-[14px]` | `gap-3` |
| `gap-[8px_10px]` | `gap-x-2 gap-y-2.5` |
| `gap-[4px_16px]` | `gap-x-1 gap-y-4` |

**Search/Replace rules for `p-*`:**

| Ad-hoc | Token |
|---|---|
| `p-[14px]` | `p-3` |
| `p-[18px]` | `p-4` |
| `p-[2px]` | `p-0.5` |
| `px-[7px]` | `px-1.5` |
| `px-[9px]` | `px-2` |
| `px-[6px]` | `px-1.5` |
| `px-[10px]` | `px-2.5` |
| `px-[18px]` | `px-4` |
| `px-[36px]` | keep |
| `py-[2px]` | `py-0.5` |
| `py-[3px]` | `py-1` |
| `py-[9px]` | `py-2` |
| `py-[15px]` | `py-3` |
| `py-[26px]` | `py-6` |

**Search/Replace rules for `leading-*`:**

| Ad-hoc | Token |
|---|---|
| `leading-[1.5]` | `leading-normal` |
| `leading-[1.4]` | `leading-snug` |
| `leading-[1.45]` | `leading-snug` |
| `leading-[1.35]` | `leading-snug` |

**Search/Replace rules for `tracking-*`:**

| Ad-hoc | Token |
|---|---|
| `tracking-[0.02em]` | `tracking-wide` |
| `tracking-[0.01em]` | keep |
| `tracking-[0.03em]` | `tracking-wide` |
| `tracking-[0.04em]` | `tracking-wider` |

- [ ] **2a. Migrar `usuarios-tab.tsx`** (~110 instances)
- [ ] **2b. Migrar `numeracion-tab.tsx`** (~15 instances, excluyendo el mini-mockup nuevo)
- [ ] **2c. Migrar `membrete-tab.tsx`** (~25 instances)
- [ ] **2d. Migrar `procesos-modal.tsx`** (~24 instances)
- [ ] **2e. Migrar `feriados-tab.tsx`** (~20 instances)
- [ ] **2f. Migrar `areas-tab.tsx`** (~15 instances)
- [ ] **2g. Migrar `areas-import-modal.tsx`** (~14 instances)
- [ ] **2h. Migrar `modelos-requerimiento.tsx`** (~10 instances)
- [ ] **2i. Migrar `municipalidad-tab.tsx`** (~3 remaining instances)
- [ ] **2j. Migrar `use-oficinas.tsx`** (~3 instances)
- [ ] **2k. Migrar `page.tsx`** (~1 instance)

---

### Task 3: Tests faltantes

**Files:**
- Create: `tests/feriados-oficiales-detect.test.ts`
- Create: `tests/permisos-matriz.test.ts`

- [ ] **3a. Test detección de duplicados en feriados**

Test that verifies when a duplicate date is entered, the UI shows the warning inline. Since the test environment is `node` and doesn't touch DOM, test the data logic: that adding a feriado with same fecha+year returns a warning message.

- [ ] **3b. Test aplanado de matriz de permisos**

Test that `rolePermissions` or equivalent permissions flattening logic produces correct matrix output.

---

### Task 4: Verificación

- [ ] Run `npm run typecheck`
- [ ] Run `npm run test`
- [ ] Run `npm run lint`
- [ ] Revisar que el build no falle
