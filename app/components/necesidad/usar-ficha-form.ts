"use client";

import { useEffect, useRef, useState } from "react";
import { direccionDeLaEntidad } from "@/lib/configuracion-types";
import { decidirSiembra, GEMELO } from "@/lib/necesidad-denominacion";
import { FICHA_SECCIONES, type FichaField } from "@/lib/necesidad-ficha-secciones";
import { acotarNumero, LIMITES_TEXTO, NOMBRE_MAX } from "@/lib/necesidades-limites";
import type { Necesidad } from "@/lib/necesidades";
import type { NecesidadItem } from "@/lib/necesidad-items";
import { cuiDeCadenaFuncional } from "@/lib/pedido-compra-import";
import { CAMPO_LABEL } from "./campos-etiquetas";

/**
 * Todo el ciclo de vida del formulario de la ficha: abrirlo, escribir en el,
 * autoguardar, validar y guardar.
 *
 * Vivia suelto en `necesidad-detail.tsx`, repartido en nueve funciones y dos
 * efectos separados por cientos de lineas de otra cosa, sobre diez variables de
 * estado declaradas en un tercer sitio. Estaban acopladas de verdad —el
 * autoguardado y el guardado explicito comparten `construirPayload` y el sello
 * `baseUpdatedAtRef` para detectar el conflicto de version— pero nada lo decia.
 *
 * ATENCION a lo que esto NO hace: el estado sigue viviendo en el componente que
 * llama al hook, asi que los repintados son los mismos. Lo que cambia es que el
 * ciclo esta junto y tiene nombre, que es lo que hacia falta ANTES de poder
 * mover la ficha editable a su propio componente.
 *
 * Los cinco callbacks son las unicas salidas hacia el resto de la pantalla, y
 * estan ahi porque el formulario no manda sobre ellas: el aviso de error es de
 * la pagina, la recarga trae la necesidad entera, y el modo de trabajo y el
 * paso a paso son decisiones de presentacion.
 */
/** Valor de la base a cadena; null y undefined son cadena vacia. */
export function toStr(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

export type EstadoAutoguardado = "" | "guardando" | "guardado" | "error";

export function useFichaForm({
  campoEsObligatorio,
  camposParaObjeto,
  entidad,
  items,
  itemsGuardados,
  necesidad,
  necesidadId,
  onAntesDeEditar,
  onError,
  onGuardado,
  onSalirDelPasoAPaso,
  year,
}: {
  /** Predicado del catalogo; depende de los ejes, que calcula quien llama. */
  campoEsObligatorio: (field: FichaField) => boolean;
  /** Filtra los campos que aplican al objeto y al procedimiento actuales. */
  camposParaObjeto: (fields: FichaField[]) => FichaField[];
  /**
   * Entidad configurada, para sembrar al abrir lo que ya está en Configuración:
   * la denominación, la unidad ejecutora y el domicilio.
   */
  entidad:
    | {
        address?: string | null;
        city?: string | null;
        department?: string | null;
        executingUnit?: string | null;
        name?: string | null;
        province?: string | null;
      }
    | null
    | undefined;
  items: NecesidadItem[];
  /** Serializacion de los items tal como estan guardados, para no reescribirlos. */
  itemsGuardados: string;
  necesidad: Necesidad | null;
  necesidadId: string;
  /** Antes de abrir la edicion: en Revisar la ficha es de solo lectura. */
  onAntesDeEditar: () => void;
  /** Cadena vacia limpia el aviso. */
  onError: (mensaje: string) => void;
  /**
   * Se llama tras un guardado con éxito con la necesidad fresca (del PATCH) y,
   * si el cuadro cambió, los ítems (del PUT). Reemplaza a la recarga completa:
   * guardar solo cambia `necesidades` e `necesidad_items`, no documentos,
   * observaciones, versiones, admisibilidad ni el hitoEstado de transiciones.
   */
  onGuardado: (necesidad: Necesidad, items?: NecesidadItem[]) => void;
  /** Al fallar la validacion: el campo que falta suele estar en otro paso. */
  onSalirDelPasoAPaso: () => void;
  /** Ejercicio fiscal, para sembrar el año al abrir. */
  year: number;
}) {
  const [fichaEdit, setFichaEdit] = useState(false);
  const [fichaForm, setFichaForm] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [camposTocados, setCamposTocados] = useState<Set<string>>(new Set());
  /** Campos cuyo valor local difiere de lo guardado: trabajo de este navegador. */
  const [camposBorrador, setCamposBorrador] = useState<string[]>([]);
  const [formSucio, setFormSucio] = useState(false);
  const [autoguardado, setAutoguardado] = useState<EstadoAutoguardado>("");
  const [conflictoGuardado, setConflictoGuardado] = useState(false);
  const [savingFicha, setSavingFicha] = useState(false);
  /** Campos sembrados por su gemelo y aun no tocados a mano. */
  const [sembrados, setSembrados] = useState<ReadonlySet<string>>(new Set());
  /**
   * El api del primer campo obligatorio que falta tras un guardado fallido.
   *
   * Lo decide el guardado y lo consume el efecto de foco de quien llama. Vive
   * aqui y no fuera porque un hook no debe modificar lo que le pasan: quien
   * escribe el dato debe ser su dueño.
   */
  const focoPendiente = useRef<string | null>(null);
  /** Sello de version con el que se abrio: el servidor rechaza si ya no cuadra. */
  const baseUpdatedAtRef = useRef<string | null>(null);
  // Serializa el autoguardado: solo uno en vuelo. `pendiente` recuerda que
  // llegaron cambios mientras uno corría, para vaciarlos al terminar con el
  // sello ya avanzado —así el autoguardado no choca CONSIGO MISMO con un 409—.
  const guardandoRef = useRef(false);
  const pendienteRef = useRef(false);


  const DRAFT_KEY = `ficha-draft-${necesidadId}`;

  /**
   * Los valores tal como están GUARDADOS en la base, sin borrador encima.
   * Es la referencia contra la que se detecta qué sigue sin guardarse.
   */
  function valoresDeLaBase(n: Necesidad): Record<string, string> {
    const base: Record<string, string> = {
      nombre: toStr(n.nombre),
      tipoObjeto: toStr(n.tipo_objeto),
      tipoProcesoSeleccion: toStr(n.tipo_proceso_seleccion),
      tipoArea: toStr(n.tipo_area),
    };
    for (const section of FICHA_SECCIONES) {
      for (const field of section.fields) {
        base[field.api] = field.checkbox ? String(Boolean(n[field.col])) : toStr(n[field.col]);
      }
    }
    // El CUI de las fichas importadas ANTES de que el parser mapeara `act_proy`
    // vive dentro de la cadena funcional del SIGA
    // ("03-006-0010-2661009-6000008" → el 4.º segmento). El dato nunca se
    // perdió, solo no tenía columna: se rescata en vez de obligar a teclearlo.
    if (!base.cui) base.cui = cuiDeCadenaFuncional(n.cadena_funcional) ?? "";
    return base;
  }

  // El sello base sigue a la necesidad cargada (carga inicial, reload, transición).
  // Los guardados que no recargan (autoguardado) lo avanzan por su cuenta.
  useEffect(() => {
    baseUpdatedAtRef.current = necesidad?.updated_at ?? null;
  }, [necesidad?.updated_at]);

  function startFichaEdit() {
    // En Revisar la ficha es de solo lectura.
    onAntesDeEditar();
    if (!necesidad) return;
    const initial = valoresDeLaBase(necesidad);
    if (!initial.entidad && entidad?.name) initial.entidad = entidad.name;
    if (!initial.unidadEjecutora && entidad?.executingUnit) initial.unidadEjecutora = entidad.executingUnit;
    if (!initial.anioFiscal) initial.anioFiscal = String(year);
    // El domicilio de la entidad ya está en Configuración → Datos de la entidad,
    // partido en cuatro casillas. Aquí hace falta la línea entera, y volver a
    // teclearla en cada requerimiento es como acaban conviviendo tres
    // direcciones distintas de la misma municipalidad.
    if (!initial.formaPagoDireccion) initial.formaPagoDireccion = direccionDeLaEntidad(entidad);
    if (initial.areaUsuaria && !initial.centroCosto) initial.centroCosto = initial.areaUsuaria;
    if (initial.centroCosto && !initial.areaUsuaria) initial.areaUsuaria = initial.centroCosto;
    // Cargar borrador local si existe
    const base = valoresDeLaBase(necesidad);
    const delBorrador: string[] = [];
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        const parsed = JSON.parse(draft) as Record<string, string>;
        for (const key of Object.keys(parsed)) {
          if (key in initial || key === "nombre" || key === "tipoObjeto" || key === "tipoArea") {
            initial[key] = parsed[key];
            // Lo que el borrador cambia respecto a la base es, literalmente,
            // trabajo que solo existe en este navegador.
            if ((parsed[key] ?? "") !== (base[key] ?? "")) delBorrador.push(key);
          }
        }
      }
    } catch { /* ignora */ }
    setCamposBorrador(delBorrador);
    // Los valores que la norma ya impone se siembran al abrir: el cómputo del
    // plazo en días calendario (Art. 105.3), la conformidad en siete días
    // (Art. 144). Antes solo los pintaba el desplegable, así que el formulario
    // no los TENÍA y un campo numérico con valor por defecto se guardaba vacío.
    // Lo que ya está guardado es del usuario: no se siembra sobre ello.
    for (const f of FICHA_SECCIONES.flatMap((s) => s.fields)) {
      if (f.porDefecto && !(initial[f.api] ?? "").trim()) initial[f.api] = f.porDefecto;
    }
    // El área que otorga la conformidad se pide UNA vez, en la forma de pago.
    // La casilla del Art. 144 está oculta y espejada: las fichas anteriores a
    // esto pueden traer el dato en cualquiera de las dos, así que la que tenga
    // algo rellena a la otra.
    if (initial.conformidadArea && !initial.formaPagoAreaConformidad) {
      initial.formaPagoAreaConformidad = initial.conformidadArea;
    }
    if (initial.formaPagoAreaConformidad && !initial.conformidadArea) {
      initial.conformidadArea = initial.formaPagoAreaConformidad;
    }
    // Capar cualquier valor que exceda su tope (p. ej. un borrador con texto de
    // IA demasiado largo): así la ficha se puede guardar y el autoguardado deja
    // de fallar con 400. Sanea el estado atascado en este mismo navegador.
    for (const [key, lim] of Object.entries(LIMITES_TEXTO)) {
      const v = initial[key];
      if (typeof v === "string" && v.length > lim) initial[key] = v.slice(0, lim);
    }
    // Lo que ya está guardado es del usuario: nada se siembra sobre ello.
    setSembrados(new Set());
    setFormSucio(false);
    setAutoguardado("");
    setConflictoGuardado(false);
    baseUpdatedAtRef.current = necesidad.updated_at ?? null;
    setFichaForm(initial);
    setFichaEdit(true);
  }

  /** Descarta el borrador del navegador y recarga lo guardado. */
  function descartarBorrador() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignora */ }
    if (necesidad) {
      const base = valoresDeLaBase(necesidad);
      if (!base.anioFiscal) base.anioFiscal = String(year);
      setFichaForm(base);
    }
    // Descartar es volver a lo guardado: no hay nada que autoguardar, y la
    // siembra vuelve a partir de cero.
    setFormSucio(false);
    setSembrados(new Set());
    setAutoguardado("");
    setCamposBorrador([]);
    setFieldErrors({});
    onError("");
  }

  /**
   * Reconcilia el formulario abierto con lo que una escritura EXTERNA acaba de
   * persistir: el traslado de campos del EETT/TDR o el «aplicar» de los campos
   * que la IA extrajo. Ambos hacen su propio PATCH y recargan la necesidad.
   *
   * Sin esto, `fichaForm` conserva el valor VIEJO de esos campos (normalmente
   * vacío) y, como el autoguardado manda el formulario ENTERO, el siguiente
   * autoguardado los REVIERTE en silencio: el usuario ve cómo lo trasladado
   * desaparece solo. Aquí se re-siembran esos campos desde la necesidad ya
   * recargada, de modo que el formulario y la base coincidan.
   *
   * Solo actúa en edición (en lectura no hay formulario). No marca `formSucio`:
   * los valores YA están guardados. Debe llamarse con la necesidad recargada
   * (valores frescos) y la lista de apis que se escribieron.
   */
  function reconciliarCamposExternos(n: Necesidad, apis: string[]) {
    // El sello de versión avanza SIEMPRE, aun sin estar en edición o sin apis: la
    // escritura externa (aplicar campos IA, traslado EETT/TDR) ya movió
    // `updated_at` en el servidor. Si el formulario conserva el viejo, su próximo
    // autoguardado sale con él y choca con un 409 espurio —«otro usuario guardó»,
    // siendo el mismo— que obliga a recargar y hace «desaparecer» lo insertado.
    // Debe pasar en el MISMO turno que recibe la necesidad fresca, antes de que un
    // autoguardado pendiente pueda dispararse.
    if (n.updated_at) baseUpdatedAtRef.current = n.updated_at;
    if (!fichaEdit || apis.length === 0) return;
    const base = valoresDeLaBase(n);
    setFichaForm((prev) => {
      const next = { ...prev };
      for (const api of apis) {
        if (api in base) next[api] = base[api];
      }
      return next;
    });
    // Ya no son borrador local de este navegador: se acaban de guardar.
    setCamposBorrador((prev) => prev.filter((a) => !apis.includes(a)));
  }

  function setFichaField(api: string, value: string) {
    // Capado defensivo al tope del schema: evita que un texto largo (típicamente
    // redactado por el copiloto IA en un campo de tope corto) deje la ficha
    // imposible de guardar (PATCH 400). Los campos numéricos no están en el mapa.
    const limite = LIMITES_TEXTO[api];
    if (limite && value.length > limite) value = value.slice(0, limite);
    setFormSucio(true);
    // Nombre ↔ Descripción detallada: siembra, no espejo.
    //
    // No son el mismo dato: el nombre es la DENOMINACIÓN (va al ASUNTO del
    // informe A2, a la matriz y a la nomenclatura del expediente) y la
    // descripción es el Art. 126.1 (especificaciones técnicas o TDR), que
    // además compone el alcance de A3. Encadenarlos en espejo haría que
    // escribir uno destruya el otro.
    //
    // Así que el que está vacío se siembra con el que se escribe, y se sigue
    // sembrando MIENTRAS nadie lo haya tocado a mano (si solo se mirara "está
    // vacío", dejaría de copiar en la segunda pulsación). En cuanto el usuario
    // escribe en él, deja de seguir al otro para siempre.
    //
    // La decisión se toma AQUÍ y no dentro del updater de setFichaForm: ese
    // updater debe ser puro, porque React puede ejecutarlo durante el render y
    // más de una vez.
    const { sembrar, sembrados: proximos } = decidirSiembra({
      api,
      maxNombre: NOMBRE_MAX,
      sembrados,
      value,
      valorGemelo: fichaForm[GEMELO[api] ?? ""] ?? "",
    });
    if (GEMELO[api]) setSembrados(proximos);
    setFichaForm((prev) => {
      const next = { ...prev, [api]: value };
      if (sembrar) next[sembrar] = value;
      // Área usuaria y Centro de costo son el mismo campo
      if (api === "areaUsuaria") next.centroCosto = value;
      if (api === "centroCosto") next.areaUsuaria = value;
      // Auto-calcular costo_total = cantidad × costo_unitario
      if (api === "cantidad" || api === "costoUnitario") {
        const cant = Number(api === "cantidad" ? value : prev.cantidad ?? "0");
        const cu = Number(api === "costoUnitario" ? value : prev.costoUnitario ?? "0");
        if (Number.isFinite(cant) && Number.isFinite(cu) && cant > 0 && cu > 0) {
          next.costoTotal = String(cant * cu);
        } else if (api === "costoUnitario" && (value === "" || value === "0")) {
          next.costoTotal = "";
        }
      }
      // Quien firma la conformidad del Art. 144 es quien la firma para el pago
      // del Art. 67: es el mismo dato y ahora se pide una sola vez. La columna
      // del Art. 144 se conserva porque su apartado la usa, así que se espeja.
      if (api === "formaPagoAreaConformidad") next.conformidadArea = value;
      // El borrador local se guarda AL FINAL, no en cuanto se copia el valor
      // tecleado: estaba antes de los tres campos que se derivan aquí —centro
      // de costo, costo total y esta área— y por tanto guardaba un estado que
      // ya no era el que se devolvía. Se corregía solo en la siguiente tecla,
      // así que solo se notaba cerrando la pestaña justo en medio.
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)); } catch { /* ignora */ }
      return next;
    });
  }

  /** Cuerpo del PATCH a partir del formulario. Lo comparten el guardado
   *  explícito y el autoguardado, para que no puedan divergir. */
  function construirPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      nombre: (fichaForm.nombre ?? "").trim(),
      tipoObjeto: fichaForm.tipoObjeto || undefined,
      // "" es un valor legítimo ("— Por definir —"): se envía tal cual (no
      // `|| undefined`) para que volver a esa opción limpie la columna (→ null).
      tipoProcesoSeleccion: fichaForm.tipoProcesoSeleccion ?? "",
      tipoArea: fichaForm.tipoArea || undefined,
    };
    for (const section of FICHA_SECCIONES) {
      for (const field of section.fields) {
        const raw = (fichaForm[field.api] ?? "").trim();
        if (field.checkbox) {
          payload[field.api] = raw === "true";
        } else if (field.kind === "number") {
          if (raw === "") continue;
          const num = Number(raw);
          if (Number.isFinite(num)) {
            // Acotado defensivo al rango del schema, como el capado del texto:
            // un número fuera de rango (p. ej. un plazo de respuestas > 365
            // tecleado o heredado de un borrador) rebotaría en el PATCH con un
            // 400 en CADA autoguardado y bloquearía la ficha entera. Solo los
            // campos con rango declarado (días/periodos, `.int()` en el schema);
            // la cantidad y los importes no declaran rango y no se tocan.
            payload[field.api] =
              field.min !== undefined || field.max !== undefined
                ? acotarNumero(num, field.min, field.max)
                : num;
          }
        } else {
          // Un campo con valor por defecto NO puede viajar vacío: son enums
          // cerrados y el servidor los rechaza con un 400 que bloquea la ficha
          // entera —«No se pudo autoguardar» en cada tecla, sin decir cuál—.
          //
          // Es la segunda capa. La primera es no ofrecer la opción vacía en el
          // desplegable; esta repara además los borradores que ya la tienen
          // guardada en el navegador, que de otro modo seguirían sin poder
          // guardarse aunque el formulario ya no permita llegar ahí.
          payload[field.api] = raw === "" && field.porDefecto ? field.porDefecto : raw;
        }
      }
    }
    return payload;
  }

  /**
   * Autoguardado: persiste lo escrito sin cerrar el formulario ni exigir los
   * obligatorios (se guarda a medias a propósito; el estado de la necesidad no
   * cambia hasta "Guardar ficha").
   *
   * En silencio y sin recargar: no toca `error` ni cierra la edición, porque
   * dispara mientras el usuario escribe. Lo único que sí hace es limpiar el
   * borrador local — una vez guardado en la base, el aviso de "sin guardar"
   * sería mentira.
   */
  async function autoguardarFicha() {
    // Ya hay un autoguardado en vuelo: no arranques otro en paralelo (mandaría el
    // sello viejo -> 409 propio, que es justo lo que el copiloto disparaba al
    // insertar varios campos seguidos). Marca pendiente y sal; el que corre lo
    // re-lanza al terminar con el sello ya fresco.
    if (guardandoRef.current) {
      pendienteRef.current = true;
      return;
    }
    guardandoRef.current = true;
    let exito = false;
    const payload = construirPayload();
    // El schema pide min(3) y max(NOMBRE_MAX): con un nombre a medio escribir
    // se guarda todo lo demás y se deja el nombre para el guardado explícito.
    const nombre = String(payload.nombre ?? "");
    if (nombre.length < 3 || nombre.length > NOMBRE_MAX) delete payload.nombre;
    setAutoguardado("guardando");
    try {
      const response = await fetch(`/api/necesidades/${necesidadId}`, {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          ...(baseUpdatedAtRef.current ? { "X-Base-Updated-At": baseUpdatedAtRef.current } : {}),
        },
        method: "PATCH",
      });
      if (response.status === 409) {
        // Otro actor guardó en medio: se detiene el autoguardado y se avisa. El
        // borrador local se conserva para no perder lo tecleado antes de recargar.
        setConflictoGuardado(true);
        setAutoguardado("error");
        return;
      }
      if (!response.ok) {
        setAutoguardado("error");
        // Si el servidor DIJO por qué, se enseña. No se arregla solo y va a
        // fallar en cada tecla hasta que alguien lo corrija; callarlo deja al
        // usuario con «No se pudo autoguardar» y setenta campos que mirar.
        //
        // Antes solo se enseñaba en el 400. El 500 se callaba por «pasajero», y
        // resultó no serlo: cuando la base no tiene una columna que la ficha ya
        // envía —el SQL de una migración sin correr— la ruta responde 500 con el
        // nombre exacto de la columna, y ese mensaje se estaba tirando. Es justo
        // el que resuelve el problema en un minuto.
        //
        // Lo que sigue callado es lo que NO trae mensaje: un fallo de red deja
        // el `catch` de abajo, y ahí sí es pasajero.
        const detalle = await response.json().catch(() => null);
        if (detalle?.error) onError(detalle.error);
        return;
      }
      const data = await response.json().catch(() => null);
      if (data?.necesidad?.updated_at) baseUpdatedAtRef.current = data.necesidad.updated_at;
      setAutoguardado("guardado");
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignora */ }
      setCamposBorrador([]);
      exito = true;
    } catch {
      setAutoguardado("error");
    } finally {
      // Libera el turno. Si llegaron cambios mientras guardaba, vacíalos ahora
      // —con el sello ya avanzado—. Solo tras ÉXITO: en 409/error no se re-lanza
      // (el usuario recupera con «Recargar» / «Guardar ficha»), para no insistir.
      guardandoRef.current = false;
      if (pendienteRef.current && exito) {
        pendienteRef.current = false;
        void autoguardarFicha();
      }
    }
  }

  // Autoguardado: 1,5 s tras la última tecla. El temporizador se reinicia en
  // cada cambio, así que escribiendo seguido no dispara nada; salta al parar.
  //
  // `fichaForm` entero en las dependencias: cualquier cambio del formulario
  // (incluida la siembra del gemelo) debe persistirse.
  //
  // `savingFicha` en el guard y las deps: al pulsar «Guardar ficha» el efecto se
  // reejecuta, su cleanup CANCELA el temporizador pendiente y no agenda otro. Sin
  // esto, un autoguardado ya programado disparaba en medio del guardado explícito;
  // los dos leían el mismo sello y el segundo en confirmar chocaba con un 409
  // espurio. Al terminar el guardado (`savingFicha` vuelve a false) se reagenda si
  // sigue habiendo cambios.
  useEffect(() => {
    if (!fichaEdit || !formSucio || conflictoGuardado || savingFicha) return;
    const t = setTimeout(() => { void autoguardarFicha(); }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichaForm, fichaEdit, formSucio, conflictoGuardado, savingFicha]);

  async function saveFicha() {
    if ((fichaForm.nombre ?? "").trim().length < 3) {
      onError("El nombre de la contratación no puede quedar vacío.");
      return;
    }
    const newErrors: Record<string, string> = {};
    for (const section of FICHA_SECCIONES) {
      // Solo se exigen los obligatorios que APLICAN al tipo de objeto: si no se
      // filtra, campos como "Sistema de entrega" (solo servicios/obras) bloquean
      // el guardado de una necesidad de bienes sin estar siquiera visibles.
      for (const field of camposParaObjeto(section.fields)) {
        if (campoEsObligatorio(field) && !(fichaForm[field.api] ?? "").trim()) {
          newErrors[field.api] = `Campo obligatorio`;
        }
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      // `newErrors` se llena recorriendo FICHA_SECCIONES y las claves de texto
      // conservan el orden de insercion: la primera ES la primera del formulario.
      const faltan = Object.keys(newErrors);
      const primero = faltan[0];
      const comoSeLlama = CAMPO_LABEL[primero] ?? primero;
      // Se nombra el campo en vez de decir "marcados en rojo": el color no es una
      // senal utilizable por quien no lo distingue ni por un lector de pantalla.
      onError(
        faltan.length === 1
          ? `Falta un campo obligatorio: «${comoSeLlama}».`
          : `Faltan ${faltan.length} campos obligatorios. El primero es «${comoSeLlama}».`,
      );
      focoPendiente.current = primero;
      // El salto al formulario completo se decide AQUI, en respuesta al clic, no
      // dentro del efecto. En "paso a paso" se guarda desde el ultimo paso, asi
      // que el campo que falta casi siempre esta en otro paso y ni siquiera esta
      // montado; ademas el formulario completo ensena todos los errores a la vez
      // y el indice de secciones dice cuantos faltan en cada una.
      onSalirDelPasoAPaso();
      return;
    }
    setFieldErrors({});
    setCamposTocados(new Set());
    setSavingFicha(true);
    onError("");
    // No arranques el PATCH mientras un autoguardado siga EN VUELO: los dos
    // mandarían el mismo sello `updated_at` y el segundo chocaría con un 409
    // «propio» (el aviso «otro usuario guardó» siendo tú mismo). Se espera a que
    // termine —avanza el sello— y se toma el turno; el `finally` lo libera.
    while (guardandoRef.current) await new Promise((r) => setTimeout(r, 30));
    guardandoRef.current = true;
    try {
      const payload = construirPayload();
      const response = await fetch(`/api/necesidades/${necesidadId}`, {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          ...(baseUpdatedAtRef.current ? { "X-Base-Updated-At": baseUpdatedAtRef.current } : {}),
        },
        method: "PATCH",
      });
      const data = await response.json();
      if (response.status === 409) {
        // Conflicto: se mantiene la edición abierta y el borrador, para que el
        // usuario recargue (botón del aviso) y reaplique lo suyo sin perderlo.
        setConflictoGuardado(true);
        onError(data.error ?? "Otro usuario guardó cambios mientras editabas.");
        return;
      }
      if (!response.ok) {
        onError(data.error ?? "No se pudo guardar la ficha.");
        return;
      }
      // El sello de versión se avanza AQUÍ, en cuanto la ficha se guarda, y NO
      // después del PUT de ítems: si los ítems fallan, la fila de la necesidad YA
      // cambió en el servidor y quedarse con el sello viejo hacía que el siguiente
      // guardado (o autoguardado) chocara con un 409 espurio —"otro usuario guardó"
      // siendo el mismo—.
      if (data?.necesidad?.updated_at) baseUpdatedAtRef.current = data.necesidad.updated_at;
      // Los ítems viven en su propia tabla, así que van en una llamada aparte y
      // SOLO si el cuadro cambió: reemplazar la lista borra y reinserta, y
      // hacerlo en cada guardado gastaría ids nuevos sin motivo.
      let itemsFrescos: NecesidadItem[] | undefined;
      if (JSON.stringify(items) !== itemsGuardados) {
        const resItems = await fetch(`/api/necesidades/${necesidadId}/items`, {
          body: JSON.stringify({ items }),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        });
        if (!resItems.ok) {
          const err = await resItems.json().catch(() => ({}));
          // La ficha SÍ se guardó; decirlo evita que se reintente todo.
          onError(
            `La ficha se guardó, pero los ítems no: ${err.error ?? "error desconocido"}. Vuelve a intentarlo.`,
          );
          return;
        }
        // El PUT devuelve los ítems ya guardados (con sus ids y `nro` reales), en
        // la MISMA forma que el GET combinado: se reutilizan para no releerlos.
        const dataItems = await resItems.json().catch(() => null);
        if (dataItems?.items) itemsFrescos = dataItems.items as NecesidadItem[];
      }
      // NO se cierra la edición: al pulsar «Guardar ficha» se queda en el
      // editor para seguir trabajando. Antes saltaba a la vista de lectura, que
      // desde el editor se vivía como «salir de la página».
      //
      // `formSucio` vuelve a false: lo recién guardado ya no está pendiente, y el
      // autoguardado no dispara sin un cambio nuevo. (El sello ya se avanzó arriba,
      // en cuanto la ficha se guardó.)
      setFormSucio(false);
      setAutoguardado("guardado");
      // Guardado con éxito: el borrador ya no representa nada pendiente.
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignora */ }
      setCamposBorrador([]);
      // En vez de recargar 7 tablas: se aplican la necesidad fresca del PATCH y,
      // si el cuadro cambió, los ítems del PUT. Guardar campos solo cambia la fila
      // `necesidades` y `necesidad_items`; documentos, observaciones, versiones,
      // admisibilidad e hitosEstado (auditoría de transiciones) no cambian al guardar.
      onGuardado(data.necesidad, itemsFrescos);
    } catch {
      onError("No se pudo conectar con el servidor.");
    } finally {
      setSavingFicha(false);
      guardandoRef.current = false;
    }
  }

  return {
    autoguardado,
    camposBorrador,
    camposTocados,
    conflictoGuardado,
    descartarBorrador,
    empezarEdicion: startFichaEdit,
    fichaEdit,
    fichaForm,
    fieldErrors,
    focoPendiente,
    formSucio,
    guardar: saveFicha,
    reconciliarCamposExternos,
    savingFicha,
    setCamposTocados,
    setFichaEdit,
    setFichaField,
    setFieldErrors,
    /** Tras recargar por un conflicto: se vuelve a permitir guardar. */
    superarConflicto: () => {
      setConflictoGuardado(false);
      setAutoguardado("");
    },
  };
}
