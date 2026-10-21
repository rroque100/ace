"use client";

// Dispatcher de la configuración de la entidad. La pestaña se pinta en DOS
// variantes que editan la MISMA fila de entity_settings: "entidad" (identidad,
// gobierno y gerente) y "procesos" (AGA + los parámetros que deciden el
// procedimiento de selección). El motor compartido —estado, autoguardado,
// sincronización y validación por variante— vive en `useEntityForm`; aquí solo se
// elige qué componente lo consume. Se conserva el nombre `MunicipalidadTab` para
// que AdminSettings no tenga que cambiar.

import type { EntitySettings, GovernmentLevel } from "@/lib/configuracion-types";
import type { Oficina } from "../oficinas/use-oficinas";
import { useEntityForm, type Variant } from "./use-entity-form";
import { EntidadTab } from "./entidad-tab";
import { ProcesosTab } from "./procesos-tab";

type Props = {
  entity: EntitySettings;
  setEntity: React.Dispatch<React.SetStateAction<EntitySettings>>;
  governmentLevels: GovernmentLevel[];
  /** Qué grupo de secciones pinta esta instancia. Por defecto, la entidad. */
  variant?: Variant;
  /** Oficinas encargadas de las contrataciones (variante "procesos"): alimentan la
   *  sección «Procesos de contratación» y el modal de gestión por oficina. */
  oficinasContrataciones?: Oficina[];
};

export function MunicipalidadTab({
  entity,
  setEntity,
  governmentLevels,
  variant = "entidad",
  oficinasContrataciones = [],
}: Props) {
  const form = useEntityForm({ entity, setEntity, variant });

  return variant === "procesos" ? (
    <ProcesosTab form={form} oficinasContrataciones={oficinasContrataciones} />
  ) : (
    <EntidadTab form={form} governmentLevels={governmentLevels} />
  );
}
