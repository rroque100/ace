// Listas CERRADAS que comparten la ficha de necesidad (Módulo 1) y los formatos
// de la Fase 1 (estrategia A4).
//
// Vivían dentro de `estrategia-formato.ts` y `actuaciones-preparatorias.ts`, dos
// módulos pesados y de servidor. La ficha las necesita en el cliente para poder
// ofrecerlas como desplegable en vez de pedirlas como texto libre, y arrastrar
// esos módulos al bundle solo por una lista era caro; copiarlas, peor: dos
// listas del mismo dominio divergen. Se extraen aquí y los dos módulos las
// reexportan, así que sigue habiendo una sola fuente.
//
// Un apunte sobre el VALOR de cada opción en la ficha: se guarda la ETIQUETA,
// no la clave. `normalizarModalidadPago` (lib/fase1-precarga.ts) mapea el texto
// del área usuaria al valor del select de A4 buscando expresiones como "suma
// alzada"; con la clave `suma_alzada` —con guion bajo— ese mapeo no encuentra
// nada y la siembra de A3 se queda vacía.

export type OpcionCatalogo = { value: string; label: string };

export const OPCIONES_MODALIDAD_PAGO: OpcionCatalogo[] = [
  { value: "suma_alzada", label: "Suma alzada" },
  { value: "precios_unitarios", label: "Precios unitarios" },
  { value: "esquema_mixto", label: "Esquema mixto" },
  { value: "tarifas", label: "Tarifas" },
  { value: "porcentajes", label: "En base a porcentajes" },
  { value: "honorario_fijo_comision", label: "Honorario fijo + comisión de éxito" },
  { value: "pago_consumo", label: "Pago por consumo (horas)" },
  // Obras y consultoría de obras:
  { value: "costo_reembolsable", label: "Costo reembolsable (obras)" },
  { value: "pago_disponibilidad", label: "Pago por disponibilidad (contingencia)" },
  { value: "pago_activacion", label: "Pago por activación (contingencia)" },
  { value: "pago_mixto", label: "Pago mixto (contingencia)" },
];

export const OPCIONES_SISTEMA_ENTREGA: OpcionCatalogo[] = [
  { value: "llave_en_mano", label: "Llave en mano (bienes y servicios)" },
  { value: "llave_en_mano_mantenimiento", label: "Llave en mano con mantenimiento (bienes y servicios)" },
  { value: "suministro_comodato", label: "Suministro con comodato (bienes y servicios)" },
  { value: "diseno_operacion_mantenimiento", label: "Diseño de la operación y mantenimiento (bienes y servicios)" },
  { value: "gestion_instalaciones", label: "Gestión de instalaciones (bienes y servicios)" },
  { value: "no_aplica", label: "No aplica (bienes y servicios)" },
  { value: "solo_construccion", label: "Solo construcción (obras)" },
  { value: "diseno_construccion", label: "Diseño y construcción (obras)" },
  { value: "diseno_construccion_operacion_mantenimiento", label: "Diseño, construcción, operación y mantenimiento (obras)" },
  { value: "gestion_diseno_construccion_riesgo", label: "Gestión del diseño y construcción al riesgo (obras)" },
  { value: "gestion_diseno_construccion_agencia", label: "Gestión del diseño y construcción de agencia (obras)" },
  { value: "entrega_integrada_alianza", label: "Entrega integrada de proyecto o alianza (obras)" },
  { value: "formulacion_diseno", label: "Formulación y diseño (consultoría de obras)" },
  { value: "solo_formulacion_o_diseno", label: "Solo formulación o solo diseño (consultoría de obras)" },
];

/** Monedas admitidas en el requerimiento. */
export const OPCIONES_MONEDA: OpcionCatalogo[] = [
  { value: "PEN", label: "PEN · Soles (S/)" },
  { value: "USD", label: "USD · Dólares americanos ($)" },
];

/** Etiquetas de las listas, que es lo que la ficha guarda como valor. */
export const etiquetas = (opciones: OpcionCatalogo[]): OpcionCatalogo[] =>
  opciones.map((o) => ({ value: o.label, label: o.label }));
