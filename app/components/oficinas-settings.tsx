"use client";

import { useState } from "react";
import { AreasTab } from "./oficinas/areas-tab";
import { MembreteTab } from "./oficinas/membrete-tab";
import { NumeracionTab } from "./oficinas/numeracion-tab";
import { ErrorLine, LoadingLine, type Oficina } from "./oficinas/use-oficinas";

type Tab = "areas" | "numeracion" | "membrete";

// Contenido de las tres secciones de OFICINAS:
//   1) Áreas      - CRUD de oficinas (nombre, entidad, responsable, siglas)
//   2) Numeración - correlativo por tipo (OFICIO/INFORME/CARTA/MEMORÁNDUM)
//   3) Membrete   - PDF de fondo que se usa al exportar respuestas
// Regla: numeración y membrete necesitan al menos un área registrada.
//
// La navegación, el encabezado y el estado los gobierna ConfiguracionWorkspace:
// este componente solo pinta la sección que le indican. Antes traía además su
// propio hero y su propia barra de pestañas para funcionar suelto, pero nunca se
// usó así —el workspace siempre lo montaba en modo `chromeless`—, de modo que
// eran ~40 líneas que no llegaban a la pantalla.
export function OficinasSettings({
  section,
  oficinas,
  loading,
  error,
  reload,
  setOficinas,
  aplicarDelServidor,
}: {
  /** Sección a pintar. Si no es una de las suyas, no pinta nada. */
  section: Tab | null;
  // El estado de oficinas lo posee el workspace (una sola carga para toda la
  // página): antes este componente y AdminSettings pedían `/oficinas` cada uno
  // por su cuenta, duplicando la petición —y la de aquí trae las 57 oficinas con
  // sus contadores— en cada apertura y en cada cambio de año.
  oficinas: Oficina[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setOficinas: (v: Oficina[]) => void;
  /** Aplica la lista del servidor tras guardar (actualiza la copia de referencia). */
  aplicarDelServidor: (v: Oficina[]) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const hasOficinas = oficinas.length > 0;

  if (!section) return null;
  const shownTab: Tab = section;

  return (
    <section>
      {localError ? <ErrorLine message={localError} /> : null}
      {error ? <ErrorLine message={error} /> : null}

      {loading ? (
        <LoadingLine message="Cargando oficinas..." />
      ) : !hasOficinas && shownTab !== "areas" ? (
        // Numeración y membrete necesitan al menos un área registrada.
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface px-5 py-10 text-center text-[14px] text-muted">
          <p className="m-0 max-w-[360px]">Primero registra un área en la pestaña &ldquo;Áreas&rdquo; para configurar la {shownTab === "numeracion" ? "numeración correlativa" : "hoja membretada"}.</p>
        </div>
      ) : shownTab === "areas" ? (
        <AreasTab
          oficinas={oficinas}
          setOficinas={setOficinas}
          aplicarDelServidor={aplicarDelServidor}
          busyId={busyId}
          setBusyId={setBusyId}
          // Se pasa el error real: con `null` fijo, el bloque de alerta que la
          // pestaña pinta junto a la lista era código muerto y el fallo solo se
          // veía arriba del panel, fuera de vista al final de una lista larga.
          error={localError}
          setError={setLocalError}
          reload={reload}
        />
      ) : shownTab === "numeracion" ? (
        <NumeracionTab
          oficinas={oficinas}
          setOficinas={setOficinas}
          busyId={busyId}
          setBusyId={setBusyId}
          setError={setLocalError}
          reload={reload}
        />
      ) : (
        <MembreteTab
          oficinas={oficinas}
          setOficinas={setOficinas}
          busyId={busyId}
          setBusyId={setBusyId}
          setError={setLocalError}
          reload={reload}
        />
      )}
    </section>
  );
}
