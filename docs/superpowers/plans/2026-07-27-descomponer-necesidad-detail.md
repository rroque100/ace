# Descomponer `necesidad-detail.tsx` — Plan de implementación

> **Para quien ejecute este plan:** los pasos usan casillas (`- [ ]`) para seguimiento. Cada fase
> termina en algo probable y commiteable por separado, y deja el árbol verde en CI.

**Objetivo:** partir el orquestador `app/components/necesidad-detail.tsx` (~2.384 líneas) en piezas
con una sola responsabilidad, sin cambiar ni un comportamiento observable. La meta final es un
componente de ~300–400 líneas que solo cablea hooks a componentes.

**Principio rector:** extraer **por responsabilidad, no por líneas**. Cada pieza sale con su estado
y sus operaciones juntas (hoy están a cientos de líneas de distancia). Los seis objetos que ya se
pasan a `FichaEditable` (`campo`, `catalogo`, `copiloto`, `ficha`, `vista`, `eett`) son casi el
índice de los hooks a extraer.

**Reglas del archivo que hay que preservar en cada extracción:**

- Los callbacks que cruzan a hijos memoizados (`CampoFicha`, paneles) van envueltos en
  `useCallbackEstable`; una prop nueva por render anula la memo.
- Nada de leer `ref.current` en render (la regla que motivó separar `proximoPaso` de su `fn`).
- `supabaseUserRest`/RLS no se toca: esto es solo cliente.
- El archivo es **CRLF**; `core.autocrlf=true` normaliza a LF al commitear, así que el diff no
  explota, pero conviene no reescribirlo entero.

**Tecnologías:** Next.js 16 (App Router), React 19, TypeScript, Vitest (`environment: "node"`),
Tailwind v4 acotado bajo `.tw`.

## Restricciones globales

- **El suite NO renderiza React.** `vitest.config.ts` fija `environment: "node"` e `include:
  ["tests/**/*.test.ts"]` — solo `.ts`. Las piezas de interfaz no llevan test automático: llevan
  comprobación manual escrita en el preview del entorno.
- **Comentarios en castellano**, explicando el porqué y no el qué.
- **Sin acentos en los mensajes de commit** (convención del repositorio); Conventional Commits con
  scope y el asunto describiendo el síntoma que veía el usuario.
- Verificación de cada fase: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- Caminos frágiles a repasar a mano tras cada fase: **autoguardado (debounce + 409),
  editar↔leer, cambiar Tipo de objeto sin guardar** (el bug de los ejes que discrepaban), y
  **traslado desde EETT/TDR**.

## Mapa actual → destino

| Responsabilidad hoy | Destino |
| --- | --- |
| `reload` + carga combinada (necesidad/docs/riesgos/obs/versiones/items/hitos) | `useNecesidadData(necesidadId)` |
| `campoEsObligatorio`, `camposParaObjeto`, `camposVisibles`, `campoExigible`, `avanceRequerimiento`, `obligatoriosDelProceso`, `prioridadCampo`, `tieneValor` | `lib/necesidad-ficha-derivar.ts` (puro) + delegados finos |
| EETT/TDR (`loadEett`/`subirEett`/`abrirEett`/`borrarEett` + estado) | `useEettTdr(necesidadId)` |
| Extracción IA (`handleExtract`/`applyExtract`/`completarConModelo` + `extract*`, `exigidosModelo`) | `useExtraccionIA(...)` |
| `pedirRedactarIA` (composición Art. 67/144/plazo) + estado copiloto | `useCopilotoRedaccion(...)` |
| `modo`, `modoSimple`, `wizard*`, `seccionEnVista` + IntersectionObserver | `useModoVista()` |
| `cargar/agregar/resolverObservacion` | pliega en `useNecesidadData` o `useObservaciones` |
| Cabecera (título, avance, badges, eliminar) | `<FichaHeader/>` |
| Panel de flujo (stepper, próximo paso, cuantía, acciones) | `<PanelFlujo/>` |
| Sección EETT (upload + lista) inline | `<PanelEettTdr/>` |
| Bloque "Autocompletar la ficha" | `<PanelAutocompletar/>` |
| Columna lateral (verificación/coherencia/obs/adjuntos) | `<ColumnaDiagnosticos/>` |

---

## Fases

### Fase 0 — Red de seguridad
- [x] Confirmar baseline verde: `npm run lint && npm run typecheck && npm run test && npm run build`.
- [x] Confirmar que `campo-ficha`, paneles y `ficha-lectura` siguen memoizados (son la razón de que
      los callbacks vayan por `useCallbackEstable`).

### Fase 1 — Lógica de catálogo a `lib/` (mayor ROI, riesgo mínimo)
**Idea:** las funciones que deciden qué campos ve el área usuaria son puras dado el estado; hoy
están dentro del componente y no se pueden probar sin renderizar. Se sacan a un módulo con un
objeto `EjesFicha` explícito, y el componente pasa a delegar.

- [x] Crear `lib/necesidad-ficha-derivar.ts` con `EjesFicha` y las funciones puras:
      `esCampoObligatorio`, `camposAplicables`, `esCampoExigible`, `prioridadDeCampo`,
      `tieneValorEnForm`, `tieneValorGuardado`, `camposVisiblesDeSeccion`,
      `obligatoriosDelProceso`, `avanceDeObligatorios`.
- [x] Crear `tests/necesidad-ficha-derivar.test.ts` recorriendo el catálogo entero
      (`for (const s of FICHA_SECCIONES)`), con foco en el invariante «el modelo SUMA, no resta»
      (un `exigidosModelo` que no lista un obligatorio de base no lo degrada) y en que los
      subgrupos no se parten. **14 casos, todos verdes.**
- [x] Recablear `necesidad-detail.tsx`: memoizar `objetosEfectivos`, añadir `ejesFicha`
      (`useMemo`), y reducir las 8 funciones a delegados de una línea. Firmas públicas intactas.
      De paso, `prioridadCampo` (wrapper local) desaparece: su único uso era el orden, ahora en el
      módulo puro.
- [x] Verificación: `tsc` limpio · `eslint app lib` 0 errores · `vitest run` 2077 pasan · `build`
      correcto. Los tres números de avance comparten ahora `avanceDeObligatorios`, así que no pueden
      discrepar por construcción.

### Fase 2 — `useNecesidadData`
- [ ] Mover `reload` y los `setX` de la carga combinada + observaciones a un hook que devuelve
      `{ necesidad, documentos, riesgos, observaciones, versiones, admisibilidad, hitos, items,
      setItems, loading, error, setError, reload }`.
- [ ] `recargar`/`trasTransicion` siguen envolviendo el `reload` del hook con `useCallbackEstable`.

### Fase 3 — Hooks de subdominio (uno por PR)
- [ ] `useEettTdr` — estado + `loadEett`/`subirEett`/`abrirEett`/`borrarEett`.
- [ ] `useExtraccionIA` — recibe `necesidad` y `reload`; PATCH + reload.
- [ ] `useCopilotoRedaccion` — recibe `fichaForm`/`setFichaField` y la entidad; composición
      determinista de forma de pago, plazo y recepción.
- [ ] `useModoVista` — `modo`/`modoSimple`/`wizard*`/`seccionEnVista` + IntersectionObserver.

### Fase 4 — Componentes presentacionales
- [ ] `<FichaHeader/>`, `<PanelFlujo/>`, `<PanelEettTdr/>`, `<PanelAutocompletar/>`,
      `<ColumnaDiagnosticos/>`. Reciben props planas; nada de lógica nueva.
- [ ] Memoizar los que reciban callbacks estables, como el resto de `app/components/necesidad/`.

### Fase 5 — Limpieza
- [ ] Revisar si algún `eslint-disable react-hooks/*` deja de hacer falta al aislar los efectos.
- [ ] Confirmar que ningún objeto-prop fresco (`catalogo`, `vista`…) anula una nueva memoización;
      si `FichaEditable` se memoiza, estabilizar esos objetos con `useMemo`.

---

## Riesgo transversal a vigilar

Hoy `FichaEditable` **no** está memoizado, así que los objetos-prop frescos (`catalogo`, `vista`…)
no cuestan nada. En cuanto se memoice algo que los reciba (Fase 4/5), hay que estabilizarlos o se
pierde el beneficio. Es el fallo silencioso más fácil de introducir aquí.
