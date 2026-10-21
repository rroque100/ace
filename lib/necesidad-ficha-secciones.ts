/**
 * Definicion de la ficha del requerimiento: los campos, sus secciones y las
 * reglas que deciden cuales aplican a cada objeto y procedimiento.
 *
 * Vivia dentro de `necesidad-detail.tsx`. Se saca aqui porque es DATO PURO —ni
 * JSX ni React— y porque hay codigo de servidor que lo necesita: el precalculo
 * de los campos que exige cada PDF-modelo construye su clave de cache con una
 * HUELLA de este catalogo, asi que un script que usara otra lista guardaria algo
 * que la aplicacion nunca encontraria.
 *
 * De paso el componente adelgaza casi 500 lineas, y estas reglas —que son las que
 * deciden que campos ve el area usuaria— pasan a poder probarse sin renderizar.
 */
import type { Necesidad } from "./necesidades";
import {
  etiquetas,
  OPCIONES_MODALIDAD_PAGO,
  OPCIONES_MONEDA,
  OPCIONES_SISTEMA_ENTREGA,
} from "./opciones-contratacion";
import {
  OBJETOS_POR_PROCEDIMIENTO,
  type ObjetoFilter,
} from "./procesos-seleccion";

// Configuración de la ficha editable: cada campo mapea la columna (snake_case,
// para leer) con la clave del PATCH (camelCase) y su tipo de control.
export type FichaFieldKind = "text" | "number" | "textarea" | "date" | "requisitos" | "controversias" | "penalidades" | "personalClave" | "formacionAcademica" | "capacitacion" | "subcontratacion" | "adelanto" | "reajuste" | "select";

// Catálogo del "Tipo de proceso de selección" (referencia inicial del área
// usuaria) y su puente al PDF-modelo. Vive en lib/ para compartirse con el
// copiloto del servidor: al elegir un proceso, el copiloto ancla el RAG al
// modelo de requerimiento correspondiente (campo `pdf`).

export type FichaField = {
  col: keyof Necesidad;
  api: string;
  label: string;
  kind?: FichaFieldKind;
  /**
   * Valor con el que arranca el campo cuando no hay nada guardado.
   *
   * Se usa donde la norma YA impone un valor y «sin definir» no es un estado
   * legitimo: el computo del plazo es en dias calendario salvo excepcion (Art.
   * 105.3), y la conformidad se otorga en siete dias salvo que hagan falta
   * pruebas (Art. 144). Dejarlos vacios solo invita a que cada cual lo
   * interprete.
   *
   * En un desplegable, ademas, hace que no se ofrezca la opcion vacia. El
   * formulario lo siembra al abrir, asi que el valor EXISTE y se guarda; antes
   * solo lo pintaba el desplegable sin que el formulario lo tuviera.
   */
  porDefecto?: string;
  /**
   * Este campo se muestra siempre que se muestre AQUEL (por su `api`).
   *
   * Para pares que el modelo presenta juntos y que no tiene sentido separar:
   * «Otras penalidades» empieza literalmente por «Adicionalmente a la penalidad
   * por mora…». Sin esto quedaba escondida tras «Mostrar N campos opcionales»,
   * porque no es obligatoria ni la exige el modelo, y quien la buscaba no la
   * encontraba. No infla el modo «Solo obligatorios» con campos sueltos: solo
   * acompaña a uno que ya estaba en pantalla.
   */
  juntoA?: string;
  wide?: boolean;
  /**
   * Rango de un campo numerico, tal como lo acota el esquema.
   *
   * Se declaran para que el navegador los aplique en la propia casilla. Sin
   * ellos, el unico sitio donde se nota el tope es el 400 del guardado, que
   * llega despues y no dice donde mirar sin abrir el aviso.
   */
  min?: number;
  max?: number;
  /** Campo booleano (checkbox) */
  checkbox?: boolean;
  /**
   * Opciones del desplegable (solo `kind: "select"`).
   *
   * El `value` que se GUARDA es la etiqueta legible, no una clave: la siembra de
   * A3 (`normalizarModalidadPago`) reconoce el texto del área usuaria buscando
   * expresiones como "suma alzada", y una clave con guion bajo no casa.
   */
  opciones?: Array<{ value: string; label: string }>;
  /** Referencia legal (artículo de Ley/Reglamento) que sustenta el campo */
  baseLegal?: string;
  /** Ejemplo concreto para orientar al usuario no técnico */
  ejemplo?: string;
  /**
   * Fórmula de redacción, mostrada DENTRO del campo vacío.
   *
   * Distinta de `ejemplo`, que es una muestra corta y vive en el globo de
   * ayuda: la plantilla enseña las PARTES que el texto debe tener y en qué
   * orden, con los huecos entre corchetes. Se usa donde la norma impone una
   * estructura y un ejemplo suelto no basta para reproducirla.
   */
  plantilla?: string;
  /** Si se define, el campo solo se muestra para estos tipos de objeto */
  mostrarPara?: ObjetoFilter[];
  /**
   * Campo que se guarda pero no se muestra ni se valida: su valor lo aporta otro
   * campo por espejo (p. ej. Centro de costo = Área usuaria). Evita pedir dos
   * veces el mismo dato sin perder la columna en la base.
   */
  oculto?: boolean;
  /** Si es true, el campo es obligatorio según la Guía (Art. 154.1 para obras/consultoría) */
  obligatorio?: boolean;
  /**
   * Obligatorio SOLO para estos objetos (obligatorio condicional). P. ej.
   * "Sistema de entrega" se exige en obras/consultoría de obra pero no en
   * servicios, donde el formato de requerimiento no lo pide. Si el objeto
   * efectivo del proceso cae aquí, el campo se trata como obligatorio.
   */
  obligatorioPara?: ObjetoFilter[];
  /**
   * Si se define, el campo solo se muestra para ESTOS procedimientos (valores de
   * PROCESOS_SELECCION). Es un eje distinto del objeto: hay datos que solo
   * existen en un procedimiento concreto y no en su objeto entero. P. ej. el
   * código de catálogo solo tiene sentido en la Subasta Inversa Electrónica, que
   * se convoca sobre bienes comunes con ficha técnica del Listado; pedirlo en
   * toda contratación de bienes es ruido.
   *
   * Sin este eje, un campo que solo aplica a un procedimiento parece "muerto"
   * cuando se mira el consumo global, y se acaba borrando algo que sí se usa.
   */
  mostrarEnProceso?: string[];
  /** Obligatorio SOLO en estos procedimientos (obligatorio condicional por proceso). */
  obligatorioEnProceso?: string[];
  /**
   * Deja de exigirse cuando el requerimiento está desagregado en ítems.
   *
   * "Cantidad" y "Unidad de medida" en la cabecera solo tienen sentido con una
   * prestación. Desagregado, cada ítem lleva la suya y el dato de cabecera no
   * existe: sumar 500 bolsas de cemento con 300 varillas de fierro no da nada.
   * Seguir exigiéndolos obligaría a inventarse una cifra para poder guardar.
   */
  noExigibleConItems?: boolean;
  /**
   * Contenido del requerimiento que el Art. 44.2 exige "como mínimo, de
   * corresponder": no es obligatorio (por eso no bloquea el guardado), pero
   * tampoco es un extra de relleno. Se muestra SIEMPRE, incluso en el modo
   * "solo obligatorios": si se oculta, el área usuaria nunca propone y la
   * cadena propuesta → estrategia (Art. 44.7) queda muerta.
   */
  recomendado?: boolean;
  /**
   * Subgrupo por literal legal: varios campos comparten un mismo inciso del Art.
   * 44.2 (p. ej. 44.2.a agrupa alcance + condiciones + plazo). Se pone el MISMO
   * título en todos los campos del grupo; el render lo pinta UNA vez como
   * subtítulo, en lugar de repetir "a)"/"c)" en cada label —que se leía como un
   * error de numeración—. Es robusto ante campos ocultos: el subtítulo sale
   * antes del primer campo VISIBLE del grupo.
   */
  subgrupo?: string;
};

/**
 * Objetos efectivos de un requerimiento: si el procedimiento acota objetos,
 * manda ese ámbito (afinado al objeto declarado si cae dentro, Art. 44.10); si
 * no, el objeto declarado.
 *
 * Estaba copiado en cuatro sitios (medidor de avance, filtrado del formulario,
 * obligatorio condicional y campos objetivo de la IA). Cuatro copias de la misma
 * regla es cómo el medidor acaba contando campos que el formulario no enseña.
 */
export function objetosEfectivosDe(proceso: string, objeto?: ObjetoFilter): ObjetoFilter[] {
  const objetosProc = proceso ? OBJETOS_POR_PROCEDIMIENTO[proceso] : undefined;
  if (objetosProc) return objeto && objetosProc.includes(objeto) ? [objeto] : objetosProc;
  return objeto ? [objeto] : [];
}


/**
 * Etiqueta de un campo NO obligatorio pero que sí es contenido del
 * requerimiento.
 *
 * Estaba fija en "contenido del requerimiento (Art. 44.2)" para todo campo
 * `recomendado`. Al pasar a recomendados el problema identificado, el beneficio
 * esperado y la población beneficiaria —que son sustento de la finalidad
 * pública, Art. 44.1— la ficha empezó a atribuirles un artículo que no es el
 * suyo. Se toma el artículo de su PROPIA base legal.
 */
export function etiquetaRecomendado(f: FichaField): string {
  const art = f.baseLegal?.match(/Art\.\s*[\d.]+/)?.[0];
  return art ? `contenido del requerimiento (${art})` : "recomendado";
}

/** ¿El campo aplica al objeto y al procedimiento efectivos? (no mira `oculto`) */
export function campoAplica(f: FichaField, efectivos: ObjetoFilter[], proceso: string): boolean {
  // El eje de proceso es el más específico: si el campo lo declara y el proceso
  // ya está elegido, decide él. Con el proceso sin definir no se filtra: quien
  // aún no lo eligió debe poder ver el campo.
  if (f.mostrarEnProceso && proceso && !f.mostrarEnProceso.includes(proceso)) return false;
  if (!f.mostrarPara) return true;
  // Sin objeto ni proceso no hay con qué acotar: se muestra.
  if (efectivos.length === 0) return true;
  return f.mostrarPara.some((o) => efectivos.includes(o));
}

/** ¿El campo es obligatorio para ese objeto/procedimiento? */
export function campoObligatorio(f: FichaField, efectivos: ObjetoFilter[], proceso: string): boolean {
  if (f.obligatorio) return true;
  if (proceso && f.obligatorioEnProceso?.includes(proceso)) return true;
  return Boolean(f.obligatorioPara?.some((o) => efectivos.includes(o)));
}
/**
 * Asistente de la denominación (Art. 44.1 / 44.6 / 44.10).
 *
 * Propone el nombre con las piezas YA registradas en la ficha y señala las que
 * faltan, con la sección donde se rellenan. No completa huecos por su cuenta:
 * el nombre viaja al expediente y acaba impreso en el Anexo N° 2.
 */

/**
 * Todos los campos de la ficha que APLICAN al proceso/objeto, sin filtrar por
 * tipo. Es lo que se le pasa al modelo para que diga cuáles exige.
 *
 * Vive FUERA del componente porque no depende de su estado: solo de
 * FICHA_SECCIONES y del objeto efectivo. Dentro se declaraba después de su
 * primer uso y se recreaba en cada render.
 */
export function catalogoCampos(
  proceso: string,
  objeto?: string | null,
): Array<{ api: string; label: string; seccion: string }> {
  const efectivos = objetosEfectivosDe(proceso, (objeto ?? undefined) as ObjetoFilter | undefined);
  const out: Array<{ api: string; label: string; seccion: string }> = [];
  for (const section of FICHA_SECCIONES) {
    for (const f of section.fields) {
      if (f.oculto || !campoAplica(f, efectivos, proceso)) continue;
      out.push({ api: f.api, label: f.label, seccion: section.title });
    }
  }
  return out;
}

export type FichaSection = {
  title: string;
  fields: FichaField[];
  preliminar?: boolean;
  nota?: string;
  /**
   * Resumen de UNA frase en lenguaje llano (sin artículos ni jerga), para
   * orientar a quien no es técnico. Se muestra siempre como entradilla; en
   * "Modo simple" reemplaza a la nota legal.
   */
  resumenLlano?: string;
  simple?: boolean;
  /** Si se define, la sección solo se muestra para estos tipos de objeto */
  mostrarPara?: ObjetoFilter[];
};

// Orden de la ficha, alineado con el Art. 44 del Reglamento.
//
// La Necesidad ES el requerimiento del área usuaria, así que el recorrido sigue
// el del artículo: primero POR QUÉ (44.1 finalidad pública), luego QUÉ (44.10
// objeto, 126.1 EETT/TDR), luego EN QUÉ CONDICIONES (44.2), y al final lo
// administrativo. Antes la Justificación iba quinta, detrás de quince campos de
// presupuesto: quien formula tenía que atravesar rubros y clasificadores antes
// de poder decir para qué lo necesita.
export const FICHA_SECCIONES: FichaSection[] = [
  {
    title: "Identificación",
    resumenLlano: "Quién pide la contratación y datos básicos de la entidad y el año.",
    simple: true,
    fields: [
      { col: "area_usuaria", api: "areaUsuaria", label: "Área usuaria (y centro de costo)", obligatorio: true, baseLegal: "Art. 20.a Reglamento · el área usuaria formula su requerimiento en coordinación con la DEC, y ese requerimiento debe estar previsto en el CMN. Luego se lo remite (Art. 44.2).", ejemplo: "Oficina de Logística" },
      { col: "entidad", api: "entidad", label: "Entidad", obligatorio: true, baseLegal: "Ley 32069, Art. 4", ejemplo: "Ministerio de Vivienda" },
      { col: "unidad_ejecutora", api: "unidadEjecutora", label: "Unidad ejecutora", baseLegal: "Unidad ejecutora del pliego a la que se imputa la contratación. Identifica a la entidad contratante junto con su denominación y RUC.", obligatorio: true, ejemplo: "UE 001" },
      // Centro de costo = Área usuaria (siempre espejado). Se guarda pero no se
      // muestra: pedirlo aparte era registrar dos veces el mismo dato.
      // Espejo del área usuaria: se guarda pero no se muestra. Estaba marcado
      // `obligatorio` a la vez que `oculto`, dos cosas que se contradicen — no
      // hay forma de rellenar un campo que no se enseña.
      { col: "centro_costo", api: "centroCosto", label: "Centro de costo", oculto: true, ejemplo: "CC-1234" },
      { col: "responsable", api: "responsable", label: "Responsable", baseLegal: "Art. 20.a Reglamento · formular adecuadamente el requerimiento es función del área usuaria; quien firma responde de su contenido.", obligatorio: true, ejemplo: "Nombre del jefe de área" },
      { col: "anio_fiscal", api: "anioFiscal", label: "Año fiscal", kind: "number", obligatorio: true, baseLegal: "Ejercicio presupuestal al que corresponde la necesidad, según el CMN.", ejemplo: "2026" },
    ],
  },
  {
    title: "Programación y presupuesto",
    resumenLlano: "Cuánto cuesta aproximadamente, con qué fondos se paga y para cuándo se necesita.",
    simple: true,
    fields: [
      // Eran 19 campos en fila corrida. Se agrupan siguiendo el recorrido de quien
      // rellena: dónde está programada la necesidad, a qué inversión se imputa, con
      // qué fuente se paga, cuánto vale y para cuándo se necesita. El periodo del CMN
      // vivia en Identificación, que no es donde se busca.
      { subgrupo: "a) Programación en el CMN y el PAC", col: "periodo_programacion", api: "periodoProgramacion", label: "Periodo de programación", baseLegal: "Art. 20.a Reglamento · el requerimiento debe estar previsto en el CMN; aquí va el periodo multianual al que corresponde.", ejemplo: "2026-I" },
      { subgrupo: "a) Programación en el CMN y el PAC", col: "meta_presupuestal", api: "metaPresupuestal", label: "Meta presupuestal", obligatorio: true, baseLegal: "Meta del presupuesto institucional que financia la contratación.", ejemplo: "Meta 001" },
      { subgrupo: "a) Programación en el CMN y el PAC", col: "trimestre", api: "trimestre", label: "Trimestre", kind: "number", min: 1, max: 4, baseLegal: "Trimestre en que el PAC prevé ejecutar la contratación (1 a 4).", ejemplo: "1" },
      { subgrupo: "a) Programación en el CMN y el PAC", col: "mes_programado", api: "mesProgramado", label: "Mes programado", kind: "number", min: 1, max: 12, baseLegal: "Mes previsto en el PAC (1 a 12).", ejemplo: "3" },
      { subgrupo: "b) Inversión a la que se imputa", col: "cui", api: "cui", label: "Código Único de Inversión (CUI)", recomendado: true, baseLegal: "Art. 46.1.c Reglamento · lo pide la variable c) del Formato de Estrategia. Viene de act_proy del pedido SIGA.", ejemplo: "2661009" },
      { subgrupo: "b) Inversión a la que se imputa", col: "cadena_funcional", api: "cadenaFuncional", label: "Cadena funcional", baseLegal: "Cadena funcional programática del SIGA; su 4.º segmento lleva el CUI.", ejemplo: "21-046-0102-2656190-4000129" },
      { subgrupo: "b) Inversión a la que se imputa", col: "clasificador_gasto", api: "clasificadorGasto", label: "Clasificador de gasto", baseLegal: "Clasificador de gastos del SIAF; va a la solicitud de certificación presupuestal.", ejemplo: "2.3.1.1.1" },
      { subgrupo: "b) Inversión a la que se imputa", col: "proyecto_inversion", api: "proyectoInversion", label: "Proyecto de inversión (nombre)", kind: "textarea", wide: true, baseLegal: "Art. 46.1.c Reglamento · declaración de viabilidad del proyecto de inversión.", ejemplo: "186 MEJORAMIENTO Y AMPLIACION DE LOS SERVICIOS DE AGUA POTABLE Y SANEAMIENTO BASICO EN LAS LOCALIDADES DE …, DISTRITO DE CHALLHUAHUACHO, PROVINCIA DE COTABAMBAS, DEPARTAMENTO DE APURIMAC" },
      { subgrupo: "b) Inversión a la que se imputa", col: "ioarr", api: "ioarr", label: "IOARR", baseLegal: "Art. 46.1.c Reglamento · aprobación de la IOARR.", ejemplo: "IOARR-5678" },
      { subgrupo: "c) Financiamiento", col: "fuente_financiamiento", api: "fuenteFinanciamiento", label: "Fuente de financiamiento", obligatorio: true, baseLegal: "Fuente de financiamiento del clasificador del MEF con la que se atiende la necesidad.", ejemplo: "Recursos Ordinarios" },
      { subgrupo: "c) Financiamiento", col: "rubro", api: "rubro", label: "Rubro", obligatorio: true, baseLegal: "Rubro de financiamiento del SIGA (col. `fuente_fto` del pedido).", ejemplo: "18" },
      { subgrupo: "c) Financiamiento", col: "moneda", api: "moneda", label: "Moneda", kind: "select", opciones: OPCIONES_MONEDA, baseLegal: "Moneda del requerimiento; determina cómo se expresa la cuantía (Art. 47.1).", ejemplo: "PEN" },
      { subgrupo: "d) Cuantía de la contratación", col: "monto_estimado", api: "montoEstimado", label: "Monto estimado (S/)", kind: "number", obligatorio: true, baseLegal: "Ley 32069, Art. 48 · la entidad establece la CUANTÍA de la contratación para gestionar los recursos presupuestales. Art. 47.1 Reglamento · el valor definitivo lo fija la interacción con el mercado; esta es la estimación de partida.", ejemplo: "50000" },
      { subgrupo: "d) Cuantía de la contratación", col: "costo_unitario", api: "costoUnitario", label: "Costo unitario (S/)", kind: "number", baseLegal: "Art. 47.1 Reglamento · base de la cuantía en Subasta Inversa y Comparación de Precios, donde se compara por unitario.", ejemplo: "12.50", obligatorioEnProceso: ["Subasta Inversa Electrónica", "Comparación de Precios"] },
      { subgrupo: "d) Cuantía de la contratación", col: "costo_total", api: "costoTotal", label: "Costo total (S/)", kind: "number", baseLegal: "Costo total de la partida (cantidad × costo unitario). Al desagregar el requerimiento en ítems, la cuantía sale de la sumatoria de sus importes (Art. 52).", ejemplo: "6250" },
      { subgrupo: "d) Cuantía de la contratación", col: "anio_referencia", api: "anioReferencia", label: "Año de referencia", kind: "number", ejemplo: "2026", obligatorioEnProceso: ["Comparación de Precios", "Subasta Inversa Electrónica"], baseLegal: "Art. 47.1 Reglamento · año del precio de referencia con el que se actualiza la cuantía." },
      { subgrupo: "e) Fechas del requerimiento", col: "fecha_requerida", api: "fechaRequerida", label: "Fecha requerida", kind: "date", baseLegal: "Fecha para la que se necesita; la DEC estima contra ella el cronograma (Art. 46.1.o).", obligatorio: true, ejemplo: "2026-03-15" },
      { subgrupo: "e) Fechas del requerimiento", col: "fecha_remision_dec", api: "fechaRemisionDec", label: "Fecha de recepción por la DEC", kind: "date", obligatorio: true, baseLegal: "Art. 44.2 Reglamento · El área usuaria remite el requerimiento a la DEC", ejemplo: "2026-03-16" },
      { subgrupo: "e) Fechas del requerimiento", col: "fecha_version_dos", api: "fechaVersionDos", label: "Fecha de la 2ª versión del requerimiento", kind: "date", baseLegal: "Art. 44.7 Reglamento · Ciclo de no objeción (mejora del requerimiento)", ejemplo: "2026-03-20" },
      { subgrupo: "e) Fechas del requerimiento", col: "fecha_version_n", api: "fechaVersionN", label: "Fecha de la \"n\" versión del requerimiento", kind: "date", baseLegal: "Art. 44.7 Reglamento · Última iteración del requerimiento", ejemplo: "2026-03-27" },
      ],
    },
    {
    title: "3.1 Finalidad pública de la contratación",
    resumenLlano: "Explica para qué se necesita esta contratación: qué problema resuelve y a quién beneficia.",
    simple: true,
    nota: "El requerimiento atiende una necesidad para el cumplimiento de la finalidad pública, promoviendo el valor por dinero (Art. 44.1 del Reglamento · Bases Estándar, Cap. III · 3.1).",
    // El sustento de la finalidad (problema, objetivo, beneficio, población) se
    // retiró: no lo consumía ninguna fase, ya no se imprime en ningún documento
    // desde que se quitó la Ficha en Word, y su único uso era dar contexto a la
    // IA. Lo que el Art. 44.1 exige es la finalidad pública, que sí se conserva.
    fields: [
      // La fórmula sale LITERALMENTE del Art. 44.1 del Reglamento: "atienden una
      // NECESIDAD para el cumplimiento de la FINALIDAD PÚBLICA, promoviendo el
      // VALOR POR DINERO". Esas tres piezas, en ese orden, son la estructura que
      // el texto debe reproducir; el cierre recoge los términos con que la Ley
      // 32069 define el valor por dinero (Art. 5.1.c: eficiencia, eficacia y
      // economía). No se cita otra normativa a propósito: el requerimiento se
      // sustenta en la Ley 32069 y su Reglamento, y meter aquí normas generales
      // desplaza el fundamento propio de la contratación.
      {
        col: "finalidad_publica",
        api: "finalidadPublica",
        label: "Finalidad pública",
        kind: "textarea",
        wide: true,
        obligatorio: true,
        baseLegal:
          "Reglamento Art. 44.1 · el requerimiento atiende una NECESIDAD para el cumplimiento de la FINALIDAD PÚBLICA, promoviendo el VALOR POR DINERO.\n" +
          "Ley 32069 Art. 5.1.c · el valor por dinero maximiza lo obtenido en términos de eficiencia, eficacia y economía.\n" +
          "Ley 32069 Art. 27.2 · la decisión debe ser la más conveniente para alcanzar la finalidad pública del contrato.",
        plantilla:
          "La contratación de [OBJETO] atiende la necesidad de [NECESIDAD CONCRETA DEL ÁREA USUARIA], " +
          "para el cumplimiento de la finalidad pública de [COMPETENCIA O SERVICIO PÚBLICO A CARGO DE LA ENTIDAD], " +
          "promoviendo el valor por dinero en términos de eficiencia, eficacia y economía.",
        ejemplo:
          "La contratación del servicio de mantenimiento de vías vecinales atiende la necesidad de transitabilidad " +
          "segura en el distrito, para el cumplimiento de la finalidad pública de conservar la infraestructura vial " +
          "a cargo de la municipalidad, promoviendo el valor por dinero en términos de eficiencia, eficacia y economía.",
      },
    ],
  },
  {
    title: "3.2 Descripción general del requerimiento",
    resumenLlano: "Di qué es lo que se va a contratar, en cuánta cantidad y con qué unidad de medida.",
    simple: true,
    nota: "Describe el requerimiento en conjunto e incluye los ítems o paquetes —el cuadro de abajo los desagrega— y, si la prestación principal las conlleva, las prestaciones accesorias. El objeto se determina por la naturaleza de la contratación; con varias prestaciones, manda la de mayor costo (Art. 44.10). La descripción TÉCNICA detallada (EETT/TDR) NO va aquí: es el 3.4.",
    fields: [
      { col: "especialidad", api: "especialidad", label: "Especialidad", obligatorioPara: ["obras", "consultoria_obra"], mostrarPara: ["obras", "consultoria_obra"], baseLegal: "Art. 72.3.b Reglamento · en obras y consultoría de obras la experiencia del personal clave corresponde a la especialidad y subespecialidad (Art. 157).", ejemplo: "Bienes comunes" },
      { col: "subespecialidad", api: "subespecialidad", label: "Subespecialidad", mostrarPara: ["obras", "consultoria_obra"], baseLegal: "Art. 157 Reglamento · subespecialidad de la experiencia en obras y consultoría de obras.", ejemplo: "Útiles de oficina" },
      // El código de catálogo se registra AHORA POR ÍTEM, en el cuadro de la
      // sección 3.2: un pedido de varias líneas trae un código por prestación y
      // aquí solo cabía uno. Se guarda pero no se muestra —la columna sigue viva
      // y las necesidades antiguas conservan su valor—. La exigencia de la
      // Subasta Inversa (bienes comunes con FICHA TÉCNICA del Listado) se cumple
      // ahora en la columna del cuadro, que es donde está el dato.
      { col: "codigo_catalogo", api: "codigoCatalogo", label: "Código de catálogo", oculto: true, ejemplo: "CAT-00123" },
      // A fila completa: al importar recibe el motivo del pedido (col. S), que es
      // una frase larga y en un campo estrecho se leía a trozos.
      // Lo que el 3.2 del modelo pide de verdad: «INDICAR LA DESCRIPCIÓN GENERAL
      // DEL REQUERIMIENTO, INCLUYENDO LOS ÍTEMS O PAQUETES, DE SER EL CASO. EN CASO
      // LA PRESTACIÓN PRINCIPAL CONLLEVE PRESTACIONES ACCESORIAS, CONSIGNARLAS».
      // No existía: la ficha tenía el nombre de catálogo y el cuadro de ítems, pero
      // ningún sitio donde describir el requerimiento en conjunto.
      { col: "descripcion_general", api: "descripcionGeneral", label: "Descripción general del requerimiento", kind: "textarea", wide: true, obligatorio: true, baseLegal: "Art. 44.2 Reglamento · el requerimiento describe la prestación; el cuadro de ítems de abajo la desagrega cuando son varias (Arts. 52 y 53.3).", plantilla: "Se requiere [OBJETO] para [FINALIDAD OPERATIVA]. Comprende [NÚMERO] ítem(es) o paquete(s), detallados en el cuadro. La prestación principal es [PRESTACIÓN] y conlleva las prestaciones accesorias de [ACCESORIAS, si las hay].", ejemplo: "Se requiere el servicio de mantenimiento de vías vecinales para asegurar la transitabilidad. Comprende 3 ítems, detallados en el cuadro." },
      { col: "prestaciones_accesorias", api: "prestacionesAccesorias", label: "Prestaciones accesorias de la prestación principal", kind: "textarea", wide: true, baseLegal: "Art. 44.4 Reglamento · se evalúa la necesidad de prestaciones accesorias —mantenimiento preventivo y correctivo, operación— considerando el ciclo de vida del activo. El formato pide consignarlas aquí cuando la prestación principal las conlleve; su detalle técnico va en el 3.4.", ejemplo: "Mantenimiento preventivo semestral durante los dos primeros años." },
      { col: "descripcion_catalogo", api: "descripcionCatalogo", label: "Descripción de catálogo", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 44.6 Reglamento · Es el qué del nombre de la contratación, en términos genéricos: no debe referir marca, fabricante ni patente. Al importar se toma del motivo del pedido (col. S), así que conviene revisarlo.", ejemplo: "Papel bond A4" },
      // "Cantidad" y "Unidad de medida" YA NO ESTÁN aquí: describían una sola
      // prestación y el cuadro de ítems las lleva por línea (Art. 44.10 · 52).
      // Las columnas siguen en la base —hay necesidades antiguas con esos datos
      // y los exportables los leen— pero no se piden en el formulario: pedir un
      // dato de cabecera que contradice al desagregado solo genera descuadres.
      { col: "frecuencia", api: "frecuencia", label: "Frecuencia", baseLegal: "Art. 126.2 Reglamento · en provisión continua o periódica el plazo no puede ser menor a un año.", ejemplo: "Mensual" },
    ],
  },
  {
    // Los cinco literales del 44.2, juntos. Antes estaban repartidos entre
    // "Objeto" y una sección llamada "Estrategia de contratación", que es otro
    // artefacto: la estrategia la hace la DEC en el expediente (Art. 46), no el
    // área usuaria en su requerimiento.
    title: "3.3 Condiciones de contratación",
    resumenLlano: "Cómo se ejecutará: plazo, forma de pago, entrega y demás condiciones. Lo obligatorio ya viene marcado.",
    simple: false,
    nota: "Condiciones de contratación (Art. 44.2 · Bases Estándar, Cap. III · 3.3): modalidad de pago, sistema de entrega, plazo y lugar de prestación, adelantos, subcontratación y fórmula de reajuste. La DEC las decide después en la Estrategia (A4); si las cambia, requiere la no objeción del área usuaria (Art. 44.7). Los requisitos de calificación van en la sección 3.5.",
    fields: [
      // Los apartados van en el ORDEN Y CON LAS LETRAS del requerimiento modelo
      // (3.3, apartados a-j). Antes se rotulaban con las letras del Art. 44.2 del
      // Reglamento —a) alcance, c) modalidad de pago, e) fórmula de reajuste—, que
      // son otra numeración distinta: quien trasladaba la ficha al documento tenía
      // que reordenar de cabeza. La cita del 44.2 sigue en la base legal de cada
      // campo, que es donde corresponde.
      { col: "modalidad_pago", api: "modalidadPago", label: "Propuesta de modalidad de pago", subgrupo: "a) Modalidad de pago", kind: "select", opciones: etiquetas(OPCIONES_MODALIDAD_PAGO), recomendado: true, baseLegal: "Art. 44.2.c Reglamento · la modalidad de pago es contenido mínimo del requerimiento: el área usuaria la propone y la DEC la determina en la estrategia (Art. 46.1.h). Las modalidades posibles son las siete del Art. 130: suma alzada, precios unitarios, esquema mixto, tarifas, porcentajes, honorario fijo más comisión de éxito y pago por consumo.", ejemplo: "Suma alzada" },
      // Sin `mostrarPara`: aplica a los CUATRO objetos. Estaba limitado a servicios,
      // obras y consultoria de obra, y el PDF-modelo de Licitacion Publica abreviada
      // PARA BIENES trae este apartado: la ficha lo escondia y el area usuaria no
      // tenia donde escribirlo, asi que el requerimiento salia con un apartado que
      // nadie podia rellenar. Manda el modelo, y ademas lo EXIGE: obligatorio tambien en bienes.
      { col: "sistema_entrega", api: "sistemaEntrega", label: "Propuesta de sistema de entrega", subgrupo: "b) Sistema de entrega", kind: "select", opciones: etiquetas(OPCIONES_SISTEMA_ENTREGA), obligatorioPara: ["bienes", "obras", "consultoria_obra"], baseLegal: "Art. 44.2.c Reglamento · el sistema de entrega es contenido mínimo del requerimiento: el área usuaria lo propone y la DEC lo determina en la estrategia (Art. 46.1.i). Los sistemas posibles son los del Art. 129; si no se prevé ninguno, se elige «No aplica».", ejemplo: "Llave en mano" },
      { col: "plazo_ejecucion", api: "plazoEjecucion", label: "Plazo de ejecución o prestación (días)", subgrupo: "c) Plazo de prestación", kind: "number", obligatorio: true, baseLegal: "Art. 126.2 Reglamento · En bienes y servicios rutinarios u operacionales de provisión continua, no puede ser menor a un año.", ejemplo: "60" },
      { col: "plazo_ejecucion_unidad", api: "plazoEjecucionUnidad", label: "Cómputo del plazo", subgrupo: "c) Plazo de prestación", kind: "select", obligatorio: true, porDefecto: "calendario", opciones: [{ value: "calendario", label: "Días calendario" }, { value: "habiles", label: "Días hábiles" }], baseLegal: "Art. 105.3 Reglamento · durante la ejecución contractual los plazos se cuentan en días CALENDARIO, salvo que el Reglamento indique lo contrario; supletoriamente rigen los Arts. 183 y 184 del Código Civil.", ejemplo: "Días calendario" },
      { subgrupo: "d) Lugar de prestación", col: "departamento", api: "departamento", label: "Departamento", recomendado: true, baseLegal: "Art. 44.2 Reglamento · lugar de entrega o de prestación, de corresponder.", ejemplo: "Lima" },
      { subgrupo: "d) Lugar de prestación", col: "provincia", api: "provincia", label: "Provincia", recomendado: true, baseLegal: "Art. 44.2 Reglamento · lugar de entrega o de prestación, de corresponder.", ejemplo: "Lima" },
      { subgrupo: "d) Lugar de prestación", col: "distrito", api: "distrito", label: "Distrito", recomendado: true, baseLegal: "Art. 44.2 Reglamento · lugar de entrega o de prestación, de corresponder.", ejemplo: "San Isidro" },
      { subgrupo: "d) Lugar de prestación", col: "lugar_entrega", api: "lugarEntrega", label: "Lugar de prestación o entrega", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 44.2 Reglamento · lugar concreto de entrega o de prestación.", ejemplo: "Av. Principal 123" },
      { subgrupo: "e) Adelanto directo", col: "adelanto_directo", api: "adelantoDirecto", label: "Adelanto directo", kind: "adelanto", wide: true, recomendado: true, baseLegal: "Art. 137 Reglamento · en bienes y servicios solo se otorga adelanto directo en los supuestos que ahí se tasan.", plantilla: "La entidad contratante otorgará [NÚMERO] adelanto(s) directo(s) por el [PORCENTAJE, no mayor al 30% del monto del contrato original (Art. 66.3)]. El contratista lo solicita adjuntando el mecanismo de garantía (Art. 137). En bienes y servicios el Reglamento no fija un plazo de solicitud.", ejemplo: "Hasta 30% del monto del contrato" },
      { subgrupo: "f) Penalidades", col: "penalidad_mora", api: "penalidadMora", label: "Penalidad por mora", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 120 Reglamento · penalidad por mora ante retraso injustificado; el Art. 119 exige que el contrato la establezca junto con las demás penalidades.", ejemplo: "0.10 × monto / (F × plazo en días)" },
      // El Art. 119.1 pide que el contrato establezca la penalidad por mora Y OTRAS
      // penalidades. El apartado f) del modelo trae un cuadro para ellas (supuesto,
      // forma de calculo y procedimiento de verificacion) que la ficha no recogia.
      { subgrupo: "f) Penalidades", col: "otras_penalidades", api: "otrasPenalidades", label: "Otras penalidades", juntoA: "penalidadMora", kind: "penalidades", wide: true, baseLegal: "Arts. 119.1 y 119.2 Reglamento · el contrato establece la penalidad por mora Y otras penalidades ante el incumplimiento injustificado de las obligaciones contractuales.", ejemplo: "No presentar el informe mensual en plazo · 0.5 UIT por informe · acta del área usuaria." },
      // Sin `mostrarPara`: aplica a los CUATRO objetos. Estaba limitado a servicios,
      // obras y consultoria de obra, y el PDF-modelo de Licitacion Publica abreviada
      // PARA BIENES trae este apartado: la ficha lo escondia y el area usuaria no
      // tenia donde escribirlo, asi que el requerimiento salia con un apartado que
      // nadie podia rellenar. Manda el modelo (confirmado con la entidad).
      { subgrupo: "g) Subcontratación", col: "subcontratacion", api: "subcontratacion", label: "Subcontratación", kind: "subcontratacion", wide: true, baseLegal: "Art. 108.1 Reglamento · se subcontrata hasta el 40% del monto del contrato vigente; las bases pueden excluir prestaciones esenciales o, si así se evaluó en la estrategia de contratación Y con el sustento correspondiente, prohibirla.", ejemplo: "Prohibida / Permitida hasta 40%" },
      { subgrupo: "h) Fórmula de reajuste", col: "formula_reajuste", api: "formulaReajuste", label: "Fórmula de reajuste", plantilla: "[DE SER EL CASO, CONSIGNAR LAS FÓRMULAS DE REAJUSTE CORRESPONDIENTES Y EL PROCEDIMIENTO, DE ACUERDO CON LO PREVISTO EN EL NUMERAL 136.2 DEL ARTÍCULO 136 DEL REGLAMENTO]", kind: "reajuste", wide: true, recomendado: true, baseLegal: "Arts. 136.2 y 209 Reglamento · en bienes, servicios y consultoría en general de ejecución PERIÓDICA O CONTINUADA el reajuste sigue la variación del IPC nacional o de Lima Metropolitana del mes de pago (Art. 136.2); en obras y consultoría de obras se aplican fórmulas polinómicas con los Índices Unificados de Precios de la Construcción del INEI (Art. 209). A propuesta del área usuaria y validado en la estrategia de contratación.", ejemplo: "Fórmula polinómica basada en el índice de precios del INEI" },
      { subgrupo: "i) Solución de controversias contractuales", col: "solucion_controversias", api: "solucionControversias", label: "Solución de controversias contractuales", kind: "controversias", wide: true, recomendado: true, baseLegal: "Arts. 330-332 Reglamento · las controversias se resuelven por conciliación y arbitraje (Arts. 330 y 331); la entidad propone en las bases la lista de Instituciones Arbitrales —con inscripción vigente en el REGAJU (Art. 332.1)— y el postor ganador elige una (Art. 332.2). El Art. 224, que citaba antes este campo, es de contratos estandarizados de ingeniería y construcción de uso internacional.", ejemplo: "Cámara de Comercio de Lima — RUC 20112273922" },
      // NUMERO de dias, tambien en el esquema. Estaba declarado numero aqui y
      // validado como texto alli, asi que `construirPayload` mandaba un numero
      // que el PATCH rechazaba con 400 en CADA guardado. El texto del apartado
      // vive en `plazoRespuestasTexto`, que es lo que se redacta.
      { subgrupo: "j) Plazo para respuestas entre las partes", col: "plazo_respuestas", api: "plazoRespuestas", label: "Plazo máximo de respuesta entre las partes (días calendario)", kind: "number", min: 1, max: 365, baseLegal: "Apartado j) del formato · plazo en que las partes se responden durante la ejecución; el Reglamento no fija uno general (sí plazos por procedimiento, p. ej. Arts. 108.3 y 201). El cómputo es en días calendario (Art. 105.3).", ejemplo: "10" },
      // El apartado j) ya redactado. El plazo de arriba sigue siendo un NUMERO,
      // con el que se puede contar y comparar; el texto va aparte porque son dos
      // cosas distintas y meterlas en la misma columna obligaba a adivinar cual
      // de las dos habia dentro.
      { col: "plazo_respuestas_texto", api: "plazoRespuestasTexto", label: "Texto del apartado j)", subgrupo: "j) Plazo para respuestas entre las partes", kind: "textarea", wide: true, baseLegal: "Apartado j) del formato · texto fijo con un solo hueco, el plazo. Se compone con «Redactar con IA» a partir del plazo de arriba.", ejemplo: "PLAZO PARA RESPUESTAS ENTRE LAS PARTES…" },

      // Lo que el Art. 44.2 exige y el modelo no numera en su 3.3. Va detrás y con
      // rótulo propio para que no se confunda con la lista de letras.
      // FORMA DE PAGO. No esta en ningun PDF-modelo de los cargados: lo pide la
      // entidad. El texto lo fija el Art. 67 de la Ley y solo tiene CINCO huecos,
      // asi que se registran los huecos y el apartado se compone con ellos
      // (lib/forma-pago.ts). Se guarda ademas el texto compuesto porque es lo que
      // viaja al Word y lo que se firma; los huecos quedan para poder rehacerlo.
      { col: "forma_pago_tipo", api: "formaPagoTipo", label: "Pago único o pagos a cuenta", subgrupo: "Forma de pago (Art. 67 de la Ley)", kind: "select", opciones: [{ value: "un pago único", label: "Pago único" }, { value: "pagos a cuenta", label: "Pagos a cuenta" }], recomendado: true, baseLegal: "Art. 67 de la Ley · el requerimiento precisa si el pago es único o a cuenta y, en el segundo caso, su detalle.", ejemplo: "Pago único" },
      // El otro medio corchete del formato: «…ASÍ COMO EL DETALLE QUE
      // CORRESPONDE EN EL CASO DE PAGO A CUENTA». El tipo se ELIGE de una lista
      // de dos y el detalle se ESCRIBE, así que son dos campos. Al cerrar el
      // tipo en un desplegable el detalle se quedó sin sitio donde escribirse y
      // el apartado salía sin decir cuántos pagos ni contra qué entregables.
      { col: "forma_pago_detalle", api: "formaPagoDetalle", label: "Detalle de los pagos a cuenta", subgrupo: "Forma de pago (Art. 67 de la Ley)", kind: "textarea", wide: true, baseLegal: "Art. 67 de la Ley · solo si el pago es a cuenta: cuántos pagos, contra qué entregables y en qué proporción. En un pago único no hay nada que detallar y este campo no entra en el texto.", ejemplo: "Tres pagos a cuenta del 30%, 30% y 40% del monto contratado, contra la conformidad de cada entregable." },
      // La etiqueta son las palabras del corchete del formato —«REGISTRAR LA
      // DENOMINACIÓN DEL ÁREA RESPONSABLE DE OTORGAR LA CONFORMIDAD»— y no un
      // resumen. Se llamaba «Área que otorga la conformidad» y no se reconocía
      // al cotejar la ficha contra la base estándar: quien buscaba el corchete
      // no encontraba su casilla.
      { col: "forma_pago_area_conformidad", api: "formaPagoAreaConformidad", label: "Denominación del área responsable de otorgar la conformidad", subgrupo: "Forma de pago (Art. 67 de la Ley)", recomendado: true, baseLegal: "El pago exige el documento de conformidad suscrito por el servidor responsable del área que se designe aquí. Es también el área del Art. 144, así que solo se pide una vez. Si la contratación se imputa a una inversión, el texto del apartado añade solo el proyecto y su CUI de «b) Inversión a la que se imputa».", ejemplo: "Sub Gerencia de Desarrollo Económico" },
      { col: "forma_pago_documentacion", api: "formaPagoDocumentacion", label: "Otra documentación para el pago", subgrupo: "Forma de pago (Art. 67 de la Ley)", kind: "textarea", baseLegal: "Además de la conformidad y el comprobante de pago, que van siempre, lo que esta contratación exija.", ejemplo: "Acta de entrega de los bienes en almacén" },
      { col: "forma_pago_lugar", api: "formaPagoLugar", label: "Dónde se presenta la documentación", subgrupo: "Forma de pago (Art. 67 de la Ley)", baseLegal: "Mesa de partes o la dependencia concreta donde el contratista presenta lo que no es la conformidad.", ejemplo: "Mesa de Partes de la Municipalidad" },
      { col: "forma_pago_direccion", api: "formaPagoDireccion", label: "Dirección exacta", subgrupo: "Forma de pago (Art. 67 de la Ley)", baseLegal: "Dirección completa de esa dependencia: el contratista tiene que poder llegar. Se trae sola del domicilio de la entidad (Configuración → Datos de la entidad); cámbiala si la documentación se presenta en otra sede.", ejemplo: "Plaza de Armas S/N, Challhuahuacho, Cotabambas, Apurímac" },
      { col: "forma_pago", api: "formaPago", label: "Forma de pago (texto del apartado)", subgrupo: "Forma de pago (Art. 67 de la Ley)", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 67 de la Ley · es el texto que va al requerimiento. Se compone con «Redactar con IA» a partir de los cinco campos de arriba; el texto de la Ley es literal y no se parafrasea.", ejemplo: "El pago se realiza de conformidad con lo establecido en el artículo 67 de la Ley…" },
      { col: "alcance", api: "alcance", label: "Alcance de la contratación", subgrupo: "Alcance y condiciones de ejecución (Art. 44.2.a)", kind: "textarea", wide: true, recomendado: true, obligatorioPara: ["obras", "consultoria_obra"], baseLegal: "Art. 44.2.a Reglamento · el alcance y las condiciones de ejecución se definen en función del desempeño y la funcionalidad.", ejemplo: "Suministro a nivel nacional" },
      { col: "condiciones_ejecucion", api: "condicionesEjecucion", label: "Condiciones de ejecución", subgrupo: "Alcance y condiciones de ejecución (Art. 44.2.a)", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 44.2.a Reglamento · En función del desempeño y la funcionalidad.", ejemplo: "Entrega en 30 días calendario" },
      { col: "equipamiento_minimo", api: "equipamientoMinimo", label: "Equipamiento mínimo", subgrupo: "Equipamiento y habilitaciones (Art. 44.2.d)", kind: "textarea", wide: true, baseLegal: "Art. 44.2.d Reglamento · Recursos que el contratista necesita para ejecutar la contratación.", ejemplo: "2 camionetas, 1 almacén" },
      { col: "habilitaciones", api: "habilitaciones", label: "Habilitaciones y permisos", subgrupo: "Equipamiento y habilitaciones (Art. 44.2.d)", kind: "textarea", wide: true, baseLegal: "Art. 44.2.d Reglamento", ejemplo: "Licencia municipal, RNP" },
      // Los campos de un subgrupo van SEGUIDOS. El formulario agrupa recorriendo
      // la lista y usa el nombre del subgrupo como clave de React: si el mismo
      // nombre reaparece más abajo, salen dos bloques con la misma clave y React
      // avisa de que puede duplicar u omitir hijos. Pasó al meter «Recepción y
      // conformidad» en medio y dejar aquí «Gestión de riesgos». Una prueba lo
      // vigila ahora en las nueve secciones.
      { subgrupo: "Otras condiciones del contrato", col: "garantias", api: "garantias", label: "Garantías (fiel cumplimiento, etc.)", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 138 Reglamento · garantía de fiel cumplimiento en bienes y servicios; el Art. 139 fija las excepciones y el Art. 113 los tipos de garantía.", ejemplo: "Garantía de fiel cumplimiento 10% del contrato" },
      { subgrupo: "Otras condiciones del contrato", col: "gestion_riesgos", api: "gestionRiesgos", label: "Gestión de riesgos", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 44.3 Reglamento · al elaborar el requerimiento se inicia la identificación y evaluación de riesgos y su asignación a alguna de las partes, que es insumo de la estrategia de contratación.", ejemplo: "Matriz de riesgos y asignación entre las partes" },
      // Los huecos del apartado del Art. 144. Cada objeto pide los suyos: en
      // BIENES hay dos actos —recepcion de almacen y conformidad del area
      // usuaria— y en SERVICIOS solo conformidad, asi que el area de almacen no
      // se enseña donde no aplica y el plazo de subsanacion solo donde es hueco
      // (en bienes el 30% va fijo en el texto). El apartado se compone con
      // «Redactar con IA» en `recepcionConformidad` (lib/recepcion-conformidad.ts).
      // Sin `mostrarPara`: el bloque entero se enseña en los cuatro objetos. Los
      // dos campos de abajo estaban acotados a su objeto —almacén solo en
      // bienes, subsanación solo en servicios— y el bloque salía distinto según
      // qué se estuviera registrando, sin decir por qué faltaba lo que faltaba.
      // Lo que sigue dependiendo del objeto es la PLANTILLA del apartado
      // (lib/recepcion-conformidad.ts): ahí cada formato usa los suyos, y la
      // base legal de cada campo dice cuándo llega al texto y cuándo no.
      { col: "recepcion_area", api: "recepcionArea", label: "Área que efectúa la recepción (almacén)", subgrupo: "Recepción y conformidad (Art. 144)", baseLegal: "Art. 144 Reglamento · en bienes la recepción la da almacén y la conformidad el área usuaria: son dos actos y dos áreas. En servicios no hay recepción que dar, así que lo que se registre aquí pasa a ser quien OTORGA la conformidad —el residente de la inversión, por ejemplo— y sustituye al área en los dos apartados, el del Art. 144 y el de la forma de pago.", ejemplo: "RESIDENTE" },
      // Espejo de «Área que otorga la conformidad» de la forma de pago, igual
      // que centro de costo lo es del área usuaria. Es el MISMO dato —quién
      // firma la conformidad del Art. 144 es quién la firma para el pago del
      // Art. 67— y estaba pedido dos veces, con el mismo rótulo y en la misma
      // sección: se veían los dos juntos y nada garantizaba que dijeran lo
      // mismo. Se conserva la columna porque el apartado del Art. 144 la usa;
      // lo que desaparece es la segunda casilla.
      { col: "conformidad_area", api: "conformidadArea", label: "Área que otorga la conformidad", subgrupo: "Recepción y conformidad (Art. 144)", oculto: true, baseLegal: "Art. 144 Reglamento · el área usuaria es responsable de brindar la conformidad.", ejemplo: "Sub Gerencia de Desarrollo Económico" },
      // Los dos plazos son NÚMEROS de días, no prosa. Se pedían como texto y se
      // escribían «siete (7)», «cinco (5) días hábiles», «7 dias», cada ficha a
      // su manera: con eso no se puede contar ni comparar contra el tope del
      // Art. 144, y el apartado lo redacta luego el copiloto a partir de ellos.
      // El tope de 999 son los tres dígitos: un plazo de conformidad de cuatro
      // cifras es un error de tecleo, no un plazo.
      { col: "conformidad_plazo", api: "conformidadPlazo", label: "Plazo máximo para la conformidad (días)", subgrupo: "Recepción y conformidad (Art. 144)", kind: "number", min: 1, max: 999, porDefecto: "7", baseLegal: "Art. 144 Reglamento · siete (7) días, o hasta veinte (20) si hacen falta pruebas que verifiquen el cumplimiento. Arranca en 7, que es la regla; los veinte son la excepción y hay que elegirlos.", ejemplo: "7" },
      { col: "conformidad_plazo_subsanacion", api: "conformidadPlazoSubsanacion", label: "Plazo para subsanar observaciones (días hábiles)", subgrupo: "Recepción y conformidad (Art. 144)", kind: "number", min: 1, max: 999, baseLegal: "Art. 144 Reglamento · no mayor al 30% del plazo del entregable, según la complejidad de las subsanaciones. El tope se calcula sobre el «Plazo de ejecución o prestación» registrado más arriba. En bienes el 30% va fijo en el texto del apartado, así que ahí este número no lo cambia.", ejemplo: "5" },
      { subgrupo: "Recepción y conformidad (Art. 144)", col: "recepcion_conformidad", api: "recepcionConformidad", label: "Recepción y conformidad de la prestación", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 144 Reglamento · el área usuaria es responsable de brindar la conformidad de bienes y servicios.", ejemplo: "Conformidad otorgada por el área usuaria en 10 días hábiles" },
      { subgrupo: "Obras y consultoría de obras (Art. 154.1)", col: "metas_fisicas", api: "metasFisicas", label: "Metas físicas / objetivos funcionales", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 154 Reglamento · requerimiento de obras y consultoría de obras; las metas físicas concretan el alcance del Art. 44.2.a.", mostrarPara: ["obras", "consultoria_obra"], ejemplo: "Construcción de 1,200 m² de pavimento rígido" },
      { subgrupo: "Obras y consultoría de obras (Art. 154.1)", col: "disponibilidad_terreno", api: "disponibilidadTerreno", label: "Disponibilidad física del terreno", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 154.1.e Reglamento · Sustento de la disponibilidad del terreno, según corresponda", mostrarPara: ["obras"], ejemplo: "Terreno saneado, libre de interferencias (acta adjunta)" },
      { subgrupo: "Obras y consultoría de obras (Art. 154.1)", col: "seguros", api: "seguros", label: "Seguros", kind: "textarea", wide: true, recomendado: true, baseLegal: "Formato de las bases estándar de obras · seguros (CAR, responsabilidad civil). El Art. 154.1 no lo enumera: es una condición del modelo, no una exigencia del Reglamento.", mostrarPara: ["obras"], ejemplo: "Seguro CAR y de responsabilidad civil durante la ejecución" },
      { subgrupo: "Obras y consultoría de obras (Art. 154.1)", col: "metodologia_bim", api: "metodologiaBim", label: "Metodologías colaborativas (BIM)", kind: "textarea", wide: true, baseLegal: "Art. 154.1.b Reglamento · Necesidad de emplear BIM", mostrarPara: ["obras", "consultoria_obra"], ejemplo: "Uso de BIM en la etapa de ejecución (SNPMGI)" },
      { subgrupo: "Obras y consultoría de obras (Art. 154.1)", col: "gestion_calidad", api: "gestionCalidad", label: "Gestión de la calidad", kind: "textarea", wide: true, recomendado: true, baseLegal: "Formato de las bases estándar de obras · plan de gestión de la calidad. El Art. 154.1 no lo enumera.", mostrarPara: ["obras", "consultoria_obra"], ejemplo: "Plan de aseguramiento y control de calidad" },
      { subgrupo: "Obras y consultoría de obras (Art. 154.1)", col: "anexos_tecnicos", api: "anexosTecnicos", label: "Anexos técnicos", kind: "textarea", wide: true, baseLegal: "Formato de las bases estándar de obras y consultoría de obras · anexos técnicos. El Art. 154.1 no los enumera.", mostrarPara: ["obras", "consultoria_obra"], ejemplo: "Planos, estudios básicos, memoria descriptiva" },
      ],
    },
    {
    title: "3.4 Términos de referencia",
    resumenLlano: "Describe con detalle las características técnicas de lo que se contrata (el «cómo debe ser»).",
    simple: false,
    nota: "Características técnicas y condiciones de ejecución, de preferencia por desempeño y funcionalidad antes que por rasgos meramente descriptivos (Art. 126.1 · principio de valor por dinero). AQUÍ NO van los requisitos de calificación del proveedor: esos son el 3.5. Sí cabe listar el personal, equipamiento o infraestructura NO clave que se necesite para prestar el servicio, pero sin exigir su acreditación en la selección: son condiciones de la ejecución. El PDF del TDR/EETT se adjunta en el panel de EETT/TDR de esta misma ficha: se indexa para consulta y se lista como anexo en el requerimiento en Word.",
    fields: [
      // "De corresponder", no obligatorio: el detalle técnico (Art. 126.1) puede
      // escribirse aquí O adjuntarse como PDF del TDR/EETT en el panel de esta ficha
      // (que al extraerlo rellena este mismo campo). Por eso no bloquea el guardado ni
      // el remitir; sigue visible y advertido (la verificación lo marca como aviso).
      { col: "descripcion_detallada", api: "descripcionDetallada", label: "Términos de referencia / Especificaciones técnicas", kind: "textarea", wide: true, recomendado: true, baseLegal: "Art. 126.1 Reglamento · Especificaciones técnicas (bienes) o términos de referencia (servicios)", ejemplo: "Servicio de X con las siguientes características técnicas…" },
      // Lo demás que el 3.4 del modelo exige y la ficha no recogía. Va detrás del
      // TDR porque son precisiones SOBRE él, no descripciones alternativas.
      { col: "ficha_tecnica_identificacion", api: "fichaTecnicaIdentificacion", label: "Ficha técnica u homologación aplicable", baseLegal: "Art. 260 Reglamento · las fichas técnicas y de homologación aprobadas son de uso OBLIGATORIO con independencia del monto; cuando se usan, el requerimiento debe identificarlas.", ejemplo: "Ficha técnica N° 0001-2025-PERUCOMPRAS · Papel bond A4 75 g" },
      { col: "normas_tecnicas", api: "normasTecnicas", label: "Normas técnicas y metrológicas aplicables", kind: "textarea", wide: true, baseLegal: "Art. 44.5 Reglamento · el requerimiento incluye lo previsto en leyes, reglamentos, normas metrológicas y normas técnicas OBLIGATORIAS. Las voluntarias solo caben si se sustentan en la estrategia y cumplen las cuatro condiciones del 44.5.", ejemplo: "NTP 350.043-1 · extintores portátiles" },
      { col: "compatibilizacion", api: "compatibilizacion", label: "Documento de compatibilización del requerimiento", baseLegal: "Art. 44.6 Reglamento · solo cabe referir marca, fabricante, patente u origen si la autoridad de la gestión administrativa aprobó la compatibilización; entonces hay que consignar el documento que la aprueba.", ejemplo: "Resolución de Gerencia Municipal N° 045-2026-GM-MDCH" },
    ],
  },
  {
    // Bases Estándar, Cap. III · 3.5: requisitos de calificación (los 5 tipos del
    // Art. 72.3). El editor cubre las tres naturalezas —obligatorio (fijo por la
    // ley según el procedimiento, Art. 72.4), facultativo (elección de la entidad,
    // con sustento) y no aplica—, así que aquí van TODOS, no solo los obligatorios.
    // El área usuaria PROPONE; la DEC los establece en la Estrategia (Art. 72.1).
    title: "3.5 Requisitos de calificación y/o precalificación",
    resumenLlano: "Qué debe acreditar el proveedor para poder participar (habilitación, experiencia y, si la entidad los pide, facultativos). Tú lo propones; la DEC lo confirma.",
    simple: false,
    nota: "Los 5 tipos del Art. 72.3, en un solo lugar. Cuáles son OBLIGATORIOS lo fija la ley según el procedimiento (bases estándar, Art. 72.4): salen bloqueados. Los demás los propones como FACULTATIVOS con su sustento (la DEC puede excluirlos si limitan la concurrencia, con tu no objeción). Cada requisito lleva qué se exige y cómo se acredita. Topes del formato para la experiencia: el monto facturado acumulado no supera TRES VECES la cuantía, y se cuenta en los QUINCE años anteriores a la presentación de ofertas. En consorcio, cada integrante comprometido acredita el requisito.",
    fields: [
      // Editor de los 5 tipos del Art. 72.3 (obligatorio/facultativo/no aplica).
      // El área usuaria PROPONE; la DEC los establece (Art. 72.1), pero la
      // propuesta debe existir en el requerimiento (Art. 44.2.b).
      { col: "requisitos_calificacion", api: "requisitosCalificacion", label: "Propuesta de requisitos de calificación / precalificación", kind: "requisitos", wide: true, obligatorio: true, baseLegal: "Art. 44.2.b / 72.3 Reglamento · Sección 3.5. El área usuaria PROPONE (obligatorios y facultativos); la DEC los establece en la Estrategia (Art. 72.1). Los 5 tipos son los del Art. 72.3.", ejemplo: "Capacidad legal; Experiencia del postor en la especialidad" },
      // CONSOLIDADO en la Propuesta de requisitos de calificación (editor): la
      // "Experiencia del postor en la especialidad" es uno de los 5 tipos del
      // Art. 72.3 que gestiona el editor. Se mantiene la columna (oculta) como
      // respaldo del dato heredado; su contenido se migra al tipo
      // `experiencia_postor` del editor al abrir la ficha.

      // CAPACIDAD TÉCNICA Y PROFESIONAL · Experiencia del personal clave. La
      // entidad la pide DENTRO de la «Experiencia del postor en la especialidad»,
      // así que NO se pinta suelta aquí: la renderiza el editor de requisitos,
      // como un cuadro repetible (PersonalClaveEditor), dentro de esa tarjeta.
      // Es una LISTA de puestos serializada en una columna (lib/personal-clave.ts),
      // igual que «otras penalidades». Se marca `oculto` para que la sección no la
      // muestre por su cuenta, pero sigue en FICHA_SECCIONES para cargarse y
      // guardarse; `kind: "personalClave"` hace que en el Word salga como TABLA.
      { col: "personal_clave_experiencia", api: "personalClaveExperiencia", label: "Experiencia del personal clave", oculto: true, kind: "personalClave", baseLegal: "Art. 72.3.b Reglamento · un puesto por fila: tiempo mínimo de experiencia, la actividad en que se exige y el cargo. Se acredita con el Anexo N° 19.", ejemplo: "tres (3) años · supervisión de montaje · Ingeniero residente" },
      // Cómo se acredita la experiencia del personal clave: texto fijo del formato
      // (Anexo N° 19, documentos, 25 años, traslape). Oculto —lo pinta el editor,
      // tras el cuadro— pero SÍ va al documento; ver la excepción en
      // requerimiento-estructura.ts.
      { col: "personal_clave_acreditacion", api: "personalClaveAcreditacion", label: "Acreditación de la experiencia del personal clave", oculto: true, kind: "textarea", baseLegal: "Art. 72.3.b Reglamento · forma de acreditar la experiencia del personal clave (Anexo N° 19). Texto estándar del formato de Concurso Público de servicios.", ejemplo: "El postor debe señalar la denominación del puesto…" },
      // CALIFICACIONES DEL PERSONAL CLAVE · Formación académica (Art. 72.3.b,
      // C.2.1). Requisito con dos huecos —grado/título y puesto— que se compone
      // (lib/formacion-academica.ts). Oculto —lo pinta el editor— pero SÍ al
      // documento; ver la excepción en requerimiento-estructura.ts.
      { col: "formacion_academica", api: "formacionAcademica", label: "Formación académica del personal clave", oculto: true, kind: "formacionAcademica", baseLegal: "Art. 72.3.b Reglamento · un requisito por fila (grado/título + puesto). Como requisito de calificación solo cabe exigir el GRADO o el TÍTULO, no cursos ni especializaciones.", ejemplo: "Título profesional de Ingeniero Civil · Ingeniero residente" },
      // Cómo se acredita la formación académica: texto fijo del formato (Anexo
      // N° 19, SUNEDU, MINEDU). Oculto —lo pinta el editor, tras el cuadro— pero
      // SÍ al documento; ver la excepción en requerimiento-estructura.ts.
      { col: "formacion_academica_acreditacion", api: "formacionAcademicaAcreditacion", label: "Acreditación de la formación académica", oculto: true, kind: "textarea", baseLegal: "Art. 72.3.b Reglamento · forma de acreditar la formación académica (Anexo N° 19). Texto estándar del formato de Concurso Público de servicios.", ejemplo: "El postor debe señalar los nombres y apellidos…" },
      // CALIFICACIONES DEL PERSONAL CLAVE · Capacitación (Art. 72.3.b). Un
      // requisito por fila con tres huecos —horas, materia y puesto— que se
      // compone (lib/capacitacion-personal-clave.ts). El tope es 120 horas.
      // Oculto —lo pinta el editor, tras la formación académica— pero SÍ va al
      // documento; ver la excepción en requerimiento-estructura.ts.
      { col: "capacitacion_personal_clave", api: "capacitacionPersonalClave", label: "Capacitación del personal clave", oculto: true, kind: "capacitacion", baseLegal: "Art. 72.3.b Reglamento · un requisito por fila (horas + materia + puesto); la capacitación se exige hasta un máximo de 120 horas.", ejemplo: "40 horas en seguridad y salud en obra · Ingeniero residente" },
      // Cómo se acredita la capacitación: texto fijo del formato (Anexo N° 19).
      // Oculto —lo pinta el editor, tras el cuadro— pero SÍ al documento.
      { col: "capacitacion_personal_clave_acreditacion", api: "capacitacionPersonalClaveAcreditacion", label: "Acreditación de la capacitación", oculto: true, kind: "textarea", baseLegal: "Art. 72.3.b Reglamento · forma de acreditar la capacitación del personal clave (Anexo N° 19)." },
      // EQUIPAMIENTO ESTRATÉGICO (Art. 72.3.b, C.3). No es cuadro: es el
      // equipamiento estratégico de la contratación. Dos textos —el requisito y
      // su acreditación—, ocultos en la lista de campos pero SÍ al documento; ver
      // la excepción en requerimiento-estructura.ts.
      { col: "equipamiento_estrategico", api: "equipamientoEstrategico", label: "Equipamiento estratégico (requisito)", oculto: true, kind: "textarea", baseLegal: "Art. 72.3.b Reglamento · solo el equipamiento e infraestructura estratégicos; lo que no sea clave va en las condiciones de la prestación." },
      { col: "equipamiento_estrategico_acreditacion", api: "equipamientoEstrategicoAcreditacion", label: "Acreditación del equipamiento estratégico", oculto: true, kind: "textarea", baseLegal: "Art. 72.3.b Reglamento · forma de acreditar el equipamiento estratégico. Texto estándar del formato de Concurso Público de servicios." },
      // INFRAESTRUCTURA ESTRATÉGICA (Art. 72.3.b, C.3). Igual que el equipamiento:
      // dos textos —el requisito y su acreditación—, ocultos pero SÍ al documento.
      { col: "infraestructura_estrategica", api: "infraestructuraEstrategica", label: "Infraestructura estratégica (requisito)", oculto: true, kind: "textarea", baseLegal: "Art. 72.3.b Reglamento · solo la infraestructura estratégica; lo que no sea clave va en las condiciones de la prestación." },
      { col: "infraestructura_estrategica_acreditacion", api: "infraestructuraEstrategicaAcreditacion", label: "Acreditación de la infraestructura estratégica", oculto: true, kind: "textarea", baseLegal: "Art. 72.3.b Reglamento · forma de acreditar la infraestructura estratégica. Texto estándar del formato de Concurso Público de servicios." },
    ],
  },
  // La antigua "3.5.2 Requisitos de calificación adicionales" (textarea libre
  // `requisitos_adicionales`) se retira de la ficha: era dato MUERTO —no lo
  // consumían el requerimiento, ni la precarga a A4, ni la estrategia— y estaba
  // vacío en todas las necesidades. Los facultativos se proponen en el editor de
  // 3.5 marcando el tipo del Art. 72.3 como "Facultativo". La columna sigue en la
  // BD por si hubiera datos históricos; solo desaparece del formulario.
  {
    title: "Planeamiento (PEI / POI)",
    simple: false,
    nota: "Articulación con el planeamiento institucional. Ni el PEI ni el POI aparecen en la Ley 32069 o su Reglamento —vienen del planeamiento de la entidad—, y por eso estos tres campos no citan artículo. Lo que sí exige la norma es que el requerimiento esté previsto en el CMN (Art. 20.a), y el CMN se arma a partir de estas actividades: rellenarlos es lo que permite rastrear la necesidad hasta el plan que la justifica.",
    fields: [
      { col: "pei_objetivo", api: "peiObjetivo", label: "PEI · Objetivo", baseLegal: "Objetivo estratégico institucional con el que se articula la necesidad.", ejemplo: "OE.01 Mejorar la gestión" },
      { col: "pei_accion", api: "peiAccion", label: "PEI · Acción", baseLegal: "Acción estratégica del PEI con la que se articula la necesidad.", ejemplo: "AE.01.01" },
      { col: "poi_actividad", api: "poiActividad", label: "POI · Actividad", baseLegal: "Actividad operativa del POI que financia la necesidad.", ejemplo: "Actividad 500123" },
    ],
  },
  {
    title: "Verificaciones DEC (Art. 14 Reglamento)",
    simple: false,
    nota: "La DEC participa en la elaboración y revisión del requerimiento SOLO en cuanto al cumplimiento de la normativa: los aspectos TÉCNICOS de la necesidad son responsabilidad del área usuaria (Art. 14.2.b). Estas cuatro casillas son las verificaciones del Art. 14.2 que tocan al requerimiento —c) CMN, d) ficha técnica o acuerdo marco, e) almacén y patrimonio, j) certificación presupuestal—. La del CMN se resuelve además con las acciones del flujo (aprobar / solicitar no objeción).",
    fields: [
      // El CMN es una verificación del 14.2.c, no un dato de identificación.
      { col: "version_cmn", api: "versionCmn", label: "N.° del CMN (y su modificatoria, si aplica)", baseLegal: "Art. 14.2.c Reglamento · La necesidad debe constar en el CMN aprobado del año fiscal o su modificatoria (Art. 54.3)", ejemplo: "CMN 2026, Modificatoria N.° 2" },
      { col: "verificacion_ficha_tecnica", api: "verificacionFichaTecnica", label: "Verificación de ficha técnica, homologación o acuerdo marco", checkbox: true, baseLegal: "Art. 14.2.d Reglamento · la DEC verifica si la necesidad está definida en una ficha técnica, en una ficha de homologación O EN EL CATÁLOGO ELECTRÓNICO DE ACUERDOS MARCO. Las fichas aprobadas son de uso obligatorio con independencia del monto (Art. 260); el acuerdo marco es otra vía de contratación." },
      { col: "verificacion_almacen", api: "verificacionAlmacen", label: "Verificación de almacén / patrimonio", checkbox: true, baseLegal: "Art. 14.2.e Reglamento · DEC verifica si la necesidad puede cubrirse con existencias disponibles o bienes patrimoniales sin asignar" },
      { col: "certificacion_presupuestal", api: "certificacionPresupuestal", label: "Certificación / previsión presupuestal", baseLegal: "Art. 14.2.j Reglamento · DEC solicita a la oficina de presupuesto la certificación o previsión presupuestal" },
    ],
  },
  {
    title: "Resumen",
    simple: true,
    fields: [{ col: "summary", api: "summary", label: "Resumen / descripción", baseLegal: "Resumen interno de la necesidad; viaja al expediente como `summary`.", kind: "textarea", wide: true, ejemplo: "Resumen ejecutivo de la contratación" }],
  },
];
