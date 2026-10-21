"use client";

import { useEffect, useMemo, useState } from "react";
import { PROCESS_TYPES, type TaxonomyOption } from "@/lib/legal-taxonomy";
import { cargarCatalogo } from "@/lib/settings-catalog-cache";

export type ClientCatalogEntity = {
  address: string;
  executingUnit: string;
  governmentLevel: string;
  name: string;
  ruc: string;
  /** PAC de bienes y servicios (base de la línea de corte, Art. 125). null si no
   *  está registrado en Configuración → Municipalidad. */
  pacBienesServicios: number | null;
  /** Ubicación de la entidad (Configuración → Municipalidad); alimenta los
   *  desplegables de departamento/provincia/distrito del requerimiento. */
  department: string;
  province: string;
  city: string;
};

export type ClientCatalogProcess = TaxonomyOption & {
  active: boolean;
  category: "competitivo" | "no_competitivo" | "contrato_menor";
  frequentMunicipality: boolean;
  legalBasis: string;
  object: string;
  sortOrder: number;
};

export type ClientCatalogPermission = {
  area: string;
  scope: string;
};

export type ClientSettingsCatalog = {
  entity: ClientCatalogEntity;
  processTypes: ClientCatalogProcess[];
  user: {
    email: string | null;
    entity: string | null;
    id: string;
    isAdmin: boolean;
    isDec: boolean;
    isLegal: boolean;
    permissions: ClientCatalogPermission[];
    role: string;
  };
};

const fallbackProcessTypes: ClientCatalogProcess[] = PROCESS_TYPES.filter((item) => item.value !== "todos").map(
  (item, index) => ({
    active: true,
    category: "competitivo",
    frequentMunicipality: false,
    label: item.label,
    legalBasis: "",
    object: "",
    sortOrder: index + 1,
    value: item.value,
  }),
);

export function useSettingsCatalog() {
  const [catalog, setCatalog] = useState<ClientSettingsCatalog | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Compartido entre instancias: son trece los componentes que piden este
        // catálogo, y en la ficha de necesidad coinciden dos en pantalla.
        const payload = await cargarCatalogo<ClientSettingsCatalog>();
        if (!cancelled) {
          setCatalog(payload);
        }
      } catch {
        if (!cancelled) {
          setCatalog(null);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const processTypes = useMemo(
    () => (catalog?.processTypes?.length ? catalog.processTypes : fallbackProcessTypes),
    [catalog?.processTypes],
  );

  return {
    catalog,
    entity: catalog?.entity ?? null,
    processTypes,
    user: catalog?.user ?? null,
  };
}

export function withBlankProcessOption(
  processTypes: TaxonomyOption[],
  label = "Todos",
): TaxonomyOption[] {
  return [{ label, value: "" }, ...processTypes];
}

export function processLabelFromOptions(processTypes: TaxonomyOption[], value?: string | null) {
  if (!value) {
    return null;
  }

  return processTypes.find((item) => item.value === value)?.label ?? null;
}
