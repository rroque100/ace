// Claves huérfanas en el jsonb de los hitos.
//
// El problema que resuelve: `procurement_processes.hitos` es un jsonb y no
// valida nada. Acepta cualquier clave y la conserva para siempre. Cuando un
// campo del formulario se RENOMBRA, lo que la gente ya había escrito se queda
// con la clave vieja: invisible para el formulario, invisible para el
// exportador, y sin un solo error en ninguna parte.
//
// Ya ha pasado dos veces:
//   - `var_a_tipo_procedimiento` guardaba la NOMENCLATURA del procedimiento. Al
//     separarse a) en tipo + número, el dato quedó atrapado. Nadie se enteró
//     hasta que el Excel salió imprimiendo el título de la necesidad en su
//     lugar.
//   - `tipo_interaccion` era un select que contradecía al nivel. Se quitó y su
//     valor sigue ahí, ignorado.
//
// La tabla `necesidades` no puede tener este problema: tiene columnas, y lo que
// no encaja no entra. El jsonb sí, y por eso necesita esta red.
//
// Cómo se usa a partir de ahora: al renombrar o retirar un campo de un paso, se
// añade su entrada a CLAVES_HEREDADAS. Una línea. Si no se hace, el test de
// claves huérfanas falla y dice exactamente qué clave se quedó sin dueño.

import { pasoF1 } from "./actuaciones-preparatorias";
import { pasoF2 } from "./actuaciones-seleccion";
import { pasoF3 } from "./actuaciones-ejecucion";

/**
 * Claves que un paso guarda sin declararlas en `campos`, porque las escribe un
 * formulario con lógica propia. Hoy solo A2 (`especial: "segmentacion"`), cuyos
 * campos viven en el tipo `SegData` del componente.
 *
 * Si esto crece, la señal es que el formulario especial debería declarar sus
 * campos como los demás.
 */
const CLAVES_DE_FORMULARIO_ESPECIAL: Record<string, readonly string[]> = {
  A2: [
    "objeto",
    "cuantiaAlta",
    "condicionesRiesgo",
    "criteriosBasica",
    "montoTotal",
    "montoContratacion",
    "cronogramaItems",
    "centralizada",
    "montoNoProgramadasConvocadas",
    "montoOtrasNoProgramadas",
    "destinatario",
    "remitente",
    "justificacion",
    "continuidad",
    "riesgoMercado",
    "estrategiaMitigacion",
    "puntoControl",
  ],
};

/**
 * Renombrados y retiradas registrados, por paso.
 *
 *   "clave_vieja": "clave_nueva"  → el dato se migra al abrir el paso.
 *   "clave_vieja": null           → se retiró sin sustituto; el valor guardado
 *                                   se ignora a propósito.
 *
 * Registrar el cambio aquí es lo que separa "renombramos un campo" de "perdimos
 * lo que la gente había escrito".
 */
export const CLAVES_HEREDADAS: Record<string, Readonly<Record<string, string | null>>> = {
  A1: {
    // Las dos casillas que preguntaban la programación por separado —"¿está en el
    // PAC?" y "¿es programada?"— se fundieron en un único select `situacion_pac`
    // (Programado/No programado). No es un rename plano: el valor viejo es booleano
    // y el nuevo es un enum ("programado"/"no_programado"), así que NO puede
    // migrarse copiando la clave. La transformación la hace el efecto de sync de
    // A1 en fase-panel.tsx, que lee estos flags y fija `situacion_pac`; además
    // `esNoProgramada` los sigue leyendo como fallback legado. Por eso se marcan
    // como retiradas del mecanismo genérico (null): se conocen y se conservan, no
    // se reportan como huérfanas ni se migran a ciegas.
    en_pac: null,
    programada: null,
  },
  A4: {
    // a) era un único campo con el tipo Y el número. Lo que se tecleaba era la
    // nomenclatura, así que se recupera en `var_a_nomenclatura`.
    var_a_tipo_procedimiento: "var_a_nomenclatura",
    // a) muestra ahora el proceso ESPECÍFICO de la ficha (`var_a_proceso`, campo
    // declarado). `var_a_procedimiento` es el genérico del Art. 54 DERIVADO de él,
    // que consumen el cronograma y los plazos: no es un campo del formulario, pero
    // tampoco es huérfano. `_origen` es un marcador del modelo anterior (cuando a)
    // era editable), que se limpia al refrescar.
    var_a_procedimiento: null,
    var_a_procedimiento_origen: null,
  },
  A5: {
    // El tipo se deduce del nivel ("consulta_mercado_basica" ya dice que es una
    // consulta). Como select aparte solo servía para contradecirlo: con
    // Tipo=consulta y Nivel=indagación el Anexo marcaba las DOS casillas.
    tipo_interaccion: null,
  },
  A6: {
    // El emisor del memorándum (línea "DE:") es el jefe de la DEC y sale de
    // Configuración › Usuarios, no de campos aquí. Los tres firmante_* se
    // retiraron.
    firmante_nombre: null,
    firmante_grado: null,
    firmante_cargo: null,
  },
  A8: {
    // Las siete casillas de contenido re-preguntaban lo que el Art. 54.2
    // verifica solo contra los pasos A1/A3/A4/A5/A6/A7 (lib/expediente-
    // contenido.ts). Se retiraron en favor de esa puerta automática.
    req_cmn: null,
    req_requerimiento: null,
    req_estrategia: null,
    req_interaccion: null,
    req_cuantia: null,
    req_evaluadores: null,
    req_ccp: null,
  },
};

/** Campos que el paso declara en su formulario. */
export function clavesDeclaradas(code: string): Set<string> {
  const paso = pasoF1(code) ?? pasoF2(code) ?? pasoF3(code);
  const nombres = (paso?.campos ?? []).map((c) => c.name);
  return new Set([...nombres, ...(CLAVES_DE_FORMULARIO_ESPECIAL[code] ?? [])]);
}

/**
 * Claves guardadas que ya no pertenecen a nadie: ni son un campo del paso, ni
 * están registradas como heredadas. Cada una es un dato que alguien escribió y
 * que la aplicación dejó de mirar sin avisar.
 */
export function clavesHuerfanas(code: string, data: Record<string, unknown> | null | undefined): string[] {
  if (!data) return [];
  const declaradas = clavesDeclaradas(code);
  const heredadas = CLAVES_HEREDADAS[code] ?? {};
  return Object.keys(data)
    .filter((k) => !declaradas.has(k) && !(k in heredadas))
    .sort();
}

/**
 * Migra las claves heredadas a su campo actual. No pisa un valor ya presente: si
 * el campo nuevo tiene algo, es lo que alguien escribió después.
 *
 * Devuelve el mismo objeto si no hay nada que migrar, para no forzar renders ni
 * guardados innecesarios.
 */
export function migrarClavesHeredadas(
  code: string,
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const base = data ?? {};
  const heredadas = CLAVES_HEREDADAS[code];
  if (!heredadas) return base;
  let next: Record<string, unknown> | null = null;
  for (const [vieja, nueva] of Object.entries(heredadas)) {
    if (!nueva) continue; // retirada sin sustituto: su valor se ignora
    const valor = base[vieja];
    const yaHay = typeof base[nueva] === "string" ? String(base[nueva]).trim() : base[nueva];
    if (valor === undefined || valor === null || valor === "" || yaHay) continue;
    next ??= { ...base };
    next[nueva] = valor;
  }
  return next ?? base;
}
