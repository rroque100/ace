"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Plus, Trash2, UserPlus } from "lucide-react";
import {
  type IntegranteEvaluador,
  leerIntegrantes,
  ROL_DE_TIPO_EVALUADOR,
  ROLES_PANEL_POR_TIPO,
  soloTieneCorreo,
} from "@/lib/designacion-evaluadores";
import type { Personal } from "@/lib/personal";
import { PersonaPicker } from "./persona-picker";
import { PROV_QUITAR, PROV_TABLA, PROV_VACIA } from "./tabla-editor-estilos";

type UsuarioRol = {
  id: string;
  email: string;
  nombre: string | null;
  dni: string | null;
  cargo: string | null;
  gradoAcademico: string | null;
  oficina: string | null;
};

/**
 * A6 · Nombres y roles de los integrantes del panel evaluador.
 *
 * Se eligen del catálogo de usuarios de Configuración (los del rol que
 * corresponde al tipo de evaluador de A4), en vez de teclearlos: así el nombre
 * que va al documento de designación es el registrado, no uno escrito de nuevo
 * que puede diferir. Editable después, y con opción de añadir a alguien a mano.
 */
export function EvaluadoresEditor({
  value,
  onChange,
  readOnly,
  tipoEvaluador,
  cantidad,
  proponente,
}: {
  value: unknown;
  onChange: (next: IntegranteEvaluador[]) => void;
  readOnly?: boolean;
  /** Tipo elegido en A4 (var_e_tipo_evaluador): determina de qué rol se traen. */
  tipoEvaluador?: string;
  /** Número de integrantes (A6): se crean tantas filas de TITULARES como diga. */
  cantidad?: string;
  /** Qué sección es (comité): DEC o área usuaria. Fija el rol por defecto. */
  proponente?: "dec" | "area_usuaria";
}) {
  const filas = leerIntegrantes(value);
  // En COMITÉ cada miembro se propone con su suplente (Arts. 59.1/60.1), así que
  // la plantilla de filas es [titular, suplente] por miembro; en oficial/jurado
  // solo titulares. `cantidad` es el número de MIEMBROS de esta sección.
  const conSuplentes = tipoEvaluador === "comite";

  // Auto-rellena la estructura de filas con la condición y el rol correctos
  // (comité DEC → titular/suplente comprador; comité área usuaria → dos parejas
  // experto; oficial/jurado → titulares). Si el editor aún NO tiene datos, pone la
  // plantilla completa; si ya hay datos, solo añade titulares que falten y no pisa
  // nada. Reacciona solo al cambio de cantidad.
  useEffect(() => {
    if (readOnly) return;
    const n = Number(cantidad);
    if (!Number.isFinite(n) || n < 1) return;
    const objetivo = patronObjetivo(n, conSuplentes, tipoEvaluador, proponente);
    const hayDatos = filas.some((f) => !filaVaciaEs(f));
    if (!hayDatos) {
      const distinto =
        filas.length !== objetivo.length ||
        filas.some((f, i) => (f.condicion ?? "titular") !== objetivo[i].condicion || (f.rol ?? "") !== (objetivo[i].rol ?? ""));
      if (distinto) onChange(objetivo);
      return;
    }
    const titulares = filas.filter((f) => (f.condicion ?? "titular") === "titular").length;
    if (titulares < n) {
      onChange([
        ...filas,
        ...Array.from({ length: n - titulares }, () => filaVacia(tipoEvaluador, proponente)),
      ]);
    }
    // Solo debe reaccionar al cambio de cantidad (no a cada tecla en las filas).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cantidad]);
  const rol = tipoEvaluador ? ROL_DE_TIPO_EVALUADOR[tipoEvaluador] : undefined;
  // Roles válidos del panel (Art. 56.1) y si procede la columna titular/suplente
  // (comité y jurado la llevan; el oficial de compra es único, Art. 58.1).
  const rolesDisponibles = tipoEvaluador ? (ROLES_PANEL_POR_TIPO[tipoEvaluador] ?? []) : [];
  const mostrarCondicion = tipoEvaluador === "comite" || tipoEvaluador === "jurado";

  const [candidatos, setCandidatos] = useState<UsuarioRol[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!rol) {
      setCandidatos([]);
      return;
    }
    let cancelado = false;
    setCargando(true);
    setError("");
    fetch(`/api/configuracion/users/por-rol?role=${encodeURIComponent(rol)}`, { cache: "no-store" })
      .then(async (res) => {
        const payload = await res.json();
        if (cancelado) return;
        if (!res.ok) {
          setError(payload.error ?? "No se pudieron cargar los usuarios.");
          setCandidatos([]);
          return;
        }
        setCandidatos(Array.isArray(payload.usuarios) ? payload.usuarios : []);
      })
      .catch(() => {
        if (!cancelado) setError("No se pudo conectar para cargar los usuarios.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [rol]);

  // Nombre, DNI y cargo de los integrantes que vienen de Configuración son de
  // Configuración: al cargar la lista se refrescan desde ahí. Así, si el DNI se
  // completó en Configuración › Usuarios DESPUÉS de designar, al reabrir A6 ya
  // aparece. Solo RELLENA (nunca borra): un perfil incompleto no destruye lo que
  // ya se había capturado. Depende solo de `candidatos` para no entrar en bucle.
  useEffect(() => {
    if (candidatos.length === 0) return;
    const porId = new Map(candidatos.map((c) => [c.id, c]));
    let cambio = false;
    const next = filas.map((f) => {
      if (!f.usuarioId) return f; // manual: no se toca
      const c = porId.get(f.usuarioId);
      if (!c) return f;
      const actualizado = {
        ...f,
        nombre: (c.nombre ?? "").trim() || f.nombre,
        dni: (c.dni ?? "").trim() || f.dni,
        // Grado ("ABG.") y cargo ("UNIDAD DE ADQUISICIÓN") por separado: el
        // grado antecede al nombre y el cargo va debajo en el memorándum.
        grado: (c.gradoAcademico ?? "").trim() || f.grado,
        cargo: (c.cargo ?? "").trim() || f.cargo,
        correo: c.email,
      };
      if (
        actualizado.nombre !== f.nombre ||
        (actualizado.dni ?? "") !== (f.dni ?? "") ||
        (actualizado.grado ?? "") !== (f.grado ?? "") ||
        (actualizado.cargo ?? "") !== (f.cargo ?? "")
      ) {
        cambio = true;
      }
      return actualizado;
    });
    if (cambio) onChange(next);
    // filas/onChange se omiten a propósito: solo debe correr al llegar la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatos]);

  function editar(i: number, campo: keyof IntegranteEvaluador, v: string) {
    onChange(filas.map((f, j) => (j === i ? { ...f, [campo]: v } : f)));
  }

  // Aplica varios campos de una vez (al elegir a alguien del padrón: nombre, DNI y
  // unidad juntos, para no encadenar tres renders ni pisarse entre sí).
  function editarVarios(i: number, patch: Partial<IntegranteEvaluador>) {
    onChange(filas.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  }

  // Rellena una fila (a mano) con los datos de una persona del padrón: solo nombre
  // y DNI. La unidad (nombre_cc) no se usa en A6 —no se requiere—, así que no se
  // vuelca al cargo. El grado del padrón es de instrucción (T/B/O), no académico.
  function elegirDelPadron(i: number, p: Personal) {
    editarVarios(i, {
      nombre: p.nombreCompleto,
      dni: p.documento ?? "",
    });
  }

  function quitar(i: number) {
    onChange(filas.filter((_, j) => j !== i));
  }

  function agregarUsuario(u: UsuarioRol) {
    // El grado ("ABG.") antecede al nombre en el "A:" del memorándum; el cargo
    // ("UNIDAD DE ADQUISICIÓN") va debajo. Se capturan de Configuración.
    onChange([
      ...filas,
      {
        usuarioId: u.id,
        nombre: u.nombre ?? "",
        dni: u.dni ?? "",
        grado: (u.gradoAcademico ?? "").trim(),
        cargo: (u.cargo ?? "").trim(),
        correo: u.email,
        rol: rolPorDefecto(tipoEvaluador, proponente),
        condicion: "titular",
      },
    ]);
  }

  function agregarManual() {
    onChange([...filas, filaVacia(tipoEvaluador, proponente)]);
  }

  // Usuarios que aún no están en la tabla, para no proponer duplicados.
  const yaElegidos = new Set(filas.map((f) => f.usuarioId).filter(Boolean));
  const disponibles = candidatos.filter((c) => !yaElegidos.has(c.id));

  return (
    <div className={PROV_TABLA}>
      {filas.length === 0 ? (
        <p className={PROV_VACIA}>
          Sin integrantes.{" "}
          {rol
            ? "Elige a los usuarios registrados con el rol correspondiente, o añade a alguien buscándolo en el padrón de personal."
            : "Elige primero el tipo de evaluador para ver a los usuarios que puedes designar."}
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>DNI</th>
              {mostrarCondicion ? <th>Condición</th> : null}
              <th>Rol en el panel</th>
              {!readOnly ? <th aria-label="Quitar" /> : null}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                <td>
                  {/* Fila a mano: se busca del padrón (autollena nombre, DNI y
                      unidad) y se puede además escribir un nombre libre. La que
                      viene de Configuración muestra su nombre, no se busca. */}
                  {!readOnly && !f.usuarioId ? (
                    <PersonaPicker
                      ariaLabel={`Nombre del integrante ${i + 1}`}
                      value={f.nombre ?? ""}
                      onText={(v) => editar(i, "nombre", v)}
                      onSelect={(p) => elegirDelPadron(i, p)}
                      placeholder="Buscar en el padrón o escribir…"
                      mostrarUnidad={false}
                    />
                  ) : (
                    <input
                      aria-label={`Nombre del integrante ${i + 1}`}
                      disabled={readOnly}
                      onChange={(e) => editar(i, "nombre", e.target.value)}
                      placeholder="Nombre completo"
                      value={f.nombre ?? ""}
                    />
                  )}
                  {/* El documento se firma: un designado identificado solo por su
                      correo delata que su nombre falta en Configuración. */}
                  {soloTieneCorreo(f) ? (
                    <small className="mt-[3px] flex items-center gap-1 text-[11px] text-warning">
                      <AlertTriangle size={11} /> {f.correo} — sin nombre en Configuración. Complétalo
                      aquí o en Configuración › Usuarios.
                    </small>
                  ) : null}
                </td>
                <td>
                  {/* El DNI de un integrante traído de Configuración es de
                      Configuración: se muestra pero no se teclea aquí. Para el
                      añadido a mano sí es editable. */}
                  <input
                    aria-label={`DNI del integrante ${i + 1}`}
                    disabled={readOnly || Boolean(f.usuarioId)}
                    inputMode="numeric"
                    onChange={(e) => editar(i, "dni", e.target.value)}
                    placeholder={f.usuarioId ? "— sin DNI —" : "DNI"}
                    value={f.dni ?? ""}
                  />
                  {/* El DNI va a la declaración jurada y al consentimiento (A6):
                      sin él, esos documentos salen con el hueco en blanco. */}
                  {(f.nombre ?? "").trim() && !(f.dni ?? "").trim() ? (
                    <small className="mt-[3px] flex items-center gap-1 text-[11px] text-warning">
                      <AlertTriangle size={11} />{" "}
                      {f.usuarioId
                        ? "Sin DNI en Configuración › Usuarios. Complétalo allí y vuelve a abrir."
                        : "Sin DNI: falta en la jurada y el consentimiento."}
                    </small>
                  ) : null}
                </td>
                {mostrarCondicion ? (
                  <td>
                    <select
                      aria-label={`Condición del integrante ${i + 1}`}
                      disabled={readOnly}
                      onChange={(e) => editar(i, "condicion", e.target.value)}
                      value={f.condicion ?? "titular"}
                    >
                      <option value="titular">Titular</option>
                      <option value="suplente">Suplente</option>
                    </select>
                    {/* Ordinal dentro de su grupo: "Miembro 1", "Suplente 1"…, para
                        ver de un vistazo qué titular acompaña cada suplente. */}
                    <small className="text-[11px] leading-[1.4] text-muted">
                      {(f.condicion ?? "titular") === "suplente" ? "Suplente" : "Miembro"}{" "}
                      {filas.slice(0, i).filter((x) => (x.condicion ?? "titular") === (f.condicion ?? "titular")).length + 1}
                    </small>
                  </td>
                ) : null}
                <td>
                  <select
                    aria-label={`Rol del integrante ${i + 1}`}
                    disabled={readOnly}
                    onChange={(e) => editar(i, "rol", e.target.value)}
                    value={f.rol ?? ""}
                  >
                    <option value="">— Rol —</option>
                    {rolesDisponibles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                    {/* Dato antiguo con un rol libre que ya no está en la lista: se
                        mantiene como opción para no perderlo al abrir. */}
                    {f.rol && !rolesDisponibles.includes(f.rol) ? (
                      <option value={f.rol}>{f.rol}</option>
                    ) : null}
                  </select>
                </td>
                {!readOnly ? (
                  <td>
                    <button
                      aria-label={`Quitar al integrante ${i + 1}`}
                      className={PROV_QUITAR}
                      onClick={() => quitar(i)}
                      type="button"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!readOnly ? (
        <div className="mt-2 flex flex-wrap items-end gap-2.5">
          {rol ? (
            <label className="flex flex-col gap-[3px] text-[11px] text-muted [&_select]:min-w-[220px]">
              <span>Añadir de Configuración</span>
              <select
                disabled={cargando || disponibles.length === 0}
                onChange={(e) => {
                  const u = disponibles.find((d) => d.id === e.target.value);
                  if (u) agregarUsuario(u);
                  e.target.value = "";
                }}
                value=""
              >
                <option value="">
                  {cargando
                    ? "Cargando…"
                    : disponibles.length === 0
                      ? candidatos.length === 0
                        ? "No hay usuarios con ese rol"
                        : "Ya están todos añadidos"
                      : "— Elegir usuario —"}
                </option>
                {disponibles.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.nombre ?? "").trim() || u.email}
                    {u.cargo ? ` · ${u.cargo}` : u.oficina ? ` · ${u.oficina}` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button className="secondaryButton compactButton" onClick={agregarManual} type="button">
            <Plus size={13} /> Añadir del padrón
          </button>
        </div>
      ) : null}

      {error ? <small className="mt-[3px] flex items-center gap-1 text-[11px] text-warning">{error}</small> : null}
      {rol && candidatos.length === 0 && !cargando && !error ? (
        <small className="text-[11px] leading-[1.4] text-muted">
          <UserPlus size={11} /> No hay usuarios con el rol correspondiente en Configuración ›
          Usuarios. Regístralos allí para poder designarlos, o añade a los integrantes a mano.
        </small>
      ) : null}
    </div>
  );
}

/** Rol por defecto de una fila nueva, según el tipo y la sección (comité). */
function rolPorDefecto(tipoEvaluador?: string, proponente?: "dec" | "area_usuaria"): string {
  if (tipoEvaluador === "oficial_compra") return "Oficial de compra";
  if (tipoEvaluador === "jurado") return "Experto";
  if (tipoEvaluador === "comite") {
    return proponente === "area_usuaria" ? "Experto/profesional" : "Comprador público (DEC)";
  }
  return "";
}

/** Una fila de integrante vacía (titular), para las que se crean automáticamente. */
function filaVacia(tipoEvaluador?: string, proponente?: "dec" | "area_usuaria"): IntegranteEvaluador {
  return {
    nombre: "",
    dni: "",
    grado: "",
    cargo: "",
    correo: "",
    rol: rolPorDefecto(tipoEvaluador, proponente),
    condicion: "titular",
  };
}

/** ¿La fila no tiene ningún dato capturado? (para quitar solo filas en blanco). */
function filaVaciaEs(f: IntegranteEvaluador): boolean {
  return !(f.nombre ?? "").trim() && !(f.correo ?? "").trim() && !(f.dni ?? "").trim() && !f.usuarioId;
}

/**
 * Plantilla de filas de una sección: por cada miembro un TITULAR y —en comité— su
 * SUPLENTE a continuación, con el rol por defecto de la sección. Deja el editor con
 * la estructura exacta (p. ej. área usuaria: 1er titular · suplente · 2º titular ·
 * suplente) lista para poner solo los nombres.
 */
function patronObjetivo(
  nMiembros: number,
  conSuplentes: boolean,
  tipoEvaluador?: string,
  proponente?: "dec" | "area_usuaria",
): IntegranteEvaluador[] {
  const rows: IntegranteEvaluador[] = [];
  for (let i = 0; i < nMiembros; i++) {
    rows.push({ ...filaVacia(tipoEvaluador, proponente), condicion: "titular" });
    if (conSuplentes) rows.push({ ...filaVacia(tipoEvaluador, proponente), condicion: "suplente" });
  }
  return rows;
}
