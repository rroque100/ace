import { type CampoFormulario, campoEsRequerido } from "./actuaciones-preparatorias";

/**
 * Qué campos de un paso se VEN y cuáles quedan tras el desplegable de opcionales.
 *
 * Se extrajo del `useMemo` de `FasePanel` para poder probarlo sin montar React
 * (los tests corren en `node`, sin DOM): el panel llama a esta misma función, así
 * que lo que aquí se afirma es literalmente lo que se pinta. La regla:
 *
 * - `condicionOk`: un campo con `dependeDe` no se ve hasta que su condición se
 *   cumple ("Si seleccionó SÍ, registre…"); cumplida, se ve siempre.
 * - `debeVerse`: se ve por defecto si es OBLIGATORIO, `recomendado` ("de
 *   corresponder") o YA TIENE VALOR. El resto (opcional y vacío) se pliega hasta
 *   pulsar "Mostrar campos opcionales" (`verOpcionales`).
 *
 * `recomendado` cuenta como visible a propósito: son los campos que alimentan el
 * documento firmado (p. ej. los sustentos de la Estrategia que van a B70/B83); si
 * se ocultan, nadie los llena y el formato sale incompleto.
 */
export function visibilidadDePaso(
  campos: CampoFormulario[],
  draftData: Record<string, unknown>,
  verOpcionales: boolean,
): {
  camposVisibles: CampoFormulario[];
  ocultos: number;
  obligatoriosPendientes: number;
  obligatoriosTotal: number;
  faltanObligatorios: string[];
} {
  const conValor = (c: CampoFormulario) => {
    const v = draftData[c.name];
    // En los booleanos donde el NO es una respuesta final (`negativaEsRespuesta`)
    // basta con que se haya contestado. En el resto, un check sin marcar sigue
    // contando como sin llenar.
    if (c.negativaEsRespuesta) return v !== undefined && v !== null;
    return v !== undefined && v !== null && v !== "" && v !== false;
  };
  const condicionOk = (c: CampoFormulario) =>
    !c.dependeDe ||
    (Array.isArray(c.dependeDe.valor)
      ? c.dependeDe.valor.includes(String(draftData[c.dependeDe.campo] ?? ""))
      : draftData[c.dependeDe.campo] === c.dependeDe.valor);
  const esReq = (c: CampoFormulario) => campoEsRequerido(c, draftData);
  const debeVerse = (c: CampoFormulario) => condicionOk(c) && (esReq(c) || c.recomendado || conValor(c));

  // Los campos `oculto` no se muestran NUNCA en el formulario (siguen sembrándose
  // y el documento los consume), así que no entran ni en la lista visible ni en
  // los conteos de "faltantes" / "campos opcionales por mostrar".
  const campos_ = campos.filter((c) => !c.oculto);
  const obligatorios = campos_.filter((c) => condicionOk(c) && esReq(c));
  const faltan = obligatorios.filter((c) => !conValor(c));
  return {
    camposVisibles: campos_.filter((c) => condicionOk(c) && (verOpcionales || debeVerse(c))),
    // Los que realmente se esconden al plegar (un opcional con valor no cuenta).
    ocultos: campos_.filter((c) => condicionOk(c) && !debeVerse(c)).length,
    obligatoriosPendientes: faltan.length,
    // Total de obligatorios exigibles ahora (aplicada la condición): la puerta de
    // "llenos/total" de la cabecera del paso lo necesita para el progreso.
    obligatoriosTotal: obligatorios.length,
    faltanObligatorios: faltan.map((c) => c.label),
  };
}

/** Avance de una sección de campos: cuántos de sus campos exigibles ya están llenos. */
export type EstadoGrupo = { total: number; llenos: number };

/**
 * Progreso por GRUPO (las secciones a–t de A4). Para cada grupo cuenta los campos
 * que la norma pide —obligatorios (`campoEsRequerido`, incluido el condicional) y
 * "de corresponder" (`recomendado`)— y cuántos tienen valor. Son los que alimentan
 * el documento firmado; los meramente opcionales no lastran el "completo".
 *
 * Un campo con `dependeDe` sin cumplir NO cuenta (su condición aún no aplica), igual
 * que en `visibilidadDePaso`, para que el total no exija algo que ni se muestra.
 * Vive junto a la visibilidad y sin React para poder probarse en `node`.
 */
export function progresoDeGrupos(
  campos: CampoFormulario[],
  draftData: Record<string, unknown>,
): Map<string, EstadoGrupo> {
  const conValor = (c: CampoFormulario) => {
    const v = draftData[c.name];
    if (c.negativaEsRespuesta) return v !== undefined && v !== null;
    return v !== undefined && v !== null && v !== "" && v !== false;
  };
  const condicionOk = (c: CampoFormulario) =>
    !c.dependeDe ||
    (Array.isArray(c.dependeDe.valor)
      ? c.dependeDe.valor.includes(String(draftData[c.dependeDe.campo] ?? ""))
      : draftData[c.dependeDe.campo] === c.dependeDe.valor);
  const cuenta = (c: CampoFormulario) => campoEsRequerido(c, draftData) || Boolean(c.recomendado);

  const porGrupo = new Map<string, EstadoGrupo>();
  for (const c of campos) {
    if (!c.grupo || c.oculto || !condicionOk(c) || !cuenta(c)) continue;
    const g = porGrupo.get(c.grupo) ?? { total: 0, llenos: 0 };
    g.total += 1;
    if (conValor(c)) g.llenos += 1;
    porGrupo.set(c.grupo, g);
  }
  return porGrupo;
}
