"use client";

import { useEffect, useMemo, useState } from "react";
import { type Feriado, parseFeriados, setDeFeriados } from "@/lib/feriados";
import { cargarFeriados, olvidarFeriados } from "@/lib/feriados-cache";

const FERIADOS_REFRESH = "feriados:refresh";

/**
 * Invalida la caché de feriados en todos los componentes que usen `useFeriados`.
 * Llámala después de guardar cambios en la pestaña de feriados.
 *
 * Olvida primero la caché compartida y LUEGO avisa a las instancias montadas:
 * si solo se disparara el evento, cada `useFeriados` volvería a pedir pero
 * `cargarFeriados` le devolvería la promesa vieja ya resuelta.
 */
export function invalidateFeriados() {
  olvidarFeriados();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(FERIADOS_REFRESH));
  }
}

/**
 * Carga los feriados registrados en Configuración y expone el conjunto de fechas
 * para el cálculo de plazos en días hábiles. Se refetchea al detectar el evento
 * `feriados:refresh` (disparado por `invalidateFeriados` tras guardar cambios).
 * Si el endpoint falla, devuelve un conjunto vacío.
 */
export function useFeriados() {
  const [feriados, setFeriados] = useState<Feriado[]>([]);

  useEffect(() => {
    let vivo = true;
    const load = () => {
      // Petición compartida entre instancias (los 3 FasePanel montan a la vez):
      // la primera va a la red, las demás reutilizan la promesa.
      void cargarFeriados()
        .then((raw) => {
          if (vivo) setFeriados(parseFeriados(raw));
        })
        .catch(() => undefined);
    };
    load();
    window.addEventListener(FERIADOS_REFRESH, load);
    return () => {
      vivo = false;
      window.removeEventListener(FERIADOS_REFRESH, load);
    };
  }, []);

  const setFechas = useMemo(() => setDeFeriados(feriados), [feriados]);
  return { feriados, setFechas };
}
