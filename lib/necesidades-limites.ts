/**
 * Topes de longitud de la ficha de Necesidad. SIN zod a proposito.
 *
 * Vivian en lib/necesidades.ts, junto a los 31 esquemas de validacion. El
 * cliente solo necesita estos dos valores para capar lo que se escribe, pero al
 * importarlos de alli se llevaba zod entero al navegador: 277 KB de los 739 que
 * pesaba /necesidades/[id], para validaciones que solo corren en el servidor.
 *
 * `lib/necesidades.ts` los reexporta, asi que el servidor sigue igual.
 */

/**
 * Límite de la denominación de la contratación.
 *
 * La columna es `text` (sin límite en la base): este tope es del schema. Estaba
 * en 200 y era incoherente — el nombre se compone a partir de la descripción de
 * catálogo y la población beneficiaria, que admiten 500 caracteres CADA UNA, así
 * que una denominación legítima lo rebasaba y el guardado fallaba con
 * "Solicitud inválida" sin decir por qué.
 */
export const NOMBRE_MAX = 500;

/**
 * Acota un número al rango del schema, redondeando a entero.
 *
 * Es el equivalente numérico de capar el texto a su tope: el cliente lo usa al
 * construir el PATCH para que un número fuera de rango —tecleado, insertado por
 * el copiloto o heredado de un borrador— no deje la ficha imposible de guardar
 * (PATCH 400 en CADA autoguardado, que es como se cuelan estos bloqueos). Solo se
 * aplica a los campos que DECLARAN min/max en la ficha; esos son días o periodos,
 * que el schema define `.int()`. La cantidad y los importes no declaran rango y
 * conservan sus decimales, así que no pasan por aquí.
 */
export function acotarNumero(n: number, min?: number, max?: number): number {
  let v = Math.round(n);
  if (min !== undefined) v = Math.max(v, min);
  if (max !== undefined) v = Math.min(v, max);
  return v;
}

/**
 * Tope de caracteres por campo de texto de la Necesidad (debe reflejar los
 * `optionalText(n)` del schema de arriba). El cliente lo usa para CAPAR el valor
 * en la entrada, en la inserción del copiloto IA y al restaurar el borrador, de
 * modo que un texto demasiado largo (p. ej. redactado por la IA en un campo
 * corto) no deje la ficha imposible de guardar (PATCH 400). Un test verifica que
 * estos topes coinciden con el schema. El `nombre` se rige por NOMBRE_MAX.
 */
export const LIMITES_TEXTO: Record<string, number> = {
  tipoProcesoSeleccion: 120,
  periodoProgramacion: 50,
  versionCmn: 50,
  entidad: 160,
  unidadEjecutora: 160,
  areaUsuaria: 160,
  centroCosto: 120,
  responsable: 160,
  finalidadPublica: 2000,
  peiObjetivo: 120,
  peiAccion: 120,
  poiActividad: 120,
  metaPresupuestal: 120,
  cui: 40,
  nroPedido: 20,
  pedidoSecuencia: 10,
  proyectoInversion: 2000,
  ioarr: 160,
  especialidad: 120,
  subespecialidad: 120,
  codigoCatalogo: 50,
  descripcionCatalogo: 500,
  descripcionDetallada: 2000,
  unidadMedida: 50,
  frecuencia: 50,
  fechaRequerida: 20,
  fuenteFinanciamiento: 120,
  rubro: 120,
  cadenaFuncional: 120,
  clasificadorGasto: 120,
  moneda: 10,
  departamento: 100,
  provincia: 100,
  distrito: 100,
  lugarEntrega: 500,
  alcance: 2000,
  condicionesEjecucion: 2000,
  modalidadPago: 500,
  sistemaEntrega: 100,
  equipamientoMinimo: 1000,
  habilitaciones: 1000,
  formulaReajuste: 2000,
  adelantoDirecto: 1000,
  penalidadMora: 2000,
  garantias: 2000,
  // 7000: el apartado se compone con el texto literal del formato
  // (lib/recepcion-conformidad.ts), que en bienes ya mide 1791 con los huecos
  // SIN rellenar, y encima lleva las DOS areas MAS el nombre del proyecto de
  // inversion (2000 por si solo). Cuando se quedo corto, el ultimo parrafo se
  // cortaba sin avisar. Una prueba compone el peor caso desde estos mismos
  // topes: da 6269.
  recepcionConformidad: 7000,
  subcontratacion: 1000,
  descripcionGeneral: 4000,
  fichaTecnicaIdentificacion: 300,
  compatibilizacion: 300,
  normasTecnicas: 2000,
  prestacionesAccesorias: 2000,
  otrasPenalidades: 3000,
  solucionControversias: 8000,
  // `plazoRespuestas` NO esta aqui: paso a ser un numero de dias, no texto.
  // Aqui solo viven los campos de texto, que es lo que el formulario capa.
  plazoRespuestasTexto: 1200,
  // Los apartados que se componen con plantilla. Sin tope aqui, el formulario
  // no capaba la entrada y un texto largo llegaba al PATCH para que lo
  // rechazara con un 400 —que es como se cuelan estos fallos—.
  // 11000: al texto se le suman campos largos que no son huecos suyos —la
  // denominacion del area, el nombre del proyecto de inversion y el detalle de
  // los pagos a cuenta—. Cada vez que se quedo corto, el apartado se CORTABA al
  // escribirlo sin avisar. Una prueba compone el peor caso desde estos mismos
  // topes en vez de fiarse de una cuenta a mano: da 10109.
  formaPago: 11000,
  formaPagoTipo: 1000,
  formaPagoDetalle: 2000,
  // 2400 y no 300 como los demas nombres de area. Se bajo a 300 razonando que
  // aqui solo cabe un nombre, y no es cierto: el formato pide la DENOMINACION
  // del area responsable, y en una inversion eso se escribe con el proyecto al
  // que pertenece. Con 300, un caso real se guardo cortado a mitad de palabra
  // —«...DE COTABAMBAS DEL»— dentro de un documento que se firma.
  formaPagoAreaConformidad: 2400,
  formaPagoDocumentacion: 1000,
  formaPagoLugar: 300,
  formaPagoDireccion: 300,
  recepcionArea: 300,
  conformidadArea: 300,
  // conformidadPlazo y conformidadPlazoSubsanacion ya no estan aqui: son
  // numeros de dias y este mapa es de topes de TEXTO. Dejarlos capaba «100» a
  // sus primeros caracteres sin motivo.
  requisitosAdicionales: 4000,
  personalClaveExperiencia: 4000,
  personalClaveAcreditacion: 3000,
  formacionAcademica: 3000,
  formacionAcademicaAcreditacion: 2000,
  capacitacionPersonalClave: 3000,
  capacitacionPersonalClaveAcreditacion: 2000,
  equipamientoEstrategico: 2000,
  equipamientoEstrategicoAcreditacion: 2000,
  infraestructuraEstrategica: 2000,
  infraestructuraEstrategicaAcreditacion: 2000,
  gestionRiesgos: 20000,
  metasFisicas: 2000,
  disponibilidadTerreno: 2000,
  seguros: 2000,
  metodologiaBim: 2000,
  gestionCalidad: 2000,
  anexosTecnicos: 2000,
  requisitosCalificacion: 50000,
  certificacionPresupuestal: 120,
  fechaRemisionDec: 20,
  fechaVersionDos: 20,
  fechaVersionN: 20,
  summary: 2000,
};
