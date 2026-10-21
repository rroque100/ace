"use client";

import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { OBJETOS_NECESIDAD } from "@/lib/necesidades";
import {
  agruparPorPaquete,
  cuantiaPorSumatoria,
  discrepanciaCuantia,
  evaluarAgrupamiento,
  filasParaCuadro,
  importeItem,
  itemsSinCodigoCatalogo,
  itemsSinPaquete,
  type NecesidadItem,
  normalizarDescripcionPaquete,
  objetoSugerido,
  paquetesDeUnSoloItem,
  renumerar,
} from "@/lib/necesidad-items";
import { soles } from "@/lib/segmentacion-parametros";

/**
 * Cuadro de ítems del requerimiento (sección 3.2 de las Bases).
 *
 * Es la lista sobre la que después se decide el agrupamiento, pero el modo
 * —paquete o relación de ítems— NO se elige aquí: lo sustenta la DEC en la
 * estrategia (Art. 52.2 · 46.1.q). Lo que este editor hace es enseñar, mientras
 * se escribe, las tres consecuencias que la norma saca de esta lista:
 *
 *   Art. 52.1.b — para ir por ítems, cada uno debe superar el contrato menor.
 *   Art. 53.3   — la cuantía es la sumatoria de los ítems.
 *   Art. 44.10  — con varias prestaciones, el objeto lo fija la de mayor costo.
 *
 * Ninguna se aplica sola: las tres informan y dejan decidir.
 */
export function NecesidadItemsEditor({
  items,
  onChange,
  objetoNecesidad,
  montoDeclarado,
  tipoProceso,
  uitValor,
  readOnly,
}: {
  items: NecesidadItem[];
  onChange: (items: NecesidadItem[]) => void;
  objetoNecesidad: string | null;
  /** Monto estimado escrito a mano en «Programación y presupuesto». */
  montoDeclarado: number | null;
  /** Procedimiento anticipado en la ficha: decide si se exige el código. */
  tipoProceso?: string | null;
  /** UIT del ejercicio (Configuración → Municipalidad). `null` = sin registrar. */
  uitValor: number | null;
  readOnly?: boolean;
}) {
  const sumatoria = cuantiaPorSumatoria(items);
  const discrepancia = discrepanciaCuantia(items, montoDeclarado);
  const agrupamiento = evaluarAgrupamiento(items, uitValor);
  const objeto = objetoSugerido(items, objetoNecesidad);
  /**
   * ¿Cabe siquiera agrupar? Con un solo ítem, no.
   *
   * El Art. 52.1 del Reglamento abre con «puede AGRUPAR la contratación de los
   * bienes, servicios u obras esencialmente similares», y los dos mecanismos que
   * enumera son plurales por definición: el paquete agrupa «VARIOS bienes o
   * servicios» (52.1.a) y la relación de ítems los reparte en «DIFERENTES ítems,
   * lotes o tramos» (52.1.b). Con una sola prestación no hay nada que agrupar:
   * no es «por paquete» ni «según relación de ítems», es una contratación normal
   * y el artículo no entra en juego.
   *
   * Por eso las dos columnas de paquete no se pintan con un único ítem: ofrecerlas
   * invitaría a declarar un agrupamiento que la norma no admite.
   */
  const puedeAgrupar = items.length > 1;
  const paquetes = agruparPorPaquete(items);
  const sueltos = itemsSinPaquete(items);
  const unSoloItem = paquetesDeUnSoloItem(items);
  const sinCodigo = itemsSinCodigoCatalogo(items, tipoProceso);
  // Orden de pintado: los ítems de un paquete quedan contiguos para poder
  // combinar su celda, y los sueltos van al final.
  const filas = filasParaCuadro(items);

  /** Edita por id/posición real, no por la fila pintada: el cuadro va reordenado. */
  function editar(objetivo: NecesidadItem, cambio: Partial<NecesidadItem>) {
    const siguiente = items.map((item) => (item === objetivo ? { ...item, ...cambio } : item));
    // Si tocó el paquete o su descripción, se iguala en todo el grupo al vuelo:
    // escribir en la celda combinada debe verse en las filas que abarca.
    onChange(
      "nroPaquete" in cambio || "descripcionPaquete" in cambio
        ? normalizarDescripcionPaquete(siguiente)
        : siguiente,
    );
  }

  function agregar() {
    onChange(renumerar([...items, { descripcion: "", nro: items.length + 1 }]));
  }

  function quitar(objetivo: NecesidadItem) {
    onChange(renumerar(items.filter((item) => item !== objetivo)));
  }

  /** Texto → número, sin convertir el vacío en 0. */
  function num(valor: string): number | null {
    const t = valor.trim();
    if (!t) return null;
    const n = Number(t.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  return (
    <div className="necItems" data-campo="items">
      <div className="necItemsHead">
        <span className="fichaSubgrupo">Ítems del requerimiento</span>
        <span className="necItemsHint">
          Desagrega aquí las prestaciones. Con una sola, el requerimiento va como está.
        </span>
      </div>

      {items.length > 0 ? (
        <div className="necItemsTablaScroll">
          <table className="necItemsTabla">
            <thead>
              <tr>
                {/* Primera columna: el paquete. Su celda se combina a lo alto de
                    los ítems que agrupa. */}
                {puedeAgrupar ? <th scope="col">Paquete / objeto contractual</th> : null}
                <th scope="col">N°</th>
                {/* El código del catálogo va DELANTE de la descripción: es como
                    se identifica la prestación en el CUBSO/SIGA y como se busca. */}
                <th scope="col">Código de catálogo</th>
                <th scope="col">Descripción</th>
                <th scope="col">Unidad</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Costo unitario</th>
                <th scope="col">Importe</th>
                {/* La naturaleza solo se pregunta cuando puede diferir: el
                    Art. 52.1.b admite agrupar prestaciones de distinto tipo. */}
                <th scope="col">Naturaleza</th>
                {/* Paquete: agrupa varios ítems en un solo objeto contractual
                    (Art. 52.1.a). Vacío = el ítem va suelto. */}
                {puedeAgrupar ? <th scope="col">Paquete</th> : null}
                {readOnly ? null : <th scope="col"><span className="visuallyHidden">Quitar</span></th>}
              </tr>
            </thead>
            <tbody>
              {filas.map(({ item, filasPaquete, paquete }, i) => {
                const importe = importeItem(item);
                const calculado = item.costoTotal === null || item.costoTotal === undefined;
                return (
                  <tr
                    className={paquete ? "necItemsFilaPaquete" : undefined}
                    key={item.id ?? `nuevo-${i}`}
                  >
                    {/* Celda del paquete: la dibuja SOLO la primera fila del
                        grupo y abarca las de sus ítems (Art. 52.1.a: forman un
                        único objeto contractual). Los sueltos no la llevan. */}
                    {puedeAgrupar && filasPaquete > 0 && paquete ? (
                      <td className="necItemsPaqueteCelda" rowSpan={filasPaquete}>
                        <strong>Paquete {paquete.nro}</strong>
                        <textarea
                          aria-label={`Descripción del paquete ${paquete.nro}`}
                          disabled={readOnly}
                          onChange={(e) => editar(item, { descripcionPaquete: e.target.value })}
                          placeholder="Objeto contractual del paquete"
                          rows={2}
                          value={item.descripcionPaquete ?? ""}
                        />
                        {paquete.monto !== null ? (
                          <small>{soles(paquete.monto)}</small>
                        ) : null}
                      </td>
                    ) : null}
                    {/* Los sueltos ocupan esa columna con una celda vacía para
                        que las demás no se desplacen. */}
                    {puedeAgrupar && !paquete ? <td className="necItemsSinPaqueteCelda" /> : null}
                    <td className="necItemsNro">{item.nro}</td>
                    <td className="necItemsCodigo">
                      <input
                        aria-label={`Código de catálogo del ítem ${item.nro}`}
                        disabled={readOnly}
                        inputMode="numeric"
                        onChange={(e) => editar(item, { codigoCatalogo: e.target.value })}
                        placeholder="410100070019"
                        value={item.codigoCatalogo ?? ""}
                      />
                    </td>
                    <td className="necItemsDesc">
                      <input
                        aria-label={`Descripción del ítem ${item.nro}`}
                        disabled={readOnly}
                        onChange={(e) => editar(item, { descripcion: e.target.value })}
                        value={item.descripcion}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Unidad de medida del ítem ${item.nro}`}
                        disabled={readOnly}
                        onChange={(e) => editar(item, { unidadMedida: e.target.value })}
                        value={item.unidadMedida ?? ""}
                      />
                    </td>
                    <td className="necItemsCifra">
                      <input
                        aria-label={`Cantidad del ítem ${item.nro}`}
                        disabled={readOnly}
                        inputMode="decimal"
                        onChange={(e) => editar(item, { cantidad: num(e.target.value) })}
                        value={item.cantidad ?? ""}
                      />
                    </td>
                    <td className="necItemsCifra">
                      <input
                        aria-label={`Costo unitario del ítem ${item.nro}`}
                        disabled={readOnly}
                        inputMode="decimal"
                        onChange={(e) => editar(item, { costoUnitario: num(e.target.value) })}
                        value={item.costoUnitario ?? ""}
                      />
                    </td>
                    <td className="necItemsCifra">
                      <input
                        aria-label={`Importe del ítem ${item.nro}`}
                        disabled={readOnly}
                        inputMode="decimal"
                        onChange={(e) => editar(item, { costoTotal: num(e.target.value) })}
                        placeholder={calculado && importe !== null ? String(importe) : ""}
                        value={item.costoTotal ?? ""}
                      />
                      {calculado && importe !== null ? (
                        <small className="necItemsCalculado">calculado</small>
                      ) : null}
                    </td>
                    <td>
                      <select
                        aria-label={`Naturaleza del ítem ${item.nro}`}
                        disabled={readOnly}
                        onChange={(e) => editar(item, { tipoObjeto: e.target.value || null })}
                        value={item.tipoObjeto ?? ""}
                      >
                        <option value="">Igual que la necesidad</option>
                        {OBJETOS_NECESIDAD.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    {puedeAgrupar ? (
                      <td>
                        <input
                          aria-label={`Paquete del ítem ${item.nro}`}
                          disabled={readOnly}
                          inputMode="numeric"
                          onChange={(e) => editar(item, { nroPaquete: num(e.target.value) })}
                          placeholder="—"
                          value={item.nroPaquete ?? ""}
                        />
                      </td>
                    ) : null}
                    {readOnly ? null : (
                      <td>
                        <button
                          aria-label={`Quitar el ítem ${item.nro}`}
                          className="segCronoRemove"
                          onClick={() => quitar(item)}
                          type="button"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {readOnly ? null : (
        <button className="secondaryButton compactButton" onClick={agregar} type="button">
          <Plus size={14} /> Añadir ítem
        </button>
      )}

      {items.length > 0 ? (
        <div className="necItemsResumen">
          {sumatoria !== null ? (
            <p className="necItemsSuma">
              <strong>Cuantía por sumatoria: {soles(sumatoria)}</strong>
              <span> — {items.length} ítem{items.length > 1 ? "s" : ""} (Art. 53.3).</span>
            </p>
          ) : null}

          {discrepancia ? (
            <p className="aviso aviso--error">
              <TriangleAlert size={14} aria-hidden />
              <span>
                El monto estimado registrado ({soles(discrepancia.declarado)}) no coincide con la
                suma de los ítems ({soles(discrepancia.sumatoria)}): sobran{" "}
                {soles(Math.abs(discrepancia.diferencia))}. La cuantía de un procedimiento por ítems
                es la sumatoria (Art. 53.3).
              </span>
            </p>
          ) : null}

          {agrupamiento.estado === "no_procede" ? (
            <p className="aviso aviso--error">
              <TriangleAlert size={14} aria-hidden />
              <span>
                No se puede convocar por ítems, lotes ni tramos:{" "}
                {agrupamiento.nrosPorDebajo.length > 1 ? "los ítems" : "el ítem"}{" "}
                <strong>{agrupamiento.nrosPorDebajo.join(", ")}</strong>{" "}
                {agrupamiento.nrosPorDebajo.length > 1 ? "no superan" : "no supera"} el tope del
                contrato menor ({soles(agrupamiento.umbral)}). El Art. 52.1.b lo exige para cada
                uno, y en el importe exacto todavía es contrato menor. Cabe fusionarlos o ir por
                paquete.
              </span>
            </p>
          ) : null}

          {agrupamiento.estado === "sin_importes" ? (
            // Nota, no aviso: no hay nada mal, falta valorizar. El pedido del
            // SIGA no trae precios, así que este es el estado normal justo
            // después de importar.
            <p className="necItemsNota">
              Falta valorizar: el pedido del SIGA no trae precios. Al poner los importes se
              comprueba solo si cabe convocar por ítems (cada uno debe superar el tope del contrato
              menor, Art. 52.1.b).
            </p>
          ) : null}

          {sinCodigo.length > 0 ? (
            <p className="aviso aviso--error">
              <TriangleAlert size={14} aria-hidden />
              <span>
                La Subasta Inversa Electrónica se convoca sobre bienes o servicios comunes con
                ficha técnica del Listado, y{" "}
                {sinCodigo.length > 1 ? "los ítems" : "el ítem"}{" "}
                <strong>{sinCodigo.join(", ")}</strong> {sinCodigo.length > 1 ? "no llevan" : "no lleva"}{" "}
                código de catálogo. Sin él no hay ficha que referenciar (Art. 95 del Reglamento).
              </span>
            </p>
          ) : null}

          {agrupamiento.estado === "sin_uit" ? (
            <p className="aviso">
              <TriangleAlert size={14} aria-hidden />
              <span>
                No se puede comprobar el tope del contrato menor: falta el valor de la UIT en
                Configuración → Municipalidad.
              </span>
            </p>
          ) : null}

          {paquetes.length > 0 ? (
            <div className="necItemsPaquetes">
              <span className="fichaSubgrupo">
                Paquetes — cada uno es un solo objeto contractual (Art. 52.1.a)
              </span>
              <ul>
                {paquetes.map((paq) => (
                  <li key={paq.nro}>
                    <strong>Paquete {paq.nro}</strong>: ítems{" "}
                    {paq.items.map((i) => i.nro).join(", ")}
                    {paq.monto !== null ? ` — ${soles(paq.monto)}` : ""}
                  </li>
                ))}
                {sueltos.length > 0 ? (
                  <li className="necItemsSueltos">
                    Sin empaquetar: ítems {sueltos.map((i) => i.nro).join(", ")}
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          {unSoloItem.length > 0 ? (
            <p className="aviso aviso--error">
              <TriangleAlert size={14} aria-hidden />
              <span>
                {unSoloItem.length > 1 ? "Los paquetes" : "El paquete"}{" "}
                <strong>{unSoloItem.join(", ")}</strong>{" "}
                {unSoloItem.length > 1 ? "tienen" : "tiene"} un solo ítem. El Art. 52.1.a agrupa
                VARIOS bienes o servicios en un mismo objeto contractual: con uno solo no se agrupa
                nada, así que sobra el paquete o le faltan sus otros ítems.
              </span>
            </p>
          ) : null}

          {objeto?.hayVarios ? (
            <p className="aviso">
              <span>
                Hay prestaciones de distinta naturaleza. La de mayor costo es{" "}
                <strong>{objeto.objeto}</strong> ({soles(objeto.monto)}), así que el objeto del
                requerimiento sería ese (Art. 44.10) — salvo que desvirtúe la naturaleza de la
                contratación, que es un juicio tuyo.
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
