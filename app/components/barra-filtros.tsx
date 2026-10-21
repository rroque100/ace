"use client";

import { Search, X } from "lucide-react";

// Barra de filtros compartida por los listados (necesidades, expedientes).
//
// Existe porque el listado de necesidades ya tenía buscador + desplegables +
// chips de filtro activo, y expedientes necesitaba lo mismo. Copiarlo habría
// dejado dos barras que se parecen sin ser iguales: la clase de bug más aburrida
// —un `type="button"` que falta en una y en la otra no— y dos sitios que tocar
// cada vez que se afina el diseño.
//
// Es una barra TONTA: no sabe de qué se filtra ni consulta nada. Recibe la
// definición de cada filtro y devuelve el valor elegido. Quién sabe qué
// significa "meta presupuestal" es la página, no esta.

export type OpcionFiltro = {
  value: string;
  label: string;
  /** Cuántos registros tiene esa opción, cuando se sabe. Se pinta entre paréntesis. */
  total?: number;
};

export type DefinicionFiltro = {
  /** Identificador estable; se usa como key de React. */
  id: string;
  /** Nombre corto, el que aparece en el chip de filtro activo ("Oficina"). */
  etiqueta: string;
  /** Texto de la opción vacía ("Todas las oficinas"). */
  placeholder: string;
  opciones: OpcionFiltro[];
  valor: string;
  onChange: (valor: string) => void;
};

type Props = {
  busqueda: string;
  onBusqueda: (valor: string) => void;
  placeholderBusqueda: string;
  filtros: DefinicionFiltro[];
  /** Total de resultados, para que filtrar tenga una respuesta visible. */
  resultados?: { total: number; hayMas: boolean; sustantivo: [string, string] };
};

/**
 * Etiqueta legible del valor elegido, para el chip.
 *
 * Se busca en las opciones en vez de enseñar el valor crudo: los desplegables
 * guardan claves ("actuaciones_preparatorias") y el chip tiene que decir
 * "Actuaciones preparatorias". Si el valor no está entre las opciones —porque el
 * catálogo de facetas se quedó corto— se enseña tal cual, que es mejor que un
 * chip vacío con un filtro aplicado por detrás.
 */
function etiquetaDelValor(filtro: DefinicionFiltro): string {
  return filtro.opciones.find((o) => o.value === filtro.valor)?.label ?? filtro.valor;
}

export function BarraFiltros({
  busqueda,
  onBusqueda,
  placeholderBusqueda,
  filtros,
  resultados,
}: Props) {
  const activos = filtros.filter((f) => f.valor);
  const hayFiltros = activos.length > 0 || busqueda.trim().length > 0;

  function limpiarTodo() {
    onBusqueda("");
    for (const f of filtros) f.onChange("");
  }

  return (
    <div className="filtrosZona">
      <div className="filtrosBarra">
        <div className="filtrosBuscador">
          <Search size={15} aria-hidden />
          <input
            aria-label={placeholderBusqueda}
            onChange={(e) => onBusqueda(e.target.value)}
            placeholder={placeholderBusqueda}
            value={busqueda}
          />
          {busqueda ? (
            <button
              aria-label="Borrar la búsqueda"
              className="filtrosBuscadorLimpiar"
              onClick={() => onBusqueda("")}
              type="button"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

      </div>

      {/* Los desplegables en su propia rejilla, con un número FIJO de columnas
          por ancho (3 → 2 → 1). Con `auto-fit` el navegador podía elegir cinco
          columnas y dejar el sexto solo en una fila, ocupando un quinto del
          ancho con hueco al lado. Seis divide bien entre 3, 2 y 1, así que
          fijando las columnas no queda ninguno huérfano en ningún ancho. */}
      <div className="filtrosSelects">
        {filtros.map((filtro) => (
          <select
            aria-label={filtro.placeholder}
            className="filtroSelect"
            data-activo={filtro.valor ? "true" : undefined}
            key={filtro.id}
            onChange={(e) => filtro.onChange(e.target.value)}
            value={filtro.valor}
          >
            <option value="">{filtro.placeholder}</option>
            {/* El valor elegido se conserva aunque las opciones no lo traigan:
                las facetas se leen con un tope, y sin esto el desplegable se
                vaciaría solo dejando el filtro aplicado sin verse. */}
            {filtro.valor && !filtro.opciones.some((o) => o.value === filtro.valor) ? (
              <option value={filtro.valor}>{filtro.valor}</option>
            ) : null}
            {filtro.opciones.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
                {o.total === undefined ? "" : ` (${o.total})`}
              </option>
            ))}
          </select>
        ))}
      </div>

      {/* Los filtros activos, para verlos todos juntos y quitarlos de uno en uno.
          Con cinco o seis desplegables, "limpiar todo" es demasiado bruto y no se
          ve de un vistazo por qué la lista está casi vacía. */}
      {hayFiltros ? (
        <div className="filtrosChips">
          <span className="filtrosChipsTitulo">Filtrando por</span>
          {busqueda.trim() ? (
            <button
              className="filtroChip"
              onClick={() => onBusqueda("")}
              title="Quitar la búsqueda"
              type="button"
            >
              <span className="filtroChipEtiqueta">Búsqueda:</span> {busqueda.trim()}
              <X size={12} aria-hidden />
            </button>
          ) : null}
          {activos.map((filtro) => (
            <button
              className="filtroChip"
              key={filtro.id}
              onClick={() => filtro.onChange("")}
              title={`Quitar el filtro de ${filtro.etiqueta.toLowerCase()}`}
              type="button"
            >
              <span className="filtroChipEtiqueta">{filtro.etiqueta}:</span>{" "}
              {etiquetaDelValor(filtro)}
              <X size={12} aria-hidden />
            </button>
          ))}
          <button className="filtroChipLimpiar" onClick={limpiarTodo} type="button">
            Limpiar todo
          </button>
        </div>
      ) : null}

      {resultados ? (
        <p className="filtrosResultados">
          {resultados.total}
          {resultados.hayMas ? "+" : ""}{" "}
          {resultados.total === 1 ? resultados.sustantivo[0] : resultados.sustantivo[1]}
          {hayFiltros ? " con los filtros aplicados" : ""}
        </p>
      ) : null}
    </div>
  );
}
