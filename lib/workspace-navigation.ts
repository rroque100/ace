import type { SessionUser } from "./auth";
import { NAVEGACION } from "./navegacion";
import { rutaPermitidaExterno } from "./modulos-acceso";

/** Only navigation and display fields cross the server/client boundary. */
export function sidebarIdentity(user: SessionUser | null) {
  if (!user) return null;
  return {
    nombreCompleto: user.nombreCompleto, email: user.email, role: user.role,
    entity: user.entity, esJefe: user.esJefe,
  };
}

export function workspaceNavigation(user: SessionUser | null, processesAllowed: boolean) {
  if (!user) return [];
  return NAVEGACION.map(section => ({
    ...section,
    items: section.items.filter(item => {
      if (user.esExterno) return rutaPermitidaExterno(user.modulosExternos, item.href);
      return (!item.adminOnly || user.isAdmin) &&
        (!("soloAbastecimiento" in item && item.soloAbastecimiento) || processesAllowed);
    }),
  })).filter(section => section.items.length > 0);
}
