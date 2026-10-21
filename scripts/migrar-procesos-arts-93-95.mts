/**
 * Reconcilia el vocabulario de "tipo de proceso de selección" con las tablas de
 * los Arts. 93, 94 y 95 del Reglamento (21 procedimientos).
 *
 * El catálogo anterior tenía 18 entradas sacadas de los NOMBRES DE LOS PDF-MODELO,
 * que son plantillas operativas y no la tipología legal: partía la fila
 * «Concurso público para consultorías y servicios de mantenimiento vial» del
 * Art. 94 en seis entradas y dejaba fuera ocho tipos que el Reglamento sí lista.
 *
 * Toca cuatro sitios, todos derivados del catálogo en código (nada escrito a mano
 * salvo el mapa de equivalencias):
 *   1. documents.metadata.procesoSeleccion + documents.process_type (15 modelos)
 *   2. necesidades.tipo_proceso_seleccion
 *   3. entity_settings.metadata.office_process_types (lo que cada oficina gestiona)
 *   4. process_type_settings (el catálogo que alimenta /documentos y el chat)
 *
 * Reversible: el valor anterior se guarda en `metadata.procesoSeleccionLegacy` y
 * en `metadata.processTypeLegacy`.
 *
 * Uso:  npx tsx --env-file=.env.local scripts/migrar-procesos-arts-93-95.mts [--aplicar]
 * Sin --aplicar solo imprime lo que haría.
 */
import { supabaseRest } from "@/lib/supabase-server";
import { PROCESOS_SELECCION, esProcesoValido } from "@/lib/procesos-seleccion";
import { LEY_32069_PROCESOS_CATALOGO, codigoProceso } from "@/lib/procesos-catalogo-32069";

const APLICAR = process.argv.includes("--aplicar");

/** Valor del catálogo de 18 → procedimiento del Reglamento que le corresponde. */
const EQUIVALENCIAS: Record<string, string> = {
  // Cambian solo de caja: el Reglamento escribe el objeto en minúscula.
  "Licitación Pública para Bienes": "Licitación Pública para bienes",
  "Licitación Pública Abreviada para Bienes": "Licitación Pública abreviada para bienes",
  "Licitación Pública de Obras": "Licitación Pública de obras",
  "Licitación Pública Abreviada de Obras": "Licitación Pública abreviada de obras",
  "Concurso Público de Servicios": "Concurso Público de servicios",
  // Art. 94: consultorías y mantenimiento vial son UNA fila, no tres.
  "Concurso Público para Consultoría en General":
    "Concurso Público para consultorías y servicios de mantenimiento vial",
  "Concurso Público para Consultoría de Obra":
    "Concurso Público para consultorías y servicios de mantenimiento vial",
  "Concurso Público para Servicio de Mantenimiento Vial":
    "Concurso Público para consultorías y servicios de mantenimiento vial",
  // Art. 94: el abreviado es UNO, cubre servicios y consultorías de obra.
  "Concurso Público Abreviado de Servicios": "Concurso Público abreviado",
  "Concurso Público Abreviado para Consultoría en General": "Concurso Público abreviado",
  "Concurso Público Abreviado para Consultoría de Obra": "Concurso Público abreviado",
  "Concurso Público Abreviado para Servicio de Mantenimiento Vial": "Concurso Público abreviado",
  // Sin cambio (Art. 95 y Art. 55).
  "Subasta Inversa Electrónica": "Subasta Inversa Electrónica",
  "Comparación de Precios": "Comparación de Precios",
  "Concurso de Proyectos Arquitectónicos y Urbanísticos": "Concurso de Proyectos Arquitectónicos y Urbanísticos",
  "Compra Pública Precomercial": "Compra Pública Precomercial",
  "Asociación para la Innovación": "Asociación para la Innovación",
  "Procedimiento de Selección No Competitivo": "Procedimiento de Selección No Competitivo",
};

/** Traduce un valor viejo; si ya es del catálogo nuevo, lo deja igual. */
function nuevoValor(viejo: string | null | undefined): string | null {
  const v = (viejo ?? "").trim();
  if (!v) return null;
  if (esProcesoValido(v)) return v;
  return EQUIVALENCIAS[v] ?? null;
}

const CODIGOS_NUEVOS = new Map(PROCESOS_SELECCION.filter((p) => p.value).map((p) => [codigoProceso(p.value), p.value]));
/** Equivalencia entre códigos (lo que guardan las oficinas). */
const EQUIV_CODIGOS = new Map(
  Object.entries(EQUIVALENCIAS).map(([viejo, nuevo]) => [codigoProceso(viejo), codigoProceso(nuevo)]),
);

/**
 * `process_type_settings` tenía SUS PROPIOS códigos, distintos de los del
 * catálogo (`licitacion_publica_bienes` frente a `licitacion_publica_para_bienes`).
 * Este mapa es el que permite conservar lo que el usuario marcó ahí —sobre todo
 * «frecuente municipal»— al pasar al vocabulario del Reglamento.
 */
const cod = (v: string) => codigoProceso(v);
const EQUIV_SETTINGS: Record<string, string> = {
  comparacion_precios: cod("Comparación de Precios"),
  concurso_proyectos_arquitectonicos: cod("Concurso de Proyectos Arquitectónicos y Urbanísticos"),
  concurso_publico_abreviado_consultoria: cod("Concurso Público abreviado"),
  concurso_publico_abreviado_servicios: cod("Concurso Público abreviado"),
  concurso_publico_consultoria: cod("Concurso Público para consultorías y servicios de mantenimiento vial"),
  // Los dos que estaban partidos son UNA sola fila del Art. 94.
  concurso_publico_expertos: cod("Concurso Público abreviado para la contratación de expertos y gerentes de proyectos"),
  concurso_publico_gerente_proyecto: cod(
    "Concurso Público abreviado para la contratación de expertos y gerentes de proyectos",
  ),
  concurso_publico_servicios: cod("Concurso Público de servicios"),
  // `contrato_menor` no tiene equivalente a propósito: el Art. 34.1 dice que no
  // requiere procedimiento de selección, así que no es uno.
  licitacion_publica_abreviada_bienes: cod("Licitación Pública abreviada para bienes"),
  licitacion_publica_abreviada_obras: cod("Licitación Pública abreviada de obras"),
  licitacion_publica_bienes: cod("Licitación Pública para bienes"),
  licitacion_publica_obras: cod("Licitación Pública de obras"),
  procedimiento_no_competitivo: cod("Procedimiento de Selección No Competitivo"),
  subasta_inversa_electronica: cod("Subasta Inversa Electrónica"),
};

function log(titulo: string) {
  console.log(`\n── ${titulo} ${"─".repeat(Math.max(0, 62 - titulo.length))}`);
}

// ── 1. Modelos de requerimiento ────────────────────────────────────────────────
type Doc = { id: string; file_name: string; metadata: Record<string, unknown>; process_type: string | null };

log("1. documents (modelos de requerimiento)");
const modelos = await supabaseRest<Doc[]>(
  "documents?metadata->>kind=eq.modelo_requerimiento&select=id,file_name,metadata,process_type&order=file_name.asc",
);
let docsTocados = 0;
for (const d of modelos) {
  const viejo = typeof d.metadata.procesoSeleccion === "string" ? d.metadata.procesoSeleccion : null;
  const nuevo = nuevoValor(viejo);
  if (!nuevo) {
    console.log(`  ! SIN MAPEO  ${d.file_name} (tenía: ${viejo ?? "nada"})`);
    continue;
  }
  const codigo = codigoProceso(nuevo);
  const cambia = viejo !== nuevo || d.process_type !== codigo;
  console.log(`  ${cambia ? "→" : "="} ${(viejo ?? "—").slice(0, 48).padEnd(49)} ${nuevo}`);
  if (!cambia || !APLICAR) continue;
  const metadata = {
    ...d.metadata,
    procesoSeleccion: nuevo,
    ...(viejo && viejo !== nuevo ? { procesoSeleccionLegacy: viejo } : {}),
    ...(d.process_type ? { processTypeLegacy: d.process_type } : {}),
  };
  await supabaseRest(`documents?id=eq.${d.id}`, {
    body: JSON.stringify({ metadata, process_type: codigo }),
    method: "PATCH",
  });
  docsTocados += 1;
}

// ── 2. Necesidades ─────────────────────────────────────────────────────────────
log("2. necesidades.tipo_proceso_seleccion");
type Nec = { id: string; codigo: string | null; tipo_proceso_seleccion: string | null };
const necesidades = await supabaseRest<Nec[]>(
  "necesidades?tipo_proceso_seleccion=not.is.null&select=id,codigo,tipo_proceso_seleccion",
);
let necTocadas = 0;
for (const n of necesidades) {
  const viejo = (n.tipo_proceso_seleccion ?? "").trim();
  if (!viejo) continue;
  const nuevo = nuevoValor(viejo);
  if (!nuevo) {
    console.log(`  ! SIN MAPEO  ${n.codigo ?? n.id}: «${viejo}»`);
    continue;
  }
  console.log(`  ${viejo === nuevo ? "=" : "→"} ${(n.codigo ?? n.id).padEnd(16)} ${viejo.slice(0, 44).padEnd(45)} ${nuevo}`);
  if (viejo === nuevo || !APLICAR) continue;
  await supabaseRest(`necesidades?id=eq.${n.id}`, {
    body: JSON.stringify({ tipo_proceso_seleccion: nuevo }),
    method: "PATCH",
  });
  necTocadas += 1;
}

// ── 3. Procesos que gestiona cada oficina ──────────────────────────────────────
log("3. entity_settings.metadata.office_process_types");
type Settings = { id: string; metadata: Record<string, unknown> };
const [settings] = await supabaseRest<Settings[]>("entity_settings?id=eq.default&select=id,metadata");
const officePt = (settings?.metadata?.office_process_types ?? {}) as Record<string, Array<Record<string, unknown>>>;
const officeNuevo: Record<string, Array<Record<string, unknown>>> = {};
for (const [oficinaId, tipos] of Object.entries(officePt)) {
  // Varios códigos viejos colapsan en uno: se conserva activo si CUALQUIERA lo estaba.
  const porCodigo = new Map<string, Record<string, unknown>>();
  let colapsos = 0;
  for (const t of tipos) {
    const codigoViejo = String(t.code ?? "");
    const codigo = CODIGOS_NUEVOS.has(codigoViejo) ? codigoViejo : EQUIV_CODIGOS.get(codigoViejo);
    if (!codigo || !CODIGOS_NUEVOS.has(codigo)) {
      console.log(`  ! se retira  ${codigoViejo} (no está en el catálogo del Reglamento)`);
      continue;
    }
    const previo = porCodigo.get(codigo);
    if (previo) {
      colapsos += 1;
      previo.active = Boolean(previo.active) || Boolean(t.active);
    } else {
      porCodigo.set(codigo, { ...t, code: codigo, label: CODIGOS_NUEVOS.get(codigo) });
    }
  }
  officeNuevo[oficinaId] = [...porCodigo.values()];
  const activos = officeNuevo[oficinaId].filter((t) => t.active).length;
  console.log(
    `  oficina ${oficinaId}: ${tipos.length} → ${officeNuevo[oficinaId].length} tipos (${activos} activos, ${colapsos} fusionados)`,
  );
}
if (APLICAR && settings) {
  await supabaseRest(`entity_settings?id=eq.default`, {
    body: JSON.stringify({ metadata: { ...settings.metadata, office_process_types: officeNuevo } }),
    method: "PATCH",
  });
}

// ── 4. Catálogo global ─────────────────────────────────────────────────────────
log("4. process_type_settings");
type Fila = { code: string; label: string; active: boolean; frequent_municipality: boolean; year: number };
const filas = await supabaseRest<Fila[]>(
  "process_type_settings?select=code,label,active,frequent_municipality,year",
);
const anios = [...new Set(filas.map((f) => f.year))];
// «Frecuente municipal» es una marca que puso el usuario: se traslada al código
// equivalente en vez de perderse al reemplazar las filas.
const frecuentes = new Set<string>();
for (const f of filas) {
  const equivalente = CODIGOS_NUEVOS.has(f.code) ? f.code : EQUIV_SETTINGS[f.code];
  if (!equivalente) {
    console.log(`  ! se retira  ${f.code} · «${f.label}»${f.frequent_municipality ? "  (perdía «frecuente municipal»)" : ""}`);
    continue;
  }
  if (f.frequent_municipality) frecuentes.add(equivalente);
  if (equivalente !== f.code) console.log(`  → ${f.code.padEnd(40)} ${equivalente}`);
}
console.log(
  `  ${filas.length} filas (años: ${anios.join(", ") || "—"}) → ${LEY_32069_PROCESOS_CATALOGO.length} del catálogo` +
    ` · «frecuente municipal» conservado en ${frecuentes.size} de ${filas.filter((f) => f.frequent_municipality).length}`,
);
if (APLICAR) {
  const year = anios[0] ?? new Date().getFullYear();
  await supabaseRest(`process_type_settings?year=eq.${year}`, { method: "DELETE" });
  const filasNuevas = LEY_32069_PROCESOS_CATALOGO.map((p) => ({
    active: true,
    category: p.category,
    code: p.code,
    description: p.description,
    frequent_municipality: frecuentes.has(p.code),
    label: p.label,
    legal_basis: p.legalBasis,
    object: p.object,
    sort_order: p.sortOrder,
    year,
  }));
  // El contrato menor NO es un procedimiento de selección —el Art. 34.1 dice que
  // no lo requiere— y por eso no está en el catálogo de procedimientos. Pero esta
  // tabla también es la que clasifica DOCUMENTOS (una directiva sobre contratos
  // menores necesita dónde ir), así que se conserva con su categoría propia y la
  // cita que aclara qué es. Además la municipalidad la tenía marcada como
  // frecuente, y esa marca es suya.
  const menorPrevio = filas.find((f) => f.code === "contrato_menor");
  if (menorPrevio) {
    filasNuevas.push({
      active: true,
      category: "contrato_menor",
      code: "contrato_menor",
      description: "Contrataciones iguales o inferiores a 8 UIT. No se convoca procedimiento de selección.",
      frequent_municipality: menorPrevio.frequent_municipality,
      label: "Contrato Menor",
      legal_basis: "Ley 32069, Art. 34.1 · los contratos menores no requieren procedimiento de selección.",
      object: "Bienes, Servicios, Obras",
      sort_order: filasNuevas.length + 1,
      year,
    });
  }
  await supabaseRest("process_type_settings", { body: JSON.stringify(filasNuevas), method: "POST" });
}

log("resumen");
console.log(APLICAR ? "APLICADO" : "SIMULACIÓN (sin --aplicar no se escribe nada)");
console.log(`  modelos actualizados: ${docsTocados}`);
console.log(`  necesidades actualizadas: ${necTocadas}`);
