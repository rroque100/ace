// Reúne los datos del informe de aprobación del expediente (A8).
//
// Vive aparte porque lo usan DOS endpoints: el que descarga el .docx y el de la
// vista previa. Si cada uno los reuniera por su cuenta, la previa podría enseñar
// una cosa y el documento otra, que es exactamente lo que la haría inútil:
// existe para comprobar qué se va a firmar ANTES de generarlo.

import { documentoModificacionCmnTexto, esNoProgramada } from "./actuaciones-preparatorias";
import { cuantiaDeA5 } from "./anexo1-interaccion";
import { familiaProcedimiento } from "./aplicabilidad-fases";
import { prefijoDesignacion, soloNumeroDesignacion } from "./designacion-evaluadores";
import { formatDocumentNumber } from "./document-number";
import { capitalizarProceso, labelProcedimiento } from "./estrategia-formato";
import { conGradoAcademico, nombreParaFirma, type Persona } from "./nombres";
import type { DatosInformeAprobacion, FirmanteInforme } from "./informe-aprobacion-expediente";
import { OPCIONES_MODALIDAD_PAGO } from "./opciones-contratacion";
import type { HitosMap } from "./procurement-fases";
import { aprobadorNoCompetitivo, textoCausalArt55 } from "./regimen-seleccion";
import { supabaseRest, supabaseUserRest } from "./supabase-server";

type ProcesoRow = {
  nomenclature: string;
  entity: string | null;
  status: string;
  procedure_type: string | null;
  valor_estimado: number | null;
  amount: number | null;
  necesidad_id: string | null;
  hitos: HitosMap | null;
};

type NecesidadRow = {
  nombre: string | null;
  area_usuaria: string | null;
  cui: string | null;
  monto_estimado: number | null;
  tipo_proceso_seleccion: string | null;
};

// Ficha de la entidad. El AGA (aga_*) es la ATENCIÓN del informe; el gerente
// (manager_*) queda de respaldo por si no se registró el AGA aparte.
type InstitucionRow = {
  city: string | null;
  manager_degree: string | null;
  manager_full_name: string | null;
  manager_position: string | null;
  aga_degree: string | null;
  aga_full_name: string | null;
  aga_position: string | null;
};

function str(data: Record<string, unknown> | undefined, key: string): string {
  const v = data?.[key];
  return typeof v === "string" ? v.trim() : "";
}

/** Importe en el formato del modelo ("S/. 58,500.00"). Vacío si no hay cifra. */
function soles(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `S/. ${n.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Fecha ISO ("2026-08-01") a "1 de agosto del 2026". Si no es ISO, se respeta. */
function fechaLarga(iso: string): string {
  const s = (iso ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  const [, y, mes, dia] = m;
  return `${Number(dia)} de ${MESES[Number(mes) - 1]} del ${y}`;
}

// Nombre genérico de la DEC en la Ley (Art. 42). Debe coincidir con el default
// que el paso A8 propone para el DE (oficinaEncargadaDeContrataciones): si no, la
// previa mostraría una oficina distinta de la que el formulario ofrece.
const NOMBRE_DEC_GENERICO = "DEPENDENCIA ENCARGADA DE CONTRATACIONES";

/**
 * Texto de dos líneas del paso → firmante.
 *
 * Los tres campos de cabecera de A8 son textareas con el nombre arriba y el
 * cargo debajo, igual que en el informe de segmentación. Aquí se parten para
 * que el documento los imprima en renglones distintos.
 */
function desdeCampo(valor: string, cargoPorDefecto: string): FirmanteInforme {
  const [primera = "", ...resto] = valor.split(/\r?\n/);
  return { cargo: resto.join(" ").trim() || cargoPorDefecto, nombre: primera.trim() };
}

/**
 * Cabecera de una oficina en dos líneas: el responsable (elevado con el padrón a
 * "CPC. SAUL QUISPE CHIPANA", como se encabeza un documento firmado) arriba y su
 * cargo/oficina debajo. Mismo criterio que la siembra del paso A8, para que el
 * paso, la previa y el .docx no discrepen. Si el nombre de la oficina ya trae
 * "JEFATURA", no se antepone "Jefe de la …" (quedaría repetido).
 */
type OficinaCabecera = {
  id?: string;
  nombre: string;
  responsable_nombre: string | null;
  responsable_cargo: string | null;
};

/** Jefe de una oficina, tal como se registra en Configuración → Usuarios. */
export type JefeDeOficina = { nombre: string; cargo: string };

export function cabeceraDeOficina(
  oficina: OficinaCabecera | null,
  personas: Persona[],
  jefes?: Map<string, JefeDeOficina>,
): string {
  // Fuente ÚNICA del responsable: el jefe asignado a la oficina en Configuración
  // → Usuarios. Así el dato se registra una sola vez (la persona ya existe como
  // usuario). El `responsable_*` de texto libre de la oficina (Áreas) queda solo
  // como respaldo para jefes que no tienen cuenta en la app.
  const jefe = oficina?.id ? jefes?.get(oficina.id) : undefined;
  const responsableNombre = jefe?.nombre ?? oficina?.responsable_nombre ?? null;
  const cargo = (jefe?.cargo || oficina?.responsable_cargo || "").trim();
  const nombre = nombreParaFirma(responsableNombre, personas);
  if (!nombre) return "";
  const nombreOficina = oficina?.nombre ?? "";
  // No se antepone "Jefe de la …" cuando el nombre de la oficina YA denota el
  // rol: las que llevan "JEFATURA" o son una "… ENCARGADA/ENCARGADO DE …" (p. ej.
  // "DEPENDENCIA ENCARGADA DE CONTRATACIONES"). Ahí "Jefe de la" sobra.
  const nombreYaEsRol = /\b(JEFATURA|ENCARGAD[AO])\b/i.test(nombreOficina);
  const rol = cargo && !nombreYaEsRol ? `${cargo} de la ${nombreOficina}` : nombreOficina;
  return [nombre, rol].filter(Boolean).join("\n");
}

/**
 * Resuelve el valor guardado en AL/DE (A8) a la cabecera del informe.
 *
 * Ahora esos campos guardan el NOMBRE de la oficina elegida en el select del
 * paso: se busca en el catálogo y se compone a su responsable. Los expedientes
 * anteriores guardaban el texto ya redactado a mano; si el valor no casa con
 * ninguna oficina, se devuelve tal cual, de modo que la migración no reescribe
 * lo ya firmado.
 */
export function resolverCabeceraDeOficina(
  valor: string,
  oficinas: OficinaCabecera[],
  personas: Persona[],
  jefes?: Map<string, JefeDeOficina>,
): string {
  if (!valor) return "";
  const oficina = oficinas.find((o) => o.nombre === valor);
  // Texto ya redactado a mano (expedientes anteriores): se respeta tal cual.
  if (!oficina) return valor;
  const cabecera = cabeceraDeOficina(oficina, personas, jefes);
  // La oficina elegida NO tiene responsable en Configuración. Antes esto
  // devolvía "" y el informe caía al respaldo (otra oficina distinta), así que
  // la elección de la DEC se perdía en silencio. Ahora se HONRA la elección: se
  // pone la oficina con el nombre en blanco —se verá como "—" y avisa de que
  // falta registrar a su responsable—, en vez de cambiarla por otra.
  return cabecera || `\n${oficina.nombre}`;
}

/**
 * Certificación de crédito presupuestario en una línea: número y monto.
 *
 * A7 tiene dos bloques —la CCP del ejercicio y los campos generales— y el
 * usuario suele llenar uno u otro. Se toma lo que haya, prefiriendo la CCP. El
 * número es "Número de certificación/nota" (`numero`) o el de la CCP; el monto
 * puede venir como número o como texto, así que se acepta cualquiera de los dos.
 */
export function certificacionCreditoDe(a7: Record<string, unknown>): string {
  const numero = str(a7, "numero_ccp") || str(a7, "numero");
  const monto = soles(numeroOTexto(a7.monto_ccp) ?? numeroOTexto(a7.monto));
  const partes = [numero ? `N° ${numero}` : "", monto].filter(Boolean);
  return partes.join(" — ");
}

/**
 * Línea «Incluida en el CMN» del informe (Art. 54.3): el estado real del CMN,
 * con el documento de modificación (Art. 42.3) cuando es una no programada.
 */
export function cmnDelA1(a1: Record<string, unknown>): string {
  const docMod = documentoModificacionCmnTexto(a1);
  if (a1.en_cmn === false) {
    return `NO — requiere modificación del CMN antes de aprobar (Art. 54.3)${
      docMod ? ` · consta la solicitud de modificación (${docMod})` : ""
    }`;
  }
  return [
    // Solo el número del CMN: la etiqueta "INCLUIDA EN EL CMN" ya dice qué es, así
    // que anteponer "Versión" era redundante.
    str(a1, "version_cmn"),
    str(a1, "periodo_programacion"),
    esNoProgramada(a1) && docMod ? `modificación solicitada mediante ${docMod}` : "",
  ]
    .filter(Boolean)
    .join(" · ") || (a1.en_cmn === true ? "SÍ" : "");
}

/**
 * "INFORME N° {número}" a partir de lo guardado en A8, que trae SOLO el número
 * (el "INFORME N° " es el prefijo fijo del campo). Tolera los datos antiguos que
 * lo guardaban completo: se retira el prefijo y se vuelve a poner, para que el
 * título nunca salga duplicado ("INFORME N° INFORME N° 001-…"). Vacío si no hay
 * número, para que el respaldo de Configuración tome el relevo.
 */
export function numeroInformeConPrefijo(raw: string): string {
  const num = (raw ?? "").replace(/^\s*informe\s*n(?:ro|[°ºo])?\.?\s*/i, "").trim();
  return num ? `INFORME N° ${num}` : "";
}

/** Un valor que puede llegar como número o como cadena, o null si no hay. */
function numeroOTexto(v: unknown): number | string | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

export type ResultadoInforme =
  | { datos: DatosInformeAprobacion; nomenclatura: string }
  | { error: string; status: number };

/**
 * Datos del informe, o el motivo por el que no procede emitirlo.
 *
 * Toma la ficha de la necesidad y los pasos A1, A3, A4, A5, A6, A7 y A8. Lo que
 * aún no esté registrado sale vacío y el compositor lo pinta con guion: en un
 * documento que se lleva a firmar, un hueco visible dice "falta esto".
 *
 * Los contratos menores devuelven 409: el Título VI, Cap. I (Arts. 226-229) no
 * exige aprobar el expediente y no hay convocatoria, así que el sustento legal
 * entero del informe —Arts. 54 y 63— no les corresponde. Generarlo produciría
 * papel que nadie tiene que firmar.
 */
export async function armarInformeAprobacion(
  usuario: { accessToken: string },
  id: string,
  /** Nombre completo del usuario en sesión que genera el informe. */
  elaboradoPor?: string | null,
): Promise<ResultadoInforme> {
  const filas = await supabaseUserRest<ProcesoRow[]>(
    usuario.accessToken,
    `procurement_processes?id=eq.${id}` +
      `&select=nomenclature,entity,status,procedure_type,valor_estimado,amount,necesidad_id,hitos`,
  );
  const proceso = filas[0];
  if (!proceso) return { error: "Expediente no encontrado", status: 404 };

  if (proceso.procedure_type === "contrato_menor") {
    return {
      error:
        "Los contratos menores no requieren aprobación del expediente de contratación: " +
        "el Título VI, Capítulo I del Reglamento (Arts. 226-229) no la exige y no hay " +
        "convocatoria. Este informe se apoya en los Arts. 54 y 63, que no les aplican.",
      status: 409,
    };
  }

  const hitos = proceso.hitos ?? {};
  const a1 = hitos.A1?.data ?? {};
  const a3 = hitos.A3?.data ?? {};
  const a4 = hitos.A4?.data ?? {};
  const a5 = hitos.A5?.data ?? {};
  const a6 = hitos.A6?.data ?? {};
  const a7 = hitos.A7?.data ?? {};
  const a8 = hitos.A8?.data ?? {};

  const hoy = new Date();
  const year = hoy.getFullYear();

  // Cuatro lecturas independientes lanzadas YA para que corran en PARALELO: la
  // necesidad (solo depende del proceso) y entidad/oficinas/perfiles (globales).
  // Se hace `await` más abajo, donde cada una se usa; arrancarlas aquí evita
  // cuatro round-trips encadenados a Supabase por cada descarga del informe.
  const necesidadP: Promise<NecesidadRow[]> = proceso.necesidad_id
    ? supabaseUserRest<NecesidadRow[]>(
        usuario.accessToken,
        `necesidades?id=eq.${proceso.necesidad_id}` +
          `&select=nombre,area_usuaria,cui,monto_estimado,tipo_proceso_seleccion`,
      ).catch(() => [])
    : Promise.resolve([]);
  const instP = supabaseRest<InstitucionRow[]>(
    "entity_settings?id=eq.default&select=city,manager_degree,manager_full_name,manager_position," +
      "aga_degree,aga_full_name,aga_position&limit=1",
  ).catch(() => []);
  const oficinasP = supabaseRest<
    {
      id: string;
      nombre: string;
      sufijo: string | null;
      ancho: number | null;
      responsable_nombre: string | null;
      responsable_cargo: string | null;
      gestiona_contrataciones: boolean | null;
    }[]
  >(
    `expedientes_oficinas?year=eq.${year}` +
      `&select=id,nombre,sufijo,ancho,responsable_nombre,responsable_cargo,gestiona_contrataciones`,
  ).catch(() => []);
  const perfilesP = supabaseRest<
    {
      nombre_completo: string | null;
      grado_academico: string | null;
      cargo: string | null;
      oficina_id: string | null;
      es_jefe: boolean | null;
    }[]
  >(
    "profiles?select=nombre_completo,grado_academico,cargo,oficina_id,es_jefe&nombre_completo=not.is.null",
  ).catch(() => []);

  // El objeto y el área usuaria son de la FICHA: el expediente no los guarda.
  const necesidad: NecesidadRow | null = (await necesidadP)[0] ?? null;

  // Ciudad de la fecha y GERENTE de la entidad (para la ATENCIÓN). Con clave de
  // servicio: `entity_settings` solo lo ve un admin por RLS, pero quien redacta el
  // informe es la DEC. El gerente NO está en `profiles` —en una municipalidad
  // distrital no usa la aplicación—, sino en la ficha de la entidad.
  const inst = await instP;

  // ATENCIÓN = AGA de la entidad (Configuración → Municipalidad), compuesto como
  // "grado + nombre\ncargo", igual que la cabecera. Si no se registró el AGA
  // aparte, se cae al gerente (en un gobierno local la Ley los identifica, Art.
  // 25.1.b). Es el RESPALDO cuando el paso A8 no trae su propia ATENCIÓN escrita.
  const componerAutoridad = (
    grado: string | null,
    nombre: string | null,
    cargo: string | null,
  ): string => {
    const n = (nombre ?? "").trim();
    return n ? `${conGradoAcademico(grado, n)}\n${(cargo ?? "").trim()}`.trim() : "";
  };
  const aga = componerAutoridad(inst[0]?.aga_degree, inst[0]?.aga_full_name, inst[0]?.aga_position);
  const gerente = componerAutoridad(
    inst[0]?.manager_degree,
    inst[0]?.manager_full_name,
    inst[0]?.manager_position,
  );

  // Catálogo de oficinas del ejercicio (Configuración → Oficinas). Una sola
  // lectura sirve para todo: derivar la dependencia y la OGA de los respaldos, y
  // resolver la oficina que AL/DE guardan por su nombre.
  const oficinasTodas = await oficinasP;

  // Dependencia que gestiona contrataciones: de su contador de INFORME sale el
  // número sugerido (y es el respaldo del DE cuando no hay una oficina con el
  // nombre genérico de la DEC).
  const oficina = oficinasTodas.find((o) => o.gestiona_contrataciones) ?? null;
  // Oficina del DE de respaldo: la llamada "DEPENDENCIA ENCARGADA DE
  // CONTRATACIONES" (el default que ofrece el paso A8) si existe; si no, la que
  // gestiona contrataciones. Antes el respaldo era SIEMPRE esta última, así que
  // la previa mostraba una oficina distinta de la que el formulario proponía.
  const oficinaRemitente =
    oficinasTodas.find((o) => o.nombre.trim().toUpperCase() === NOMBRE_DEC_GENERICO) ?? oficina;

  // Padrón + jefes (Configuración → Usuarios). El padrón eleva "QUISPE CHIPANA
  // SAUL" a "CPC. SAUL QUISPE CHIPANA", como se encabeza un documento firmado. El
  // mapa de jefes es la FUENTE ÚNICA del responsable de cada oficina: el usuario
  // marcado como jefe de esa oficina. Así no se duplica el dato con Áreas.
  const perfiles = await perfilesP;
  const personas: Persona[] = perfiles
    .filter((p) => p.nombre_completo)
    .map((p) => ({ nombre: p.nombre_completo as string, grado: p.grado_academico ?? undefined }));
  const jefePorOficina = new Map<string, JefeDeOficina>();
  for (const p of perfiles) {
    if (p.es_jefe && p.oficina_id && p.nombre_completo && !jefePorOficina.has(p.oficina_id)) {
      jefePorOficina.set(p.oficina_id, { nombre: p.nombre_completo, cargo: (p.cargo ?? "").trim() });
    }
  }

  // Oficina inmediata superior de la que gestiona contrataciones —la OGA—, a
  // quien la DEC eleva la solicitud: es el AL de respaldo. Se busca por su nombre
  // (con o sin el sufijo "JEFATURA") y con responsable —de Usuarios o de Áreas—
  // (evita una fila vacía).
  const oga =
    oficinasTodas.find(
      (o) =>
        /^OFICINA GENERAL DE ADMINISTRACION/i.test(o.nombre) &&
        ((o.responsable_nombre ?? "").trim() || jefePorOficina.has(o.id)),
    ) ?? null;

  // DE (remitente) de respaldo: la oficina que el paso propone por defecto,
  // resuelta a su responsable (o a su nombre si aún no tiene uno registrado, para
  // no caer a otra oficina distinta).
  const remitenteConfig = resolverCabeceraDeOficina(
    oficinaRemitente?.nombre ?? "",
    oficinasTodas,
    personas,
    jefePorOficina,
  );
  // A (destinatario): responsable de la OGA, elevado.
  const destinatarioConfig = cabeceraDeOficina(oga, personas, jefePorOficina);

  // Número del informe: siguiente correlativo del tipo INFORME de esa oficina.
  // Es una SUGERENCIA —no consume el correlativo hasta emitir el documento—, así
  // que aquí solo se LEE el contador, nunca se incrementa.
  let numeroInformeConfig = "";
  if (oficina) {
    const counters = await supabaseRest<{ siguiente: number | null; sufijo: string | null }[]>(
      `expedientes_doc_counters?oficina_id=eq.${oficina.id}&tipo=eq.INFORME&year=eq.${year}&select=siguiente,sufijo&limit=1`,
    ).catch(() => []);
    numeroInformeConfig = formatDocumentNumber({
      ancho: oficina.ancho ?? 3,
      siguiente: counters[0]?.siguiente ?? 1,
      sufijo: counters[0]?.sufijo || oficina.sufijo,
      tipo: "INFORME",
      year,
    });
  }

  // Régimen: la causal del Art. 55 acreditada en A1 manda; si no la hay, lo que
  // anticipó la ficha. Mismo criterio que el resto de la aplicación.
  const causal = str(a1, "causal_art_55");
  const esNoCompetitivo =
    familiaProcedimiento(necesidad?.tipo_proceso_seleccion, causal) === "no_competitivo";
  const aprobador = aprobadorNoCompetitivo(causal);

  // El TIPO se muestra con el proceso ESPECÍFICO de A4 (`var_a_proceso`, p. ej.
  // "Licitación Pública para bienes"), igual que el Anexo N° 2 (C11) y el export
  // de la Estrategia. Antes salía el genérico del Art. 54 ("Licitación Pública"),
  // así que el informe discrepaba del Anexo N° 2. Se cae al genérico en
  // expedientes antiguos sin `var_a_proceso`.
  const procedimiento = str(a4, "var_a_procedimiento");
  const etiquetaProceso = capitalizarProceso(
    str(a4, "var_a_proceso") || labelProcedimiento(procedimiento) || procedimiento,
  );
  const nomenclatura = str(a4, "var_a_nomenclatura");
  const tipoProcedimiento = [etiquetaProceso, nomenclatura]
    .filter(Boolean)
    .join(" Nº ")
    .toUpperCase();

  const modalidad = str(a4, "var_h_modalidad_pago");
  const modalidadLabel =
    OPCIONES_MODALIDAD_PAGO.find((o) => o.value === modalidad)?.label ?? modalidad;

  const objeto = [
    necesidad?.nombre ?? proceso.nomenclature,
    necesidad?.cui ? `CON CUI N° ${necesidad.cui}.` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return {
    nomenclatura: proceso.nomenclature,
    datos: {
      areaUsuaria: (necesidad?.area_usuaria ?? "").trim(),
      // Certificación de crédito presupuestario: número + monto, en una línea
      // ("N° 6119 — S/. 77,700.60"). Antes solo traía el monto y lo leía con
      // `str`, que devuelve "" para un número: el monto se guarda como número, no
      // como texto, así que la fila salía vacía teniendo el dato. Se prefiere la
      // CCP sobre los campos generales, pero se cae a estos cuando el usuario
      // llenó el bloque general (que es el caso habitual).
      certificacionCredito: certificacionCreditoDe(a7),
      // Art. 54.3: lo exigido es el CMN, no el PAC.
      cmn: cmnDelA1(a1),
      // Literal b): solo cuando corresponda; vacío se omite de la tabla.
      compatibilizacion: str(a3, "compatibilizacion") || str(a4, "var_c_viabilidad"),
      // ATENCIÓN: el desplegable de A8 resuelto (igual que A6) —"aga"→AGA,
      // "gerente"→gerente, ambos de Configuración → Municipalidad—. Compatibilidad
      // hacia atrás: un expediente antiguo con texto libre tecleado a mano se
      // imprime tal cual; vacío cae a la AGA (con el gerente de respaldo). Así la
      // línea aparece en el informe aunque no se haya llenado la cabecera en A8.
      copia: (() => {
        const sel = str(a8, "atencion");
        const texto = sel === "gerente" ? gerente : sel === "aga" ? aga : sel || aga || gerente;
        return texto ? desdeCampo(texto, "Gerencia de la entidad") : null;
      })(),
      // Literal e): el documento de designación, que emite A6.
      // Literal e): el documento de designación. Se antepone el tipo según el
      // evaluador (oficial de compra → "Memorándum N° "; comité/jurado → "INFORME
      // N° "), igual que el Anexo N° 2. El campo de A6 guarda solo el número.
      designacionEvaluadores: str(a6, "documento_designacion")
        ? `${prefijoDesignacion(str(a6, "tipo_evaluador") || str(a4, "var_e_tipo_evaluador"))}${soloNumeroDesignacion(str(a6, "documento_designacion"))}`
        : "",
      // A (destinatario): la oficina elegida en el campo AL de A8, resuelta a su
      // responsable; si está vacío, la OGA (oficina inmediata superior de la que
      // gestiona contrataciones) de Configuración → Oficinas.
      destinatario: desdeCampo(
        resolverCabeceraDeOficina(str(a8, "autoridad"), oficinasTodas, personas, jefePorOficina) ||
          destinatarioConfig,
        "Autoridad de la gestión administrativa",
      ),
      // DE: la oficina elegida en A8, resuelta a su jefatura; si está vacío, la
      // dependencia que gestiona contrataciones (Configuración → Oficinas).
      emisor: desdeCampo(
        resolverCabeceraDeOficina(str(a8, "remitente"), oficinasTodas, personas, jefePorOficina) ||
          remitenteConfig,
        "Jefe de la Oficina de Abastecimiento",
      ),
      esNoCompetitivo,
      fecha: `${hoy.getDate()} de ${MESES[hoy.getMonth()]} del ${hoy.getFullYear()}`,
      lugar: (inst[0]?.city ?? "").trim(),
      modalidadPago: modalidadLabel.toUpperCase(),
      noCompetitivo: esNoCompetitivo
        ? {
            aprobador: aprobador.label,
            articuloAprobador: aprobador.articulo,
            causal: textoCausalArt55(causal),
          }
        : null,
      // El modelo escribe "S/N" cuando la contratación no tiene ítem en el PAC.
      numeroPac: str(a1, "referencia_pac") || "S/N",
      // El campo del paso guarda SOLO el número (el "INFORME N° " es un prefijo
      // fijo del campo). Se antepone al imprimir, tolerando datos antiguos que lo
      // traían completo (se retira y se vuelve a poner). Si no hay, el siguiente
      // correlativo sugerido de Configuración → Numeración (que ya viene completo).
      numeroInforme: numeroInformeConPrefijo(str(a8, "numero_informe")) || numeroInformeConfig,
      objeto: objeto.toUpperCase(),
      referencia: tipoProcedimiento,
      // Literal a): el requerimiento final "indicando si se encuentra estandarizado".
      requerimientoEstandarizado:
        str(a3, "estandarizado") === "si" || a3.estandarizado === true
          ? "SÍ (ficha de homologación o ficha técnica vigente)"
          : str(a3, "estandarizado") || "NO",
      tipoProcedimiento,
      // La cuantía la fija A5 con su "Cuantía actualizada" (Art. 53.1) y es la
      // BASE; si el expediente es antiguo y no la trae, el valor estimado del
      // proceso (que A5 también persiste) y, en último caso, la estimación de la ficha.
      valorCuantia: soles(
        cuantiaDeA5(a5) ?? proceso.valor_estimado ?? proceso.amount ?? necesidad?.monto_estimado,
      ),
      // Art. 54.4: si viene de un desierto, la nueva convocatoria solo necesita
      // aprobación cuando hay que modificar documentos del expediente.
      vieneDeDesierto: proceso.status === "desierto",
      // Art. 25.2 Ley: si la aprobación es por facultad delegada, la resolución
      // que la delega (con su fecha en formato largo). El informe la cita.
      delegacion:
        a8.delegacion === true
          ? { resolucion: str(a8, "resolucion_delegacion"), fecha: fechaLarga(str(a8, "fecha_delegacion")) }
          : null,
      elaboradoPor,
    },
  };
}

/** "INFORME N° 001-…" → "001-…": el número sin su prefijo, como lo guarda A8. */
function soloNumeroInforme(completo: string): string {
  return completo.replace(/^\s*informe\s*n(?:ro|[°ºo])?\.?\s*/i, "").trim();
}

/**
 * Consume y CONGELA el número de un documento tipo INFORME de la DEC la primera
 * vez que se EMITE (descarga). Sirve para el informe de aprobación (A8 ·
 * `numero_informe`) y la solicitud de certificación (A7 · `numero_solicitud`):
 * ambos toman su correlativo de la MISMA serie INFORME de la DEC, así que se
 * numeran con el mismo mecanismo y no chocan entre sí.
 *
 * Hasta emitirlo el número es una sugerencia; al emitir se toma el correlativo de
 * forma ATÓMICA (RPC `consumir_correlativo`), así dos documentos nunca comparten
 * número, y se congela en el hito (`{campo}` + `{campo}_emitido`) para que las
 * descargas posteriores no vuelvan a consumir. Si la DEC escribió un número PROPIO
 * (distinto de la sugerencia), se respeta: se congela tal cual, sin tocar el
 * contador.
 *
 * Idempotente (si ya está emitido, no hace nada) y se llama SOLO desde la descarga,
 * nunca desde la vista previa —que no debe consumir correlativos—.
 */
/**
 * Resuelve la oficina y el counter con los que numerar un documento: primero la
 * oficina del usuario (si la hay y tiene counter del tipo/año), y si no, la DEC
 * (`gestiona_contrataciones`). Devuelve `null` si ninguna sirve.
 */
async function resolverNumeracion(
  oficinaId: string | null | undefined,
  tipo: "INFORME" | "MEMORANDUM",
  year: number,
): Promise<{ oficina: { id: string; ancho: number | null; sufijo: string | null }; counter: { siguiente: number | null; sufijo: string | null } } | null> {
  type Ofs = { id: string; ancho: number | null; sufijo: string | null };
  type Ctr = { siguiente: number | null; sufijo: string | null };

  const probar = async (id: string): Promise<{ oficina: Ofs; counter: Ctr } | null> => {
    const [ofs, cs] = await Promise.all([
      supabaseRest<Ofs[]>(`expedientes_oficinas?id=eq.${id}&year=eq.${year}&select=id,ancho,sufijo&limit=1`).catch(() => []),
      supabaseRest<Ctr[]>(
        `expedientes_doc_counters?oficina_id=eq.${id}&tipo=eq.${encodeURIComponent(tipo)}&year=eq.${year}&select=siguiente,sufijo&limit=1`,
      ).catch(() => []),
    ]);
    if (!ofs[0] || !cs[0]) return null;
    return { oficina: ofs[0], counter: cs[0] };
  };

  if (oficinaId) {
    const r = await probar(oficinaId);
    if (r) return r;
  }
  const dec = await supabaseRest<Ofs[]>(
    `expedientes_oficinas?gestiona_contrataciones=eq.true&year=eq.${year}&select=id,ancho,sufijo&limit=1`,
  ).catch(() => []);
  if (dec[0]) {
    const r = await probar(dec[0].id);
    if (r) return r;
  }
  return null;
}

/**
 * Consume y CONGELA el número de un documento de la DEC la primera vez que se
 * EMITE (descarga). Sirve para:
 *   - A8 (`numero_informe`) y A7 (`numero_solicitud`): serie INFORME.
 *   - A6 (`documento_designacion`): serie MEMORANDUM (oficial de compra) o
 *     INFORME (comité/jurado), según el `tipo_evaluador` guardado en el hito.
 *
 * La oficina cuya serie se aplica es, por este orden, la del usuario autenticado
 * (`opts.oficinaId`) si la tiene configurada en Numeración para ese tipo, y si no
 * la DEC. Así cada oficina numera con su propia serie («Empieza en» + «Sigla»).
 *
 * Hasta emitirlo el número es una sugerencia; al emitir se toma el correlativo de
 * forma ATÓMICA (RPC `consumir_correlativo`), así dos documentos nunca comparten
 * número, y se congela en el hito (`{campo}` + `{campo}_emitido`) para que las
 * descargas posteriores no vuelvan a consumir. Si la DEC escribió un número PROPIO
 * (distinto de la sugerencia), se respeta: se congela tal cual, sin tocar el
 * contador.
 *
 * Idempotente (si ya está emitido, no hace nada) y se llama SOLO desde la descarga,
 * nunca desde la vista previa —que no debe consumir correlativos—.
 */
export async function emitirNumeroInforme(
  usuario: { accessToken: string },
  id: string,
  hito: "A6" | "A7" | "A8" = "A8",
  campo = "numero_informe",
  year: number = new Date().getFullYear(),
  opts: { oficinaId?: string | null; tipo?: "INFORME" | "MEMORANDUM" } = {},
): Promise<void> {
  const flag = `${campo}_emitido`;
  const filas = await supabaseUserRest<{ hitos: HitosMap | null }[]>(
    usuario.accessToken,
    `procurement_processes?id=eq.${id}&select=hitos`,
  ).catch(() => []);
  const hitos = filas[0]?.hitos ?? {};
  const data = (hitos[hito]?.data ?? {}) as Record<string, unknown>;
  if (data[flag] === true) return; // ya emitido: idempotente

  // Tipo de documento: el explícito; si no, A7/A8 → INFORME y A6 → según el
  // tipo de evaluador guardado (oficial de compra MEMORANDUM, comité/jurado INFORME).
  let tipo: "INFORME" | "MEMORANDUM" = opts.tipo ?? "INFORME";
  if (!opts.tipo && hito === "A6") {
    tipo = String(data.tipo_evaluador ?? "") === "oficial_compra" ? "MEMORANDUM" : "INFORME";
  }

  const resuelto = await resolverNumeracion(opts.oficinaId ?? null, tipo, year);
  if (!resuelto) return; // sin oficina ni counter: se deja la sugerencia sin congelar
  const { oficina, counter } = resuelto;
  const ancho = oficina.ancho ?? 3;
  const sufijo = counter.sufijo || oficina.sufijo;
  // A6 guarda el número con prefijo memorándum/informe: la normalización que
  // limpia ambos. A7/A8 solo traen «INFORME N°» y basta con la otra.
  const normalizar = hito === "A6" ? soloNumeroDesignacion : soloNumeroInforme;

  const guardado = typeof data[campo] === "string" ? normalizar(data[campo] as string) : "";
  const sugerido = normalizar(
    formatDocumentNumber({ siguiente: counter.siguiente ?? 1, ancho, sufijo, tipo, year }),
  );
  // La UI SEMBRÓ el campo con la propuesta y guardó ese valor en `${campo}_semilla`.
  // Si el valor guardado sigue siendo esa propuesta sin tocar, es una sugerencia
  // AUTOMÁTICA (no un número tecleado a mano): se consume el correlativo VIGENTE
  // aunque la serie haya avanzado —p. ej. porque el informe de A8 se descargó
  // primero—, para no congelar un número obsoleto que chocaría con el otro documento.
  const semilla =
    typeof data[`${campo}_semilla`] === "string" ? normalizar(data[`${campo}_semilla`] as string) : null;
  const esPropuestaSinTocar = semilla !== null && guardado !== "" && guardado === semilla;

  let numeroFinal = guardado;
  // Si la DEC escribió un número PROPIO (no vacío, distinto de la sugerencia y no la
  // propuesta auto-sembrada), se respeta y NO se consume el contador. En otro caso
  // (vacío, aceptó la sugerencia, o es la propuesta sin tocar) se consume de verdad.
  if (guardado === "" || esPropuestaSinTocar || guardado === sugerido) {
    const consumido = await supabaseRest<number | null>("rpc/consumir_correlativo", {
      method: "POST",
      body: JSON.stringify({ p_oficina: oficina.id, p_tipo: tipo, p_year: year }),
    }).catch(() => null);
    if (typeof consumido !== "number") return; // no se pudo consumir; se deja la sugerencia
    numeroFinal = normalizar(
      formatDocumentNumber({ siguiente: consumido, ancho, sufijo, tipo, year }),
    );
  }

  const dataNuevo = { ...data, [campo]: numeroFinal, [flag]: true };
  const hitosNuevo = { ...hitos, [hito]: { ...(hitos[hito] ?? { status: "pendiente" }), data: dataNuevo } };
  await supabaseUserRest(usuario.accessToken, `procurement_processes?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ hitos: hitosNuevo }),
  }).catch(() => undefined);
}
