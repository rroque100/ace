// Tipos compartidos del modulo Configuracion (cliente + servidor).
// Fuente unica para evitar divergencias entre admin-settings.tsx y los
// route handlers de /api/configuracion/**.

export type EntitySettings = {
  address: string;
  // Ciudad: "Lugar" del encabezado de los documentos de Responder.
  city: string;
  // Departamento y provincia de la entidad (van antes de la ciudad).
  department?: string;
  province?: string;
  executingUnit: string;
  governmentLevel: string;
  managerDegree: string;
  managerDni: string;
  managerFullName: string;
  managerPosition: string;
  managerResolutionDate: string;
  managerResolutionNumber: string;
  // Autoridad de Gestión Administrativa (AGA): aprueba el expediente (Art. 54.2;
  // Ley 32069 Art. 25.1.b). Autoridad designada por resolución, con los mismos
  // datos que el gerente. Se guarda aparte por si no coincide con el gerente.
  agaDegree: string;
  agaDni: string;
  agaFullName: string;
  agaPosition: string;
  agaResolutionDate: string;
  agaResolutionNumber: string;
  name: string;
  // PIA y PAC del ejercicio: datos anuales que se citan como antecedentes en
  // los informes y definen la linea de corte por cuantia (Art. 125).
  // Los montos viajan como texto para el formulario; el API los normaliza.
  pacAnio: string;
  pacMontoBienesServicios: string;
  pacMontoObras: string;
  pacMontoTotal: string;
  pacResolutionDate: string;
  pacResolutionNumber: string;
  piaResolutionDate: string;
  piaResolutionNumber: string;
  ruc: string;
  // UIT del ejercicio. Es la unidad en la que la norma expresa las cuantias, y
  // de ella sale el umbral del contrato menor: sin este dato no se puede
  // comprobar que cada item supere ese umbral, que es lo que el Art. 52.1.b del
  // Reglamento exige para agrupar por items, lotes o tramos.
  uitAnio: string;
  uitValor: string;
  // Rango de cuantia (soles) de la "Licitacion Publica abreviada para bienes".
  // Dato anual editable: la modalidad abreviada depende de la cuantia y su umbral
  // no esta en la norma publicada. Sirve para saber que items de un requerimiento
  // por relacion de items caen en esa banda. Texto en el formulario; el API normaliza.
  lpAbreviadaBienesMin: string;
  lpAbreviadaBienesMax: string;
  lpAbreviadaBienesAnio: string;
  // Topes por cuantía de los procedimientos de selección (tabla DSEACE-OECE,
  // Arts. 93-95 del Reglamento). Importes anuales editables: no están en la norma
  // publicada. Texto en el formulario; el API los normaliza. Defecto 2026 en
  // lib/topes-procedimiento.ts (TOPES_2026).
  topeAnio: string;
  topePiso: string;
  topeLicitacionConcurso: string;
  topeLicitacionObras: string;
  topeComparacionPrecios: string;
  cronogramaAnio: string;
  /** Días estimados del cronograma POR PROCEDIMIENTO, como cadena JSON
   *  ({ procedimiento: { aprobacionExpediente, ... } }). "" = usa los defectos. */
  cronogramaDias: string;
  updatedAt: string | null;
};

export type GovernmentLevel = {
  examples: string;
  label: string;
  value: string;
};

export type ProcessCategory = "competitivo" | "no_competitivo" | "contrato_menor";

export type ProcessTypeSetting = {
  active: boolean;
  category: ProcessCategory;
  code: string;
  description: string;
  frequentMunicipality: boolean;
  label: string;
  legalBasis: string;
  object: string;
  sortOrder: number;
  updatedAt?: string | null;
  // Cuando se asigna a una oficina en lugar de a la entidad.
  oficinaId?: string | null;
};

export type RoleOption = {
  description?: string;
  label: string;
  value: string;
};

export type UserSetting = {
  createdAt: string | null;
  email: string | null;
  // Usuario de ocho dígitos con el que entra. Null en las cuentas creadas antes
  // de la autenticación por usuario y en las de rol del seed, que solo tienen
  // correo: la interfaz las muestra por él.
  usuario?: string | null;
  entity: string;
  // Jefe de oficina: ve/administra todo lo de su oficina en el archivo.
  esJefe?: boolean;
  id: string;
  // Oficina asignada (expedientes_oficinas.id); define el scope del archivo.
  oficinaId?: string | null;
  // Datos personales para los documentos oficiales (designación de evaluadores
  // A6, membretes, actas): el firmante va identificado por su nombre y cargo.
  nombreCompleto?: string;
  dni?: string;
  cargo?: string;
  gradoAcademico?: string;
  permissions?: Array<{ area: string; scope: string }>;
  role: string;
  // Falso = acceso revocado (no puede iniciar sesión), pero la ficha se
  // conserva. Ausente en instalaciones sin la migración de esta columna: se
  // trata como true (activo), el valor por defecto.
  activo?: boolean;
};

// Opción mínima de oficina para selects de asignación de usuarios.
export type OficinaOption = {
  id: string;
  nombre: string;
};

export type CreatedCredential = {
  /** Lo que hay que entregarle a la persona para entrar. */
  usuario: string;
  password: string;
  role: string;
};

export type LinkedUser = {
  usuario: string;
  role: string;
  userId: string;
};

export type RolePermission = {
  area: string;
  permissions: Record<string, boolean>;
  scope: string;
};

export type SettingsPayload = {
  entity: EntitySettings;
  governmentLevels: GovernmentLevel[];
  processTypes: ProcessTypeSetting[];
  rolePermissions: RolePermission[];
  roles: RoleOption[];
  users: UserSetting[];
};

export const DEGREE_OPTIONS = [
  "ING.",
  "CPC.",
  "LIC.",
  "ARQ.",
  "ECON.",
  "ABG.",
  "MG.",
  "DR.",
] as const;

export const CATEGORY_ORDER: ProcessCategory[] = [
  "competitivo",
  "no_competitivo",
  "contrato_menor",
];

export const CATEGORY_META: Record<
  ProcessCategory,
  { description: string; label: string }
> = {
  competitivo: {
    description: "Licitaciones, concursos, subasta inversa y comparacion de precios.",
    label: "Competitivo",
  },
  no_competitivo: {
    description: "Supuestos del articulo 55 de la Ley 32069 y su reglamento.",
    label: "No Competitivo",
  },
  contrato_menor: {
    description: "Reglas especiales hasta 8 UIT; no es procedimiento competitivo.",
    label: "Contrato menor",
  },
};

export const emptyEntity: EntitySettings = {
  address: "",
  city: "",
  department: "",
  province: "",
  executingUnit: "",
  governmentLevel: "",
  managerDegree: "",
  managerDni: "",
  managerFullName: "",
  // Vacío, no "Gerente General": el campo ya ofrece ese texto como sugerencia
  // (placeholder). Traerlo como VALOR lo convertía en un dato que nadie escribió
  // y que el autoguardado persistía en la ficha de la entidad.
  managerPosition: "",
  managerResolutionDate: "",
  managerResolutionNumber: "",
  agaDegree: "",
  agaDni: "",
  agaFullName: "",
  agaPosition: "",
  agaResolutionDate: "",
  agaResolutionNumber: "",
  name: "",
  pacAnio: "",
  pacMontoBienesServicios: "",
  pacMontoObras: "",
  pacMontoTotal: "",
  pacResolutionDate: "",
  pacResolutionNumber: "",
  piaResolutionDate: "",
  piaResolutionNumber: "",
  ruc: "",
  uitAnio: "",
  uitValor: "",
  lpAbreviadaBienesMin: "",
  lpAbreviadaBienesMax: "",
  lpAbreviadaBienesAnio: "",
  topeAnio: "",
  topePiso: "",
  topeLicitacionConcurso: "",
  topeLicitacionObras: "",
  topeComparacionPrecios: "",
  cronogramaAnio: "",
  cronogramaDias: "",
  updatedAt: null,
};

// Campos clave del perfil de la entidad. Fuente ÚNICA de "entidad completa":
// la usan la barra lateral (indicador) y la pestaña Municipalidad (checklist),
// para que ambas midan exactamente lo mismo.
type EntityChecklistInput = Pick<
  EntitySettings,
  | "name"
  | "ruc"
  | "executingUnit"
  | "address"
  | "city"
  | "governmentLevel"
  | "managerFullName"
  | "managerDni"
  | "managerResolutionNumber"
>;

/**
 * Puntos que debe cumplir el perfil de la entidad.
 *
 * `campo` es la clave del control correspondiente: el checklist hace de índice
 * del formulario (son ~24 campos en una columna) y cada punto salta hasta el
 * suyo, así que saber qué falta y poder ir hasta ello son lo mismo.
 */
/**
 * La dirección completa de la entidad, tal como se escribe en un documento.
 *
 * En Configuración vive partida en cuatro casillas —calle, ciudad, provincia,
 * departamento— porque cada una se usa por separado en otros formatos. Donde
 * hace falta la dirección EXACTA, como el apartado de forma de pago (Art. 67),
 * lo que se necesita es la línea entera: «Plaza de Armas S/N, Challhuahuacho,
 * Cotabambas, Apurímac».
 *
 * Se compone con lo que haya: una entidad a medio configurar da una dirección
 * más corta, no una con comas vacías. Si no hay ni calle, no devuelve nada, y
 * quien llame debe dejar el hueco a la vista en vez de escribir una ubicación
 * sin domicilio.
 */
export function direccionDeLaEntidad(
  e:
    | { address?: string | null; city?: string | null; department?: string | null; province?: string | null }
    | null
    | undefined,
): string {
  const calle = (e?.address ?? "").trim();
  if (!calle) return "";
  return [calle, e?.city, e?.province, e?.department]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

export function entityChecklist(
  e: Partial<EntityChecklistInput>,
): { done: boolean; label: string; campo: string }[] {
  return [
    { campo: "name", done: (e.name ?? "").trim().length >= 3, label: "Nombre de la entidad" },
    { campo: "ruc", done: /^\d{11}$/.test(e.ruc ?? ""), label: "RUC (11 dígitos)" },
    { campo: "executingUnit", done: /^\d{6}$/.test(e.executingUnit ?? ""), label: "Unidad ejecutora (6 dígitos)" },
    { campo: "address", done: (e.address ?? "").trim().length >= 5, label: "Dirección" },
    { campo: "city", done: (e.city ?? "").trim().length >= 2, label: "Ciudad / Lugar" },
    { campo: "governmentLevel", done: Boolean(e.governmentLevel), label: "Tipo de gobierno" },
    { campo: "managerFullName", done: (e.managerFullName ?? "").trim().length >= 3, label: "Nombre del Gerente" },
    { campo: "managerDni", done: /^\d{8}$/.test(e.managerDni ?? ""), label: "DNI del Gerente (8 dígitos)" },
    { campo: "managerResolutionNumber", done: (e.managerResolutionNumber ?? "").trim().length >= 1, label: "Resolución de designación" },
  ];
}

/** ¿El perfil de la entidad cumple todos los campos clave del checklist? */
export function isEntityComplete(e: Partial<EntityChecklistInput>): boolean {
  return entityChecklist(e).every((item) => item.done);
}

/**
 * Normaliza un monto escrito a mano a número.
 * Acepta los formatos que usan los documentos peruanos:
 * "S/ 1'226,465.70", "1,226,465.70", "1226465.7".
 * Devuelve null si el texto no contiene ninguna cifra.
 */
export function parseMonto(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  // Quita "S/", el apóstrofo de millones y cualquier otro símbolo.
  const cleaned = value.replace(/[^\d.,]/g, "").trim();
  // Sin dígitos no hay monto: evita que "no aplica" se convierta en 0.
  if (!/\d/.test(cleaned)) return null;
  // Coma = separador de miles; punto = decimal.
  const parsed = Number(cleaned.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function onlyDigits(value: string, length: number) {
  return value.replace(/\D/g, "").slice(0, length);
}

export function codeFromLabel(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 70);
}
