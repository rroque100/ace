// Importación de un Pedido de Compra del SIGA (.xls/.xlsx exportado) a una
// Necesidad (Módulo 1). El archivo trae una fila por ítem con columnas
// administrativas del SIGA; aquí se mapean a los campos de la Necesidad.
//
// La lógica de mapeo (mapPedidoRowToNecesidad) es pura y testeable; el parseo
// del binario (parsePedidoCompra) usa SheetJS y corre en el servidor.

import * as XLSX from "xlsx";

// Fila cruda del pedido: objeto columna(header)→valor.
export type PedidoRow = Record<string, unknown>;

// Subconjunto de campos de la Necesidad (camelCase, igual que necesidadCreateSchema)
// que se pueden derivar del pedido de compra.
/**
 * Una línea del pedido SIGA, ya interpretada como ítem del requerimiento.
 *
 * `nroPaquete` NO lo trae el SIGA: el pedido no sabe nada de agrupamiento, que
 * es una decisión posterior de la entidad (Art. 52). Se deja aquí para que el
 * mismo tipo sirva de ida y vuelta con el cuadro de la ficha.
 */
export type PedidoItem = {
  nro: number;
  descripcion: string;
  codigoCatalogo?: string | null;
  unidadMedida?: string | null;
  cantidad?: number | null;
  costoUnitario?: number | null;
  costoTotal?: number | null;
  nroPaquete?: number | null;
};

export type PedidoNecesidadImport = {
  nombre: string;
  tipoObjeto: "bienes" | "servicios" | "obras" | "consultoria_obra";
  areaUsuaria?: string;
  centroCosto?: string;
  responsable?: string;
  cantidad?: number;
  unidadMedida?: string;
  descripcionDetallada?: string;
  /** Lo que el área usuaria describe que pide (col. S, `motivo_pedido`). */
  descripcionCatalogo?: string;
  codigoCatalogo?: string;
  /** Rubro de financiamiento (col. V, `fuente_fto`): "18" = canon y sobrecanon. */
  rubro?: string;
  /** Importe del pedido (col. N). Ver la nota de `cant_solicitada` en el mapeo. */
  montoEstimado?: number;
  proyectoInversion?: string;
  cadenaFuncional?: string;
  clasificadorGasto?: string;
  moneda?: string;
  anioFiscal?: number;
  fechaRequerida?: string;
  fuenteFinanciamiento?: string;
  metaPresupuestal?: string;
  summary?: string;
  /**
   * Código Único de Inversión (CUI), de la columna `act_proy` del SIGA.
   *
   * Es el NÚMERO del proyecto (2661009), no su nombre. El Formato de Estrategia
   * lo pide aparte en su variable c) ("Registrar el Código Único de Inversión")
   * y antes se sacaba del texto de `proyectoInversion`, que trae el nombre de la
   * tarea: el CUI salía como "186 MEJORAMIENTO Y AMPLIACION DE LOS SERVICIOS".
   */
  cui?: string;
  /** Secuencia del ítem dentro del pedido: un pedido puede traer varias líneas. */
  secuencia?: string;
  /**
   * Desagregado del requerimiento, una entrada por línea del pedido.
   *
   * El SIGA ya entrega el pedido detallado: cada fila del Excel es una
   * prestación con su cantidad, unidad e importe. Antes eso se aplanaba a una
   * lista en prosa dentro de `descripcionDetallada` y se perdía como dato — no
   * se podía sumar, ni comprobar el tope del contrato menor, ni empaquetar.
   * Vale igual para bienes y para servicios: lo que cambia es el objeto, no la
   * estructura del pedido.
   */
  items?: PedidoItem[];
  /**
   * La fila ENTERA del export del SIGA, sin interpretar.
   *
   * El mapeo de arriba usa 19 de sus 47 columnas. Las otras 28 no se tiran: el
   * módulo de actuaciones preparatorias irá tomando las que necesite, y sin
   * esto habría que reimportar el archivo cada vez. Además es la prueba del
   * origen de los datos de la ficha.
   */
  crudo?: PedidoRow;
  // Referencia del pedido (para trazabilidad / UI), no es columna de la Necesidad.
  nroPedido?: string;
};

// Clasificador de Fuentes de Financiamiento y Rubros (MEF). El SIGA guarda el
// rubro en `fuente_fto` y la fuente agregada en `fuente_financ_agregada`.
const RUBRO_SIGA: Record<string, string> = {
  "00": "Recursos Ordinarios",
  "07": "Fondo de Compensación Municipal",
  "08": "Impuestos Municipales",
  "09": "Recursos Directamente Recaudados",
  "13": "Donaciones y Transferencias",
  "18": "Canon y Sobrecanon, Regalías, Renta de Aduanas y Participaciones",
  "19": "Recursos por Operaciones Oficiales de Crédito",
};

const FUENTE_AGREGADA_SIGA: Record<string, string> = {
  "1": "Recursos Ordinarios",
  "2": "Recursos Directamente Recaudados",
  "3": "Recursos por Operaciones Oficiales de Crédito",
  "4": "Donaciones y Transferencias",
  "5": "Recursos Determinados",
};

// Resuelve la fuente de financiamiento a partir del rubro (preferente) o de la
// fuente agregada del SIGA. Devuelve el nombre oficial o undefined si no mapea.
export function resolveFuenteSiga(rubro: string, agregada: string): string | undefined {
  const r = rubro.trim();
  if (r) {
    const padded = r.padStart(2, "0");
    if (RUBRO_SIGA[padded]) return RUBRO_SIGA[padded];
  }
  const a = agregada.trim();
  return FUENTE_AGREGADA_SIGA[a];
}

function txt(v: unknown): string {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

function numOrUndef(v: unknown): number | undefined {
  const n = Number(txt(v).replace(/,/g, ""));
  return Number.isFinite(n) && txt(v) !== "" ? n : undefined;
}

// Fecha SIGA "22/04/2026 11:44:55.283" o "22/04/2026" → ISO "2026-04-22".
function parseFechaSiga(v: string): string | undefined {
  const m = v.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return undefined;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// Grupo de bien SIGA → tipo de objeto. Fallback cuando no se puede clasificar por
// la columna T: un pedido de compra es de bienes por defecto.
function inferTipoObjeto(_grupoBien: string): PedidoNecesidadImport["tipoObjeto"] {
  return "bienes";
}

// El resumen dice "pedido de servicio" cuando el objeto es un servicio y "pedido
// de compra" cuando es un bien (el SIGA lo distingue por la columna T: SERVICIO
// vs UNIDAD u otra unidad física).
function sustantivoPedido(tipoObjeto: PedidoNecesidadImport["tipoObjeto"]): "compra" | "servicio" {
  return tipoObjeto === "servicios" ? "servicio" : "compra";
}

// La COLUMNA T del export del SIGA lleva la unidad/tipo del ítem: "UNIDAD" (u otra
// unidad física) → pedido de BIEN; "SERVICIO" → pedido de SERVICIO. Índice 0-based
// de la columna T: A=0 … T=19.
const COL_T = 19;

/**
 * Clasifica el tipo de objeto por el valor de la columna T (o, si viene vacía,
 * por la abreviatura de unidad de medida). Coincidencia por palabra exacta
 * (SERVICIO/SERVICIOS) para no confundir con textos largos como el nombre de una
 * dependencia ("GERENCIA DE SERVICIOS…").
 */
export function clasificarTipoColumnaT(
  colT: string,
  abreviatura = "",
): PedidoNecesidadImport["tipoObjeto"] {
  const v = (txt(colT) || txt(abreviatura)).toUpperCase();
  return /^SERVICIOS?\.?$/.test(v) ? "servicios" : "bienes";
}

function normalizaMoneda(v: string): string | undefined {
  if (!v) return undefined;
  if (/s\/|pen|sol/i.test(v)) return "PEN";
  if (/\$|usd|d[oó]lar/i.test(v)) return "USD";
  return v;
}

// Mapea una fila del pedido de compra a los campos de la Necesidad. Solo incluye
// campos con valor; el resto lo completa el usuario en la ficha.
export function mapPedidoRowToNecesidad(
  row: PedidoRow,
  tipoObjeto?: PedidoNecesidadImport["tipoObjeto"],
): PedidoNecesidadImport {
  // Código CUBSO/SIGA: grupo + clase + familia + ítem, SIN separadores. Es el
  // código que se teclea y se busca en el catálogo —410100070019—, no la versión
  // punteada; los guiones eran una lectura nuestra, no cómo viene el dato.
  const codigoCatalogo = [row.grupo_bien, row.clase_bien, row.familia_bien, row.item_bien]
    .map(txt)
    .filter(Boolean)
    .join("");

  const cadenaFuncional = [row.funcion, row.programa, row.sub_programa, row.act_proy, row.componente]
    .map(txt)
    .filter(Boolean)
    .join("-");

  // Orden natural, como se firma: nombres (col. I) + apellido paterno (col. G) +
  // apellido materno (col. H). Antes se guardaba con los apellidos delante (orden
  // del padrón); se cambió a pedido del usuario para que el responsable se lea
  // directamente como el nombre de la persona.
  const responsable = [row.nombres, row.apellido_paterno, row.apellido_materno]
    .map(txt)
    .filter(Boolean)
    .join(" ");

  const fecha = parseFechaSiga(txt(row.fecha_pedido));
  const nroPedido = txt(row.nro_pedido);
  const secuencia = txt(row.secuencia);
  const nombre = txt(row.motivo_pedido) || txt(row.nombre_item);

  const out: PedidoNecesidadImport = {
    nombre,
    tipoObjeto: tipoObjeto ?? inferTipoObjeto(txt(row.grupo_bien)),
  };

  const areaUsuaria = txt(row.nombre_depend);
  if (areaUsuaria) out.areaUsuaria = areaUsuaria;
  const centroCosto = txt(row.centro_costo);
  if (centroCosto) out.centroCosto = centroCosto;
  if (responsable) out.responsable = responsable;
  const cantidad = numOrUndef(row.cant_solicitada);
  if (cantidad !== undefined) {
    out.cantidad = cantidad;
    // `cant_solicitada` es también el IMPORTE del pedido: el export del SIGA no
    // trae una columna de precio, y en los servicios esa cifra es soles, no una
    // cantidad (500000 de "CONFECCIÓN E INSTALACIÓN DE ESTRUCTURAS" son S/, no
    // unidades). Se lleva al monto estimado, que es donde se usa.
    out.montoEstimado = cantidad;
  }
  const unidadMedida = txt(row.abreviatura);
  if (unidadMedida) out.unidadMedida = unidadMedida;
  const descripcion = txt(row.nombre_item);
  if (descripcion) out.descripcionDetallada = descripcion;
  // La descripción de catálogo sale de `motivo_pedido` (col. S): es el texto con
  // el que el área usuaria describe lo que pide. Antes se tomaba de `nombre_item`
  // (col. P), que es el nombre genérico del CUBSO y ya alimenta el detalle y el
  // código; usar la misma columna para las dos cosas dejaba la ficha repitiendo
  // la misma frase en dos campos.
  const descripcionCatalogo = txt(row.motivo_pedido);
  if (descripcionCatalogo) out.descripcionCatalogo = descripcionCatalogo;
  if (codigoCatalogo) out.codigoCatalogo = codigoCatalogo;
  const proyecto = txt(row.nombre_tarea);
  if (proyecto) out.proyectoInversion = proyecto;
  if (cadenaFuncional) out.cadenaFuncional = cadenaFuncional;
  const clasificador = txt(row.clasificador);
  if (clasificador) out.clasificadorGasto = clasificador;
  const moneda = normalizaMoneda(txt(row.moneda));
  if (moneda) out.moneda = moneda;
  // `fuente_fto` alimenta DOS campos distintos y complementarios: el rubro es el
  // código tal cual ("18"), y la fuente de financiamiento es su nombre resuelto
  // ("Recursos Determinados"). El formato pide los dos por separado.
  const rubro = txt(row.fuente_fto);
  if (rubro) out.rubro = rubro;
  const fuente = resolveFuenteSiga(txt(row.fuente_fto), txt(row.fuente_financ_agregada));
  if (fuente) out.fuenteFinanciamiento = fuente;
  // La secuencia funcional (sec_func) identifica la meta presupuestal; su nombre
  // es específico de la entidad (viene en nombre_tarea → proyecto de inversión).
  const meta = txt(row.sec_func);
  if (meta) out.metaPresupuestal = meta;
  if (fecha) {
    out.fechaRequerida = fecha;
    out.anioFiscal = Number(fecha.slice(0, 4));
  }
  // El CUI: `act_proy` es el número del proyecto de inversión. Va aparte del
  // nombre de la tarea, que es lo que lleva `proyectoInversion`.
  const actProy = txt(row.act_proy);
  if (actProy) out.cui = actProy;

  if (nroPedido) {
    out.nroPedido = nroPedido;
    if (secuencia) out.secuencia = secuencia;
    // La fila entera, para persistirla sin perder las 28 columnas que el mapeo
    // de arriba no usa (todavía).
    out.crudo = row;
    out.summary = `Pedido de ${sustantivoPedido(out.tipoObjeto)} SIGA N° ${nroPedido}.`;
  }

  return out;
}

// Parsea el binario del pedido de compra y devuelve una Necesidad por ítem (fila).
// El mapeo por OBJETO (headers) se conserva —así el `crudo` guarda las 47 columnas
// con sus tipos—; en paralelo se lee la COLUMNA T por posición (AOA alineado por
// índice) para clasificar cada ítem en bien/servicio.
export function parsePedidoCompra(buf: Buffer): PedidoNecesidadImport[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const objRows = XLSX.utils.sheet_to_json<PedidoRow>(sheet, { defval: "" });
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const items: PedidoNecesidadImport[] = [];
  objRows.forEach((row, i) => {
    if (!txt(row.motivo_pedido) && !txt(row.nombre_item)) return;
    // objRows[i] ↔ aoa[i+1] (aoa[0] es la cabecera): misma fila del sheet.
    const cells = (aoa[i + 1] as unknown[] | undefined) ?? [];
    const tipo = clasificarTipoColumnaT(String(cells[COL_T] ?? ""), txt(row.abreviatura));
    items.push(mapPedidoRowToNecesidad(row, tipo));
  });
  return items;
}

/**
 * Agrupa los ítems de un mismo pedido en UNA sola necesidad (un pedido de compra
 * → una necesidad → un expediente). Se agrupa por (nro_pedido, tipo de objeto):
 * los bienes y los servicios de un pedido, si los hubiera, van por separado. Las
 * filas sin nro_pedido no se agrupan (se dejan individuales).
 */
export function agruparPedidosPorNecesidad(
  items: PedidoNecesidadImport[],
): PedidoNecesidadImport[] {
  const grupos = new Map<string, PedidoNecesidadImport[]>();
  const sueltos: PedidoNecesidadImport[] = [];
  for (const it of items) {
    if (!it.nroPedido) {
      sueltos.push(it);
      continue;
    }
    const key = `${it.nroPedido}||${it.tipoObjeto}`;
    grupos.set(key, [...(grupos.get(key) ?? []), it]);
  }
  /**
   * Desagrega una línea suelta: su cantidad y su unidad pasan al ítem y salen de
   * la cabecera, igual que en el pedido fusionado. Sin esto, un pedido de una
   * sola línea seguiría rellenando unos campos que la ficha ya no pide.
   */
  const desagregar = (arr: PedidoNecesidadImport[]): PedidoNecesidadImport => {
    const { cantidad: _cantidad, unidadMedida: _unidad, ...resto } = arr[0]!;
    return { ...resto, items: itemsDePedido(arr) };
  };

  const out: PedidoNecesidadImport[] = [];
  for (const arr of grupos.values()) {
    // Un pedido de una sola línea también se desagrega: el cuadro de la ficha
    // debe listarla igual, y así el requerimiento se puede ampliar sin volver a
    // importar. Lo único que no aplica es fusionar la cabecera.
    out.push(arr.length === 1 ? desagregar(arr) : fusionarPedido(arr));
  }
  // Los sueltos (sin nro de pedido) también llevan su ítem.
  return [...out, ...sueltos.map((s) => desagregar([s]))];
}

/**
 * Convierte las líneas de un pedido en el desagregado del requerimiento.
 *
 * El export del SIGA trae 47 columnas y NINGUNA es de precio: por línea solo hay
 * `nombre_item`, `item_bien`, `cant_solicitada` y `unidad_medida`. Así que los
 * ítems entran con descripción, código, cantidad y unidad, y los importes se
 * teclean después. No se inventa un costo a partir de nada.
 *
 * Vale igual para bienes y para servicios: el pedido tiene la misma estructura,
 * lo que cambia es el objeto.
 */
export function itemsDePedido(arr: PedidoNecesidadImport[]): PedidoItem[] {
  return arr.map((it, i) => {
    const item: PedidoItem = {
      // Se renumera 1..n: la `secuencia` del SIGA puede venir con huecos o
      // repetida entre pedidos, y este número se imprime y se cita.
      descripcion: (it.descripcionDetallada ?? it.nombre ?? "").trim(),
      nro: i + 1,
    };
    if (it.codigoCatalogo) item.codigoCatalogo = it.codigoCatalogo;
    if (it.unidadMedida) item.unidadMedida = it.unidadMedida;
    if (it.cantidad !== undefined) item.cantidad = it.cantidad;
    return item;
  });
}

// Fusiona varios ítems de un pedido en una necesidad: el detalle enumera los
// ítems, y los datos de cabecera (área, cadena, fuente, meta, CUI…) se toman del
// primero con valor. Sin `secuencia`: así el POST vincula TODAS las filas del
// pedido a la necesidad, no solo una.
function fusionarPedido(arr: PedidoNecesidadImport[]): PedidoNecesidadImport {
  const primero = <K extends keyof PedidoNecesidadImport>(k: K): PedidoNecesidadImport[K] | undefined =>
    arr.map((it) => it[k]).find((v) => v !== undefined && v !== "");
  const detalle = arr
    .map((it, i) => {
      const cant =
        it.cantidad !== undefined
          ? ` (${it.cantidad}${it.unidadMedida ? ` ${it.unidadMedida}` : ""})`
          : "";
      return `${i + 1}. ${it.descripcionDetallada ?? it.nombre}${cant}`;
    })
    .join("\n");
  const base = arr[0];
  const out: PedidoNecesidadImport = {
    nombre: primero("nombre") ?? base.nombre,
    tipoObjeto: base.tipoObjeto,
    descripcionDetallada: detalle,
    // El detalle en prosa se conserva —es lo que se lee de un vistazo en la
    // ficha— pero los ítems van ADEMÁS como dato: es lo que permite sumarlos,
    // comprobar el tope del contrato menor y empaquetarlos.
    items: itemsDePedido(arr),
    nroPedido: base.nroPedido,
    summary: `Pedido de ${sustantivoPedido(base.tipoObjeto)} SIGA N° ${base.nroPedido} (${arr.length} ítems).`,
  };
  // Datos de cabecera compartidos por el pedido (primero con valor).
  const areaUsuaria = primero("areaUsuaria");
  if (areaUsuaria) out.areaUsuaria = areaUsuaria;
  const centroCosto = primero("centroCosto");
  if (centroCosto) out.centroCosto = centroCosto;
  const responsable = primero("responsable");
  if (responsable) out.responsable = responsable;
  const proyectoInversion = primero("proyectoInversion");
  if (proyectoInversion) out.proyectoInversion = proyectoInversion;
  const cadenaFuncional = primero("cadenaFuncional");
  if (cadenaFuncional) out.cadenaFuncional = cadenaFuncional;
  const clasificadorGasto = primero("clasificadorGasto");
  if (clasificadorGasto) out.clasificadorGasto = clasificadorGasto;
  const moneda = primero("moneda");
  if (moneda) out.moneda = moneda;
  const anioFiscal = primero("anioFiscal");
  if (anioFiscal !== undefined) out.anioFiscal = anioFiscal;
  const fechaRequerida = primero("fechaRequerida");
  if (fechaRequerida) out.fechaRequerida = fechaRequerida;
  // Rubro: dato de cabecera del pedido, igual en todas sus líneas.
  const rubro = primero("rubro");
  if (rubro) out.rubro = rubro;
  // Monto estimado: aquí SÍ se suman las líneas, a diferencia de la cantidad.
  // No es una ficción como sumar bolsas con varillas: todas son soles, y la
  // cuantía del requerimiento es la sumatoria de sus ítems (Art. 53.3).
  const montos = arr
    .map((it) => it.montoEstimado)
    .filter((m): m is number => typeof m === "number" && Number.isFinite(m));
  if (montos.length > 0) {
    out.montoEstimado = Math.round(montos.reduce((a, b) => a + b, 0) * 100) / 100;
  }
  const fuenteFinanciamiento = primero("fuenteFinanciamiento");
  if (fuenteFinanciamiento) out.fuenteFinanciamiento = fuenteFinanciamiento;
  const metaPresupuestal = primero("metaPresupuestal");
  if (metaPresupuestal) out.metaPresupuestal = metaPresupuestal;
  const cui = primero("cui");
  if (cui) out.cui = cui;
  // SIN cantidad ni unidad en la cabecera: van al cuadro de ítems, una por
  // prestación. Antes se totalizaban aquí para rellenar esos dos campos, que son
  // obligatorios en la ficha, pero esa suma era una ficción — sumar 500 bolsas
  // de cemento con 300 varillas de fierro no da nada— y solo se sostenía cuando
  // el requerimiento no podía desagregarse. Ahora que sí puede, el dato vive
  // donde corresponde y esos dos campos dejan de exigirse (ver
  // `noExigibleConItems` en la ficha).
  return out;
}

/**
 * Rescata el CUI de la cadena funcional.
 *
 * El SIGA compone la cadena como `funcion-programa-subprograma-act_proy-componente`,
 * así que el CUI es su cuarto segmento: "03-006-0010-2661009-6000008" → 2661009.
 *
 * Es para las fichas importadas ANTES de que el parser mapeara `act_proy`: el
 * dato nunca se perdió, solo no tenía columna propia. En las nuevas manda el
 * `cui` del pedido y esto no se usa.
 *
 * Devuelve null si la cadena no tiene la forma esperada: inventarse un código
 * de inversión es peor que dejar el campo vacío.
 */
export function cuiDeCadenaFuncional(cadena: string | null | undefined): string | null {
  const seg = (cadena ?? "").trim().split("-");
  if (seg.length < 5) return null;
  const cui = seg[3]?.trim();
  // Un CUI es numérico. Si el cuarto segmento no lo es, la cadena no tiene la
  // forma del SIGA y no se adivina.
  return cui && /^\d+$/.test(cui) ? cui : null;
}
