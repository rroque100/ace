// Padrón de personal (tabla `personal`): un directorio de servidores de la
// entidad que se carga desde el .xls del SIGA y se usa para ELEGIR personas
// —nombre + DNI + cargo/unidad— al designar evaluadores, nombrar responsables o
// firmar documentos, sin teclearlas a mano.
//
// Este módulo es el único sitio donde se conoce la forma de una fila del .xls y
// cómo se traduce a nuestro modelo: lo comparten la ruta de importación, la de
// búsqueda y la pestaña de Configuración, para que el mapeo no se duplique.

/** Una persona del padrón, tal como se guarda y se devuelve al cliente. */
export type Personal = {
  id?: string;
  /** "empleado" del SIGA: la clave estable con la que se reconcilia al reimportar. */
  codigo: string;
  documento: string | null;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
  nombres: string | null;
  /** "PATERNO MATERNO, NOMBRES", precalculado para buscar y firmar. */
  nombreCompleto: string;
  tipoEmpleado: string | null;
  /** "A" activo / "I" inactivo. */
  estado: string | null;
  estadoCivil: string | null;
  sexo: string | null;
  gradoInst: string | null;
  centroCosto: string | null;
  /** Sigla de la unidad (nombre_cc): OSLIJ, OTI, UA… */
  unidad: string | null;
  codigoProf: string | null;
  profesion: string | null;
  colegiatura: string | null;
  fechaIngreso: string | null;
};

/** Fila de la tabla `personal` en snake_case (lo que devuelve PostgREST). */
export type PersonalRow = {
  id: string;
  codigo: string;
  documento: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  nombres: string | null;
  nombre_completo: string | null;
  tipo_empleado: string | null;
  estado: string | null;
  estado_civil: string | null;
  sexo: string | null;
  grado_inst: string | null;
  centro_costo: string | null;
  unidad: string | null;
  codigo_prof: string | null;
  profesion: string | null;
  colegiatura: string | null;
  fecha_ingreso: string | null;
};

/**
 * Nombre completo en orden natural: "NOMBRES PATERNO MATERNO" (col. J + H + I del
 * .xls, en ese orden). Es como se lee de corrido y como los usa el documento de
 * designación de A6; coincide además con el orden de `profiles.nombre_completo`
 * (ver `lib/nombres.ts`, que reconcilia ambos órdenes al firmar). Sin apellidos,
 * cae a solo nombres; sin nombres, a solo apellidos.
 */
export function nombreCompletoPersonal(p: {
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
  nombres?: string | null;
}): string {
  const nombres = (p.nombres ?? "").trim();
  const apellidos = [p.apellidoPaterno, p.apellidoMaterno]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return [nombres, apellidos].filter(Boolean).join(" ");
}

// Alias de cabecera del .xls, normalizados. El archivo del SIGA trae nombres
// fijos (empleado, apellido_paterno…), pero aceptamos variantes por si RR.HH.
// exporta con otra plantilla.
const ALIAS: Record<keyof Omit<Personal, "id" | "nombreCompleto">, string[]> = {
  codigo: ["empleado", "codigo", "codigo_empleado", "cod_empleado"],
  documento: ["docum_ident", "documento", "dni", "nro_documento", "num_documento"],
  apellidoPaterno: ["apellido_paterno", "ape_paterno", "paterno"],
  apellidoMaterno: ["apellido_materno", "ape_materno", "materno"],
  nombres: ["nombres", "nombre"],
  tipoEmpleado: ["tipo_empleado", "tipo"],
  estado: ["estado"],
  estadoCivil: ["estado_civil", "est_civil"],
  sexo: ["sexo_empleado", "sexo"],
  gradoInst: ["grado_inst", "grado_instruccion", "grado"],
  centroCosto: ["centro_costo", "ccosto", "cod_centro_costo"],
  unidad: ["nombre_cc", "unidad", "centro_costo_nombre"],
  codigoProf: ["codigo_prof", "cod_prof"],
  profesion: ["nombre_prof", "profesion"],
  colegiatura: ["nro_colegiatura", "colegiatura", "nro_colegio"],
  fechaIngreso: ["fecha_ingreso", "f_ingreso"],
};

/** Normaliza una cabecera para comparar sin tildes ni mayúsculas ni símbolos. */
export function normalizarCabeceraPersonal(h: string): string {
  return String(h ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Mapa cabecera→índice de columna, a partir de la fila de cabeceras del .xls. */
export function mapaCabecerasPersonal(headerRow: unknown[]): Map<keyof typeof ALIAS, number> {
  const normalized = headerRow.map((c) => normalizarCabeceraPersonal(String(c ?? "")));
  const map = new Map<keyof typeof ALIAS, number>();
  (Object.keys(ALIAS) as (keyof typeof ALIAS)[]).forEach((key) => {
    const idx = normalized.findIndex((n) => ALIAS[key].includes(n));
    if (idx !== -1) map.set(key, idx);
  });
  return map;
}

function celda(value: unknown, max = 200): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, max) : null;
}

/**
 * Traduce una fila del .xls (según el mapa de cabeceras) a una `Personal`.
 * Devuelve `null` si la fila no tiene código de empleado: sin la clave de
 * negocio no se puede reconciliar, así que no es una persona utilizable.
 */
export function filaAPersonal(
  fila: unknown[],
  mapa: Map<keyof typeof ALIAS, number>,
): Personal | null {
  const val = (key: keyof typeof ALIAS, max = 200): string | null => {
    const idx = mapa.get(key);
    return idx === undefined ? null : celda(fila[idx], max);
  };
  const codigo = val("codigo", 40);
  if (!codigo) return null;

  const apellidoPaterno = val("apellidoPaterno", 100);
  const apellidoMaterno = val("apellidoMaterno", 100);
  const nombres = val("nombres", 120);
  return {
    codigo,
    documento: val("documento", 20),
    apellidoPaterno,
    apellidoMaterno,
    nombres,
    nombreCompleto: nombreCompletoPersonal({ apellidoPaterno, apellidoMaterno, nombres }),
    tipoEmpleado: val("tipoEmpleado", 4),
    estado: val("estado", 4),
    estadoCivil: val("estadoCivil", 4),
    sexo: val("sexo", 4),
    gradoInst: val("gradoInst", 8),
    centroCosto: val("centroCosto", 40),
    unidad: val("unidad", 60),
    codigoProf: val("codigoProf", 40),
    profesion: val("profesion", 120),
    colegiatura: val("colegiatura", 40),
    fechaIngreso: val("fechaIngreso", 40),
  };
}

/** Objeto para PostgREST (snake_case) a partir de una `Personal`. */
export function personalACelda(p: Personal): Record<string, unknown> {
  return {
    codigo: p.codigo,
    documento: p.documento,
    apellido_paterno: p.apellidoPaterno,
    apellido_materno: p.apellidoMaterno,
    nombres: p.nombres,
    nombre_completo: p.nombreCompleto,
    tipo_empleado: p.tipoEmpleado,
    estado: p.estado,
    estado_civil: p.estadoCivil,
    sexo: p.sexo,
    grado_inst: p.gradoInst,
    centro_costo: p.centroCosto,
    unidad: p.unidad,
    codigo_prof: p.codigoProf,
    profesion: p.profesion,
    colegiatura: p.colegiatura,
    fecha_ingreso: p.fechaIngreso,
    actualizado_en: new Date().toISOString(),
  };
}

/** Fila de PostgREST → `Personal` para el cliente. */
export function filaDePersonalRow(r: PersonalRow): Personal {
  return {
    id: r.id,
    codigo: r.codigo,
    documento: r.documento,
    apellidoPaterno: r.apellido_paterno,
    apellidoMaterno: r.apellido_materno,
    nombres: r.nombres,
    nombreCompleto: r.nombre_completo ?? nombreCompletoPersonal({
      apellidoPaterno: r.apellido_paterno,
      apellidoMaterno: r.apellido_materno,
      nombres: r.nombres,
    }),
    tipoEmpleado: r.tipo_empleado,
    estado: r.estado,
    estadoCivil: r.estado_civil,
    sexo: r.sexo,
    gradoInst: r.grado_inst,
    centroCosto: r.centro_costo,
    unidad: r.unidad,
    codigoProf: r.codigo_prof,
    profesion: r.profesion,
    colegiatura: r.colegiatura,
    fechaIngreso: r.fecha_ingreso,
  };
}

/** ¿La persona figura como activa en el padrón? (estado "A"). */
export function personalActivo(p: { estado?: string | null }): boolean {
  return (p.estado ?? "").trim().toUpperCase() === "A";
}
