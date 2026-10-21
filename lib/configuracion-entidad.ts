// Logica no-React de la pestaña Municipalidad (datos de la entidad): formateo de
// importes del PAC, avisos de las resoluciones PIA/PAC, y el esquema de
// validacion del formulario con su estado.
//
// Vivia dentro de `app/components/configuracion/municipalidad-tab.tsx`, un
// componente `"use client"`, con los helpers puros EXPORTADOS solo para que los
// tests pudieran alcanzarlos. Aqui son codigo de dominio normal —probable sin
// montar React— y el componente adelgaza ~230 lineas.

// zod/mini: MISMA validacion, pero con API funcional y arbol podable. El zod
// completo entra entero en el paquete del navegador aunque solo se usen diez
// comprobaciones, y en /configuracion era la MITAD del peso. `.shape`,
// `safeParse` y los mensajes propios se comportan igual.
import * as z from "zod/mini";
import { type EntitySettings, type GovernmentLevel, parseMonto } from "./configuracion-types";

/**
 * PAC de obras = monto total del PAC − PAC de bienes y servicios.
 *
 * Se calcula en vez de pedirse: el PAC se reparte entre esos dos bloques, así
 * que escribir los tres a mano solo abre la puerta a que no cuadren. Antes se
 * pedían los tres y la única defensa era un aviso de descuadre que nadie estaba
 * obligado a resolver.
 *
 * Devuelve "" cuando falta algún dato o cuando bienes y servicios excede el
 * total: un PAC de obras negativo no es un dato, es un error de captura, y se
 * señala como tal en vez de guardarse.
 */
export function calcularPacObras(total: string | undefined, bienesServicios: string | undefined): string {
  const t = parseMonto(total ?? "");
  const bs = parseMonto(bienesServicios ?? "");
  if (t === null || bs === null) return "";
  const obras = Math.round((t - bs) * 100) / 100;
  return obras < 0 ? "" : String(obras);
}

/**
 * Deja en un importe solo lo que puede formar parte de una cifra en soles.
 *
 * No se usa `<input type="number">`: rechaza el formato en que el PAC se
 * publica ("S/ 1'226,465.70"), muestra flechas que alteran el importe con la
 * rueda del ratón y en varios navegadores deja escribir "e" y signos. Se filtra
 * la entrada y se marca `inputMode="decimal"` para que el móvil abra el teclado
 * numérico.
 */
export function soloImporte(value: string): string {
  const limpio = value.replace(/[^\d.,]/g, "");
  // Un único separador decimal: el primer punto manda, el resto se descarta.
  const partes = limpio.split(".");
  return partes.length <= 2 ? limpio : `${partes[0]}.${partes.slice(1).join("")}`;
}

/**
 * Da formato de importe a lo tecleado: separador de miles y hasta dos
 * decimales. "1226465.7" → "1,226,465.7".
 *
 * Se formatea MIENTRAS se escribe y no al salir del campo porque el PAC son
 * cifras de siete u ocho dígitos: sin separadores no se distingue un millón de
 * diez, y ese número decide la línea de corte del Art. 125.2.
 *
 * El punto final se conserva ("1226465." → "1,226,465.") o no se podría llegar
 * a escribir un decimal: desaparecería en cuanto se teclea.
 */
export function formatearImporte(raw: string): string {
  const limpio = soloImporte(raw);
  if (limpio === "") return "";
  const [enteroRaw = "", decimal] = limpio.replace(/,/g, "").split(".");
  // Ceros a la izquierda fuera, salvo que el entero sea solo "0".
  const entero = enteroRaw.replace(/^0+(?=\d)/, "");
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decimal === undefined) return limpio.endsWith(".") ? `${conMiles}.` : conMiles;
  // El céntimo es la unidad mínima del PAC: más decimales no son un dato.
  return `${conMiles}.${decimal.slice(0, 2)}`;
}

/**
 * Posición del cursor tras `digitos` dígitos del texto ya formateado.
 *
 * Al insertar separadores el texto crece por la izquierda del cursor y, sin
 * esto, saltaría al final: escribir en medio de una cifra se volvería
 * imposible. Se cuenta por DÍGITOS porque son lo único que el formateo no
 * mueve.
 */
export function posicionTrasDigitos(texto: string, digitos: number): number {
  if (digitos <= 0) return 0;
  let vistos = 0;
  for (let i = 0; i < texto.length; i += 1) {
    if (/\d/.test(texto[i])) vistos += 1;
    if (vistos === digitos) return i + 1;
  }
  return texto.length;
}

/**
 * ¿El valor conserva texto de la plantilla en vez del dato real?
 *
 * Estos campos se citan LITERALMENTE como antecedente en los informes que se
 * exportan y se firman. Un "(MODELO — reemplazar)" que nadie quitó acaba
 * impreso en un documento oficial, y ahí ya no hay quien lo explique.
 */
export function pareceTextoDePlantilla(valor: string): boolean {
  const v = (valor ?? "").toLowerCase();
  if (!v.trim()) return false;
  // Con límites de palabra: "modelo" suelto es texto de plantilla, pero no
  // debe saltar dentro de una palabra legítima del nombre del documento.
  return /\bmodelo\b|reemplaz|\[[^\]]*\]|\bx{3,}\b|\bejemplo\b|\bcompletar\b/.test(v);
}

/** Año de una fecha ISO, o null si no la hay. */
function anioDeFecha(fecha: string | undefined): number | null {
  const m = (fecha ?? "").match(/^(\d{4})-/);
  return m ? Number(m[1]) : null;
}

export type AvisoResolucion = { tono: "error" | "aviso"; texto: string };

/**
 * Incoherencias entre las dos resoluciones y el ejercicio fiscal.
 *
 * Ninguna bloquea el guardado: son datos que la entidad conoce mejor que una
 * regla, y un PAC aprobado en diciembre del año anterior es lo normal. Se
 * avisa para que nadie descubra el desajuste cuando el informe ya está firmado.
 */
export function avisosResoluciones(d: {
  piaNumero?: string;
  piaFecha?: string;
  pacNumero?: string;
  pacFecha?: string;
  ejercicio?: string;
}): AvisoResolucion[] {
  const out: AvisoResolucion[] = [];

  if (pareceTextoDePlantilla(d.piaNumero ?? "")) {
    out.push({ tono: "error", texto: "La resolución del PIA conserva texto de la plantilla: reemplázalo por el documento real." });
  }
  if (pareceTextoDePlantilla(d.pacNumero ?? "")) {
    out.push({ tono: "error", texto: "La resolución del PAC conserva texto de la plantilla: reemplázalo por el documento real." });
  }

  // El PAC se elabora a partir del PIA: aprobarlo antes no encaja.
  if (d.piaFecha && d.pacFecha && d.pacFecha < d.piaFecha) {
    out.push({ tono: "aviso", texto: "La resolución del PAC es anterior a la del PIA. Revisa las fechas: el PAC se elabora a partir del presupuesto aprobado." });
  }

  // El PAC del ejercicio se aprueba en ese año o en diciembre del anterior.
  const ejercicio = Number(d.ejercicio);
  const anioPac = anioDeFecha(d.pacFecha);
  if (Number.isFinite(ejercicio) && ejercicio > 0 && anioPac !== null && anioPac !== ejercicio && anioPac !== ejercicio - 1) {
    out.push({ tono: "aviso", texto: `La resolución del PAC es del ${anioPac} y el ejercicio registrado es ${ejercicio}. Comprueba cuál de los dos datos corresponde.` });
  }

  return out;
}

const montoSchema = z.optional(
  z.union([
    z.string().check(z.trim(), z.maxLength(30), z.refine((v) => v === "" || parseMonto(v) !== null, "Monto invalido")),
    z.literal(""),
  ]),
);

export const entitySchema = z.object({
  name: z.string().check(z.trim(), z.minLength(3, "Minimo 3 caracteres"), z.maxLength(180)),
  ruc: z.string().check(z.trim(), z.regex(/^\d{11}$/, "El RUC debe tener 11 digitos")),
  executingUnit: z.string().check(z.trim(), z.regex(/^\d{6}$/, "La unidad ejecutora debe tener 6 digitos")),
  address: z.string().check(z.trim(), z.minLength(5, "Minimo 5 caracteres"), z.maxLength(260)),
  city: z.optional(z.union([z.string().check(z.trim(), z.minLength(2, "Minimo 2 caracteres"), z.maxLength(120)), z.literal("")])),
  department: z.optional(z.union([z.string().check(z.trim(), z.maxLength(120)), z.literal("")])),
  province: z.optional(z.union([z.string().check(z.trim(), z.maxLength(120)), z.literal("")])),
  governmentLevel: z.enum(["gobierno_nacional", "gobierno_regional", "gobierno_local"], {
    message: "Selecciona el tipo de gobierno",
  }),
  managerDegree: z.optional(z.union([z.string().check(z.trim(), z.maxLength(30)), z.literal("")])),
  managerDni: z.optional(z.union([z.string().check(z.trim(), z.regex(/^\d{8}$/, "El DNI debe tener 8 digitos")), z.literal("")])),
  managerFullName: z.optional(z.union([z.string().check(z.trim(), z.minLength(3, "Minimo 3 caracteres"), z.maxLength(200)), z.literal("")])),
  managerPosition: z.optional(z.union([z.string().check(z.trim(), z.maxLength(120)), z.literal("")])),
  managerResolutionNumber: z.optional(z.union([z.string().check(z.trim(), z.maxLength(80)), z.literal("")])),
  managerResolutionDate: z.optional(z.union([z.string().check(z.trim(), z.maxLength(20)), z.literal("")])),
  // Autoridad de Gestión Administrativa (AGA): aprueba el expediente (Art. 54.2;
  // Ley 32069 Art. 25.1.b). Autoridad designada por resolución.
  agaDegree: z.optional(z.union([z.string().check(z.trim(), z.maxLength(30)), z.literal("")])),
  agaDni: z.optional(z.union([z.string().check(z.trim(), z.regex(/^\d{8}$/, "El DNI debe tener 8 digitos")), z.literal("")])),
  agaFullName: z.optional(z.union([z.string().check(z.trim(), z.minLength(3, "Minimo 3 caracteres"), z.maxLength(200)), z.literal("")])),
  agaPosition: z.optional(z.union([z.string().check(z.trim(), z.maxLength(120)), z.literal("")])),
  agaResolutionNumber: z.optional(z.union([z.string().check(z.trim(), z.maxLength(80)), z.literal("")])),
  agaResolutionDate: z.optional(z.union([z.string().check(z.trim(), z.maxLength(20)), z.literal("")])),
  piaResolutionNumber: z.optional(z.union([z.string().check(z.trim(), z.maxLength(120)), z.literal("")])),
  piaResolutionDate: z.optional(z.union([z.string().check(z.trim(), z.maxLength(20)), z.literal("")])),
  pacResolutionNumber: z.optional(z.union([z.string().check(z.trim(), z.maxLength(120)), z.literal("")])),
  pacResolutionDate: z.optional(z.union([z.string().check(z.trim(), z.maxLength(20)), z.literal("")])),
  pacAnio: z.optional(z.union([z.string().check(z.trim(), z.regex(/^\d{4}$/, "Ano de 4 digitos")), z.literal("")])),
  pacMontoTotal: montoSchema,
  pacMontoBienesServicios: montoSchema,
  pacMontoObras: montoSchema,
  // UIT del ejercicio (Art. 52.1.b del Reglamento: el umbral del contrato menor
  // se expresa en UIT y decide si cabe agrupar por items).
  uitAnio: z.optional(z.union([z.string().check(z.trim(), z.regex(/^\d{4}$/, "Ano de 4 digitos")), z.literal("")])),
  uitValor: montoSchema,
  // Rango de la LP abreviada para bienes (umbral anual editable).
  lpAbreviadaBienesAnio: z.optional(z.union([z.string().check(z.trim(), z.regex(/^\d{4}$/, "Ano de 4 digitos")), z.literal("")])),
  lpAbreviadaBienesMin: montoSchema,
  lpAbreviadaBienesMax: montoSchema,
  // Topes por cuantía de los procedimientos de selección (umbrales anuales).
  topeAnio: z.optional(z.union([z.string().check(z.trim(), z.regex(/^\d{4}$/, "Ano de 4 digitos")), z.literal("")])),
  topePiso: montoSchema,
  topeLicitacionConcurso: montoSchema,
  topeLicitacionObras: montoSchema,
  topeComparacionPrecios: montoSchema,
  cronogramaAnio: z.optional(z.union([z.string().check(z.trim(), z.regex(/^\d{4}$/, "Ano de 4 digitos")), z.literal("")])),
  // Días por procedimiento como cadena JSON (la valida/sanea el backend con
  // parseDiasPorProcedimiento): aquí solo se acota el tamaño.
  cronogramaDias: z.optional(z.union([z.string().check(z.trim(), z.maxLength(4000)), z.literal("")])),
});

export type EntityFormData = z.infer<typeof entitySchema>;
// El formulario permite "sin seleccionar" (""); la validacion exige el valor real.
export type FormState = Omit<EntityFormData, "governmentLevel"> & {
  governmentLevel: EntityFormData["governmentLevel"] | "";
};

export const governmentLevelOptions: GovernmentLevel[] = [
  {
    label: "Gobierno Nacional",
    value: "gobierno_nacional",
    examples: "Ministerios, organismos publicos, programas y organismos constitucionales autonomos",
  },
  {
    label: "Gobierno Regional",
    value: "gobierno_regional",
    examples: "Gobiernos Regionales",
  },
  {
    label: "Gobierno Local",
    value: "gobierno_local",
    examples: "Municipalidades Provinciales y Municipalidades Distritales",
  },
];

export function toFormState(entity: EntitySettings): FormState {
  return {
    name: entity.name || "",
    ruc: entity.ruc || "",
    executingUnit: entity.executingUnit || "",
    address: entity.address || "",
    city: entity.city || "",
    department: entity.department || "",
    province: entity.province || "",
    governmentLevel: (entity.governmentLevel as FormState["governmentLevel"]) || "",
    managerDegree: entity.managerDegree || "",
    managerDni: entity.managerDni || "",
    managerFullName: entity.managerFullName || "",
    managerPosition: entity.managerPosition || "",
    managerResolutionNumber: entity.managerResolutionNumber || "",
    managerResolutionDate: entity.managerResolutionDate || "",
    // AGA: si faltan aquí, el formulario los pierde al sincronizar tras guardar y
    // el siguiente guardado los sobrescribe con null.
    agaDegree: entity.agaDegree || "",
    agaDni: entity.agaDni || "",
    agaFullName: entity.agaFullName || "",
    agaPosition: entity.agaPosition || "",
    agaResolutionNumber: entity.agaResolutionNumber || "",
    agaResolutionDate: entity.agaResolutionDate || "",
    piaResolutionNumber: entity.piaResolutionNumber || "",
    piaResolutionDate: entity.piaResolutionDate || "",
    pacResolutionNumber: entity.pacResolutionNumber || "",
    pacResolutionDate: entity.pacResolutionDate || "",
    pacAnio: entity.pacAnio || "",
    // El servidor devuelve el número plano ("6099061.68"); en el campo se
    // muestra con separadores, igual que mientras se escribe.
    pacMontoTotal: formatearImporte(entity.pacMontoTotal || ""),
    pacMontoBienesServicios: formatearImporte(entity.pacMontoBienesServicios || ""),
    pacMontoObras: formatearImporte(entity.pacMontoObras || ""),
    uitAnio: entity.uitAnio || "",
    uitValor: formatearImporte(entity.uitValor || ""),
    lpAbreviadaBienesAnio: entity.lpAbreviadaBienesAnio || "",
    lpAbreviadaBienesMin: formatearImporte(entity.lpAbreviadaBienesMin || ""),
    lpAbreviadaBienesMax: formatearImporte(entity.lpAbreviadaBienesMax || ""),
    topeAnio: entity.topeAnio || "",
    topePiso: formatearImporte(entity.topePiso || ""),
    topeLicitacionConcurso: formatearImporte(entity.topeLicitacionConcurso || ""),
    topeLicitacionObras: formatearImporte(entity.topeLicitacionObras || ""),
    topeComparacionPrecios: formatearImporte(entity.topeComparacionPrecios || ""),
    cronogramaAnio: entity.cronogramaAnio || "",
    cronogramaDias: entity.cronogramaDias || "",
  };
}
