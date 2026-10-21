// Cálculo automático de fechas del cronograma (o) del Art. 46.1.o).
//
// A partir de la fecha de inicio de la PRIMERA actividad, encadena las fechas de
// todas: cada actividad empieza el día hábil siguiente al fin de la anterior y
// dura, por defecto, los días hábiles de DURACION_DEFAULT. Es un PUNTO DE
// PARTIDA editable: los plazos definitivos los fija el Reglamento de la Ley
// N° 32069 por procedimiento, así que la DEC ajusta.
//
// Sobre el encadenado se imponen los plazos que sí son reglas duras: el mínimo
// de 22 días hábiles entre convocatoria y ofertas (Art. 64.1), el registro de
// participantes como rango (Art. 65.2), la duración de las consultas (Art. 66.1)
// y el consentimiento de la buena pro (Art. 82.1 + Art. 304).
//
// Se trabaja en días HÁBILES: se omiten sábados, domingos y los feriados que la
// entidad registre en Configuración. Fechas en formato ISO "YYYY-MM-DD".

import { type DiasCronograma, DIAS_CRONOGRAMA_DEFAULT } from "./cronograma-dias";
import {
  type ActividadCronograma,
  CRONOGRAMA_SEGUN_BASES,
  DIAS_HABILES_APELACION,
  esActividadSegunBases,
  esConvocatoria,
  esPresentacionOfertas,
  esRegistroParticipantes,
  MIN_HABILES_CONSULTAS,
  MIN_HABILES_CONVOCATORIA_OFERTAS,
  MIN_HABILES_INTEGRACION_OFERTAS,
} from "./estrategia-formato";

/** ¿Es la actividad de integración de (las) bases? */
function esIntegracionBases(actividad: string | undefined): boolean {
  // "Absolución e integración" es la etapa cuyo FIN es la fecha de integración de
  // bases, la que ancla el plazo del Art. 68.1 (integración → ofertas). Se aceptan
  // también los rótulos antiguos (la etapa unificada y la suelta).
  return /absoluci[oó]n e integraci[oó]n|integraci[oó]n de (las )?bases|consultas,?\s*observaciones e integraci[oó]n/i.test(
    actividad ?? "",
  );
}

// Duración por defecto (días hábiles) de las actividades que NO son configurables
// ni las fija la ley: casi todas de un día (inicio = fin). Las 4 editables por la
// entidad (aprobación del expediente, elaboración de bases, presentación de
// requisitos, suscripción del contrato) NO están aquí: las resuelve `duracionActividad`
// con los días de Configuración (ver `DiasCronograma`).
const DURACION_POR_CLAVE: ReadonlyArray<{ clave: RegExp; dias: number }> = [
  // Selección — un solo día (inicio = fin). La formulación de consultas (con su
  // plazo del Art. 66.1) es otra actividad distinta y conserva su duración.
  { clave: /convocatoria|solicitud de cotizaci/i, dias: 1 },
  { clave: /absoluci[oó]n e integraci[oó]n|absoluci[oó]n de consultas/i, dias: 1 },
  { clave: /integraci[oó]n de (las )?bases/i, dias: 1 },
  { clave: /presentaci[oó]n de (ofertas|cotizaci)/i, dias: 1 },
  { clave: /evaluaci[oó]n (y calificaci[oó]n)?|calificaci[oó]n de (ofertas|cotizaci)/i, dias: 1 },
  { clave: /lances|puja/i, dias: 1 },
  { clave: /otorgamiento de la buena pro/i, dias: 1 },
  // Ejecución contractual: no lleva fecha cierta (va "SEGÚN BASES"), este valor no
  // se usa para fechar; se conserva por compatibilidad.
  { clave: /ejecuci[oó]n contractual/i, dias: 30 },
];

/**
 * Días hábiles de una actividad. Los que la norma FIJA se derivan del
 * procedimiento; el resto son duraciones por defecto editables.
 *
 *  - Formulación de consultas y observaciones → Art. 66.1 (7 hábiles; 3 en las
 *    modalidades abreviadas).
 *  - Consentimiento de la buena pro → Art. 82.1 (se produce al día siguiente de
 *    vencido el plazo para apelar) + Art. 304 (8 hábiles en competitivos, 5 en
 *    abreviados/comparación de precios): por eso apelación + 1.
 */
/**
 * Umbral de la cuantía (S/) que separa el plazo de apelación —y con él el
 * consentimiento— en alto/bajo: ≥ umbral ⇒ 8 días hábiles de apelación; menor ⇒ 5.
 * (Art. 304). La cuantía sale de la "Cuantía actualizada" de A5.
 */
export const UMBRAL_APELACION_CUANTIA = 485_000;

export function duracionActividad(
  actividad: string | undefined,
  procedimiento?: string,
  cuantia?: number | null,
  dias: DiasCronograma = DIAS_CRONOGRAMA_DEFAULT,
): number {
  const a = (actividad ?? "").trim();
  if (!a) return 2;
  // Las 4 duraciones EDITABLES en Configuración (Reglamento no las fija): salen de
  // `dias`. La entidad las ajusta a su práctica; el defecto reproduce lo de antes.
  if (/aprobaci[oó]n del expediente/i.test(a)) return dias.aprobacionExpediente;
  if (/elaboraci[oó]n de las bases/i.test(a)) return dias.elaboracionBases;
  if (/presentaci[oó]n de requisitos/i.test(a)) return dias.presentacionRequisitos;
  if (/suscripci[oó]n del contrato/i.test(a)) return dias.suscripcionContrato;
  // "Consultas y observaciones" (o los rótulos antiguos "…e integración" / "Formulación
  // de consultas…"): dura el plazo mínimo de consultas del Art. 66.1 (7 días hábiles;
  // 3 en las abreviadas). La "Absolución e integración" que le sigue es corta (1 día)
  // y su FIN es la integración de bases desde la que cuenta el Art. 68.1.
  if (/^consultas y observaciones|consultas,?\s*observaciones e integraci[oó]n|formulaci[oó]n de consultas/i.test(a)) {
    return (procedimiento ? MIN_HABILES_CONSULTAS[procedimiento] : undefined) ?? 7;
  }
  if (/consentimiento de la buena pro/i.test(a)) {
    // Art. 82.1: la buena pro se consiente al día hábil SIGUIENTE de vencer el
    // plazo de apelación → apelación + 1. El plazo de apelación (Art. 304) se toma
    // de la CUANTÍA de A5 cuando se conoce (≥ 485 000 → 8; menor → 5) y, a falta de
    // ella, del plazo por procedimiento.
    const apelacion =
      cuantia != null && Number.isFinite(cuantia)
        ? cuantia >= UMBRAL_APELACION_CUANTIA
          ? 8
          : 5
        : (procedimiento ? DIAS_HABILES_APELACION[procedimiento] : undefined) ?? 8;
    return apelacion + 1;
  }
  return DURACION_POR_CLAVE.find((d) => d.clave.test(a))?.dias ?? 2;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Parte de FECHA de un valor que puede venir como "YYYY-MM-DD" o con hora. */
export const fechaDe = (v: string | undefined | null): string => (v ?? "").slice(0, 10);

/** Parte de HORA ("HH:mm") de un valor "YYYY-MM-DDTHH:mm", o "" si no la trae. */
function horaDe(v: string | undefined | null): string {
  const m = /T(\d{2}:\d{2})/.exec(v ?? "");
  return m ? m[1] : "";
}

/**
 * Ata las HORAS por defecto a las fechas ya calculadas, convención tipo SEACE:
 * cada actividad arranca a las 00:01 y termina a las 23:59, SALVO la primera, que
 * conserva la hora que la DEC puso en el anclaje. "SEGÚN BASES" no lleva hora.
 */
function atarHoras(filas: ActividadCronograma[], horaAncla: string): ActividadCronograma[] {
  let anclaPuesta = false;
  return filas.map((f) => {
    if (esActividadSegunBases(f.actividad)) return f;
    const ini = fechaDe(f.inicio);
    if (!ISO.test(ini)) return f;
    const inicio = anclaPuesta ? `${ini}T00:01` : `${ini}T${horaAncla}`;
    anclaPuesta = true;
    const fin = fechaDe(f.fin);
    return { ...f, inicio, fin: ISO.test(fin) ? `${fin}T23:59` : f.fin };
  });
}

/** ¿La fecha ISO es día NO hábil? Sábado, domingo o feriado registrado. */
function esNoHabil(fecha: Date, feriados: ReadonlySet<string>): boolean {
  const dow = fecha.getUTCDay();
  if (dow === 0 || dow === 6) return true;
  return feriados.has(fecha.toISOString().slice(0, 10));
}

/**
 * Suma `dias` días hábiles a una fecha ISO. Días hábiles = de lunes a viernes
 * que NO sean feriado. `feriados` es el conjunto de fechas ISO no laborables
 * registradas en Configuración (feriados y días no laborables oficiales del
 * Perú). Sábados y domingos nunca cuentan.
 */
export function sumarDiasHabiles(
  iso: string,
  dias: number,
  feriados: ReadonlySet<string> = new Set(),
): string {
  const [y, m, d] = fechaDe(iso).split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  // Si el ancla cae en día no hábil, se corre al siguiente hábil antes de contar.
  while (esNoHabil(fecha, feriados)) {
    fecha.setUTCDate(fecha.getUTCDate() + 1);
  }
  let restantes = Math.max(0, Math.floor(dias));
  while (restantes > 0) {
    fecha.setUTCDate(fecha.getUTCDate() + 1);
    if (!esNoHabil(fecha, feriados)) restantes -= 1;
  }
  return fecha.toISOString().slice(0, 10);
}

/** Resta `dias` días hábiles a una fecha ISO (y normaliza a día hábil). */
export function restarDiasHabiles(
  iso: string,
  dias: number,
  feriados: ReadonlySet<string> = new Set(),
): string {
  const [y, m, d] = fechaDe(iso).split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  let restantes = Math.max(0, Math.floor(dias));
  while (restantes > 0) {
    fecha.setUTCDate(fecha.getUTCDate() - 1);
    if (!esNoHabil(fecha, feriados)) restantes -= 1;
  }
  while (esNoHabil(fecha, feriados)) fecha.setUTCDate(fecha.getUTCDate() - 1);
  return fecha.toISOString().slice(0, 10);
}

/** Días hábiles transcurridos entre dos fechas ISO (excluye el día inicial). */
export function diasHabilesEntre(
  desdeRaw: string,
  hastaRaw: string,
  feriados: ReadonlySet<string> = new Set(),
): number {
  const desde = fechaDe(desdeRaw);
  const hasta = fechaDe(hastaRaw);
  if (!ISO.test(desde) || !ISO.test(hasta) || hasta < desde) return 0;
  const [y1, m1, d1] = desde.split("-").map(Number);
  const [y2, m2, d2] = hasta.split("-").map(Number);
  const cursor = new Date(Date.UTC(y1, m1 - 1, d1));
  const fin = new Date(Date.UTC(y2, m2 - 1, d2));
  let n = 0;
  while (cursor < fin) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (!esNoHabil(cursor, feriados)) n += 1;
  }
  return n;
}

/** Suma `dias` días CALENDARIO a una fecha ISO (cuentan sábados y domingos). */
export function sumarDiasCalendario(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  fecha.setUTCDate(fecha.getUTCDate() + Math.max(0, Math.floor(dias)));
  return fecha.toISOString().slice(0, 10);
}

/** Resta `dias` días CALENDARIO a una fecha ISO (la fecha límite del beneficio
 * del Art. 64.3: anuncio publicado ≥ 40 días antes de la convocatoria). */
export function restarDiasCalendario(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  fecha.setUTCDate(fecha.getUTCDate() - Math.max(0, Math.floor(dias)));
  return fecha.toISOString().slice(0, 10);
}

/**
 * Fecha de vencimiento de un plazo a partir de una fecha de inicio. Reutilizable
 * para cualquier plazo del proceso (A5, presentación de ofertas, subsanación,
 * consentimiento de la buena pro, etc.).
 *
 * `habiles`: si el plazo es en días HÁBILES (descuenta sábados, domingos y los
 * feriados registrados) o en días CALENDARIO. Devuelve "" si la fecha de inicio
 * no es válida.
 */
export function calcularVencimiento(
  inicio: string | undefined,
  dias: number,
  opts: { habiles: boolean; feriados?: ReadonlySet<string> },
): string {
  if (!inicio || !ISO.test(inicio) || !Number.isFinite(dias)) return "";
  return opts.habiles
    ? sumarDiasHabiles(inicio, dias, opts.feriados ?? new Set())
    : sumarDiasCalendario(inicio, dias);
}

/**
 * Rellena inicio y fin de TODAS las actividades encadenándolas desde `anclaje`
 * (la fecha de inicio de la primera). Cada actividad dura sus días hábiles y la
 * siguiente empieza el día hábil posterior. No muta la entrada.
 *
 * Devuelve las filas sin tocar si no hay un anclaje válido: sin fecha de partida
 * no se puede calcular nada.
 */
export function calcularFechasCronograma(
  filas: ActividadCronograma[],
  anclaje: string | undefined,
  feriados: ReadonlySet<string> = new Set(),
  opts?: { procedimiento?: string; cuantia?: number | null; dias?: DiasCronograma },
): ActividadCronograma[] {
  // El anclaje puede traer hora ("...T08:30"): se calcula sobre la FECHA y la hora
  // se conserva para la primera actividad (el resto va por convención en `atarHoras`).
  const inicioBase = fechaDe(anclaje) && ISO.test(fechaDe(anclaje)) ? fechaDe(anclaje) : undefined;
  if (!inicioBase || filas.length === 0) return filas;
  const proc = opts?.procedimiento;
  const cuantia = opts?.cuantia ?? null;
  // Días estimados configurables (preparatorias y ejecución): de Configuración
  // cuando se pasan, del defecto en otro caso.
  const dias = opts?.dias ?? DIAS_CRONOGRAMA_DEFAULT;

  let cursor = inicioBase;
  const encadenadas = filas.map((fila) =>
    encadenar(fila, proc, feriados, (c) => (cursor = c), () => cursor, cuantia, dias),
  );
  const conMinimo = aplicarMinimoOfertas(encadenadas, feriados, proc, cuantia);
  const conIntegracion = aplicarMinimoIntegracionOfertas(conMinimo, feriados, proc, cuantia);
  // El registro de participantes (competitivos) ocupa el rango convocatoria→ofertas,
  // ya separado de sobra por el mínimo del Art. 64.1. En la subasta no hay fila de
  // registro: su ventana la garantiza el piso de MIN_HABILES_CONVOCATORIA_OFERTAS.
  const conRegistro = aplicarRegistroParticipantes(conIntegracion, feriados);
  return atarHoras(conRegistro, horaDe(anclaje) || "00:01");
}

/** Encadena una fila desde el cursor, respetando las que no consumen días. */
function encadenar(
  fila: ActividadCronograma,
  proc: string | undefined,
  feriados: ReadonlySet<string>,
  setCursor: (c: string) => void,
  getCursor: () => string,
  cuantia?: number | null,
  diasCfg: DiasCronograma = DIAS_CRONOGRAMA_DEFAULT,
): ActividadCronograma {
  // SOLO "Ejecución contractual" no lleva fecha cierta: va "SEGÚN BASES" y no
  // consume días. El resto de la ejecución (requisitos, suscripción) sí encadena.
  if (esActividadSegunBases(fila.actividad)) {
    return { ...fila, inicio: CRONOGRAMA_SEGUN_BASES, fin: CRONOGRAMA_SEGUN_BASES };
  }
  // Art. 65.2: el registro de participantes NO es un paso secuencial: abarca
  // desde el día siguiente de la convocatoria hasta antes de la presentación de
  // ofertas. Se resuelve al final, cuando ya se conocen ambas fechas.
  if (esRegistroParticipantes(fila.actividad)) return { ...fila };
  const dias = duracionActividad(fila.actividad, proc, cuantia, diasCfg);
  const inicio = sumarDiasHabiles(getCursor(), 0, feriados); // normaliza no hábil
  const fin = sumarDiasHabiles(inicio, Math.max(0, dias - 1), feriados); // 1 día ⇒ mismo día
  setCursor(sumarDiasHabiles(fin, 1, feriados)); // la siguiente arranca al día hábil posterior
  return { ...fila, inicio, fin };
}

/**
 * Art. 64.1: en los competitivos, entre la convocatoria y la presentación de
 * ofertas no pueden mediar menos de 22 días hábiles (no aplica a las modalidades
 * abreviadas ni a las que no contemplan consultas y observaciones).
 *
 * El encadenado natural de las etapas se queda muy por debajo, así que si no se
 * alcanza el mínimo se EMPUJA la presentación de ofertas a la fecha legal y se
 * re-encadena todo lo que va detrás.
 */
function aplicarMinimoOfertas(
  filas: ActividadCronograma[],
  feriados: ReadonlySet<string>,
  proc: string | undefined,
  cuantia?: number | null,
): ActividadCronograma[] {
  const minimo = proc ? MIN_HABILES_CONVOCATORIA_OFERTAS[proc] : null;
  if (!minimo) return filas;
  const iConv = filas.findIndex((f) => esConvocatoria(f.actividad));
  const iOfertas = filas.findIndex((f) => esPresentacionOfertas(f.actividad));
  if (iConv < 0 || iOfertas <= iConv) return filas;
  const convocatoria = filas[iConv].inicio;
  if (!convocatoria || !ISO.test(convocatoria)) return filas;

  const fechaLegal = sumarDiasHabiles(convocatoria, minimo, feriados);
  const actual = filas[iOfertas].inicio;
  if (actual && ISO.test(actual) && actual >= fechaLegal) return filas; // ya cumple

  const out = [...filas];
  let cursor = fechaLegal;
  for (let i = iOfertas; i < out.length; i += 1) {
    out[i] = encadenar(out[i], proc, feriados, (c) => (cursor = c), () => cursor, cuantia);
  }
  return out;
}

/**
 * Art. 68.1: la presentación de ofertas no puede realizarse antes de 7 días
 * hábiles (3 en las modalidades abreviadas) contados desde la publicación de la
 * INTEGRACIÓN DE BASES. Si el encadenado natural la deja antes, se EMPUJA la
 * presentación de ofertas a la fecha legal y se re-encadena lo que va detrás. Es
 * el "plazo propio" de las abreviadas (donde no aplica el mínimo del Art. 64.1).
 */
function aplicarMinimoIntegracionOfertas(
  filas: ActividadCronograma[],
  feriados: ReadonlySet<string>,
  proc: string | undefined,
  cuantia?: number | null,
): ActividadCronograma[] {
  const minimo = proc ? MIN_HABILES_INTEGRACION_OFERTAS[proc] : null;
  if (!minimo) return filas;
  const iIntegr = filas.findIndex((f) => esIntegracionBases(f.actividad));
  const iOfertas = filas.findIndex((f) => esPresentacionOfertas(f.actividad));
  if (iIntegr < 0 || iOfertas <= iIntegr) return filas;
  const integracion = fechaDe(filas[iIntegr].fin || filas[iIntegr].inicio);
  if (!ISO.test(integracion)) return filas;

  const fechaLegal = sumarDiasHabiles(integracion, minimo, feriados);
  const actual = fechaDe(filas[iOfertas].inicio);
  if (ISO.test(actual) && actual >= fechaLegal) return filas; // ya cumple

  const out = [...filas];
  let cursor = fechaLegal;
  for (let i = iOfertas; i < out.length; i += 1) {
    out[i] = encadenar(out[i], proc, feriados, (c) => (cursor = c), () => cursor, cuantia);
  }
  return out;
}

/**
 * Art. 65.2: el registro de participantes va desde el día siguiente de la
 * convocatoria hasta antes del inicio de la presentación de ofertas.
 */
function aplicarRegistroParticipantes(
  filas: ActividadCronograma[],
  feriados: ReadonlySet<string>,
): ActividadCronograma[] {
  const i = filas.findIndex((f) => esRegistroParticipantes(f.actividad));
  if (i < 0) return filas;
  const convocatoria = filas.find((f) => esConvocatoria(f.actividad));
  const ofertas = filas.find((f) => esPresentacionOfertas(f.actividad));
  const desde = convocatoria?.fin;
  const hasta = ofertas?.inicio;
  if (!desde || !hasta || !ISO.test(desde) || !ISO.test(hasta)) return filas;
  const inicio = sumarDiasHabiles(desde, 1, feriados);
  const finBruto = restarDiasHabiles(hasta, 1, feriados);
  const out = [...filas];
  out[i] = {
    ...out[i],
    inicio,
    // Si la convocatoria y las ofertas están tan juntas que el rango se invertiría
    // (fin < inicio), se acota el fin al inicio: un rango de un solo día en vez de
    // un fin ANTERIOR al inicio. `aplicarVentanaRegistro` ya intenta separarlas
    // antes; esto es la última red por si la DEC editó las ofertas a mano.
    fin: finBruto < inicio ? inicio : finBruto,
  };
  return out;
}

/**
 * ¿Cuándo tendría el área usuaria lo que pidió?
 *
 * Es la última fecha cierta del cronograma —la firma del contrato— más el plazo
 * de ejecución (días calendario, Art. 126.2). "SEGÚN BASES" no cuenta: no es una
 * fecha. Devuelve null si el cronograma aún no tiene fechas.
 */
export function fechaEntregaEstimada(
  filas: readonly ActividadCronograma[],
  plazoDiasCalendario?: number | null,
): string | null {
  const fechas = filas
    .flatMap((f) => [fechaDe(f.inicio), fechaDe(f.fin)])
    .filter((d): d is string => ISO.test(d));
  if (fechas.length === 0) return null;
  const ultima = fechas.reduce((a, b) => (a > b ? a : b));
  const plazo = Number(plazoDiasCalendario);
  return Number.isFinite(plazo) && plazo > 0 ? sumarDiasCalendario(ultima, plazo) : ultima;
}

/**
 * El área usuaria pidió la contratación para una fecha (`fecha_requerida` de la
 * necesidad). Si el cronograma no llega, hay que decirlo AHORA y no cuando el
 * bien aparezca cinco meses tarde: a estas alturas todavía se puede acortar el
 * procedimiento, renegociar la fecha con el área o dejar constancia del motivo.
 *
 * Devuelve null cuando no hay nada que avisar o faltan datos para afirmarlo.
 */
export function avisoFechaRequerida(
  filas: readonly ActividadCronograma[],
  fechaRequerida: string | null | undefined,
  plazoDiasCalendario?: number | null,
): { entrega: string; requerida: string; diasTarde: number } | null {
  if (!fechaRequerida || !ISO.test(fechaRequerida)) return null;
  const entrega = fechaEntregaEstimada(filas, plazoDiasCalendario);
  if (!entrega || entrega <= fechaRequerida) return null;
  return { entrega, requerida: fechaRequerida, diasTarde: diasCalendarioEntre(fechaRequerida, entrega) };
}

/** Días calendario entre dos fechas ISO (negativo si `hasta` es anterior). */
export function diasCalendarioEntre(desde: string, hasta: string): number {
  if (!ISO.test(desde) || !ISO.test(hasta)) return 0;
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

/**
 * Comprueba el cronograma contra los plazos que fija el Reglamento y devuelve
 * los avisos. Se valida lo CALCULADO o lo editado a mano, porque la DEC puede
 * cambiar cualquier fecha después.
 */
export function validarCronograma(
  filas: ActividadCronograma[],
  feriados: ReadonlySet<string> = new Set(),
  procedimiento?: string,
): string[] {
  const avisos: string[] = [];
  const convocatoria = filas.find((f) => esConvocatoria(f.actividad));
  const ofertas = filas.find((f) => esPresentacionOfertas(f.actividad));

  const minimo = procedimiento ? MIN_HABILES_CONVOCATORIA_OFERTAS[procedimiento] : null;
  if (minimo && convocatoria?.inicio && ofertas?.inicio) {
    const habiles = diasHabilesEntre(convocatoria.inicio, ofertas.inicio, feriados);
    if (habiles < minimo) {
      avisos.push(
        `Entre la convocatoria y la presentación de ofertas hay ${habiles} días hábiles: el Art. 64.1 del Reglamento exige un mínimo de ${minimo}.`,
      );
    }
  }

  // Art. 68.1: entre la integración de bases y la presentación de ofertas no puede
  // mediar menos de 7 días hábiles (3 en las modalidades abreviadas).
  const integracion = filas.find((f) => esIntegracionBases(f.actividad));
  const minIntegracion = procedimiento ? MIN_HABILES_INTEGRACION_OFERTAS[procedimiento] : null;
  if (minIntegracion && integracion?.fin && ofertas?.inicio) {
    const habiles = diasHabilesEntre(integracion.fin, ofertas.inicio, feriados);
    if (habiles < minIntegracion) {
      avisos.push(
        `Entre la integración de bases y la presentación de ofertas hay ${habiles} días hábiles: el Art. 68.1 exige un mínimo de ${minIntegracion}.`,
      );
    }
  }

  const consultas = filas.find((f) =>
    /^consultas y observaciones|formulaci[oó]n de consultas/i.test(f.actividad ?? ""),
  );
  const minConsultas = procedimiento ? MIN_HABILES_CONSULTAS[procedimiento] : undefined;
  if (minConsultas && consultas?.inicio && consultas?.fin) {
    const dias = diasHabilesEntre(consultas.inicio, consultas.fin, feriados) + 1;
    if (dias < minConsultas) {
      avisos.push(
        `La formulación de consultas y observaciones dura ${dias} días hábiles: el Art. 66.1 exige un mínimo de ${minConsultas}.`,
      );
    }
  }
  return avisos;
}
