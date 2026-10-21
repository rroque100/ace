// Logica pura de la lista de usuarios (pestaña Usuarios): conteo por rol y
// filtrado por rol + termino de busqueda. Vivia como dos `useMemo` dentro de
// `usuarios-tab.tsx`; aqui se prueba sin montar React.
import type { UserSetting } from "./configuracion-types";
import { etiquetaDeCuenta } from "./usuario-credencial";

/** Conteo de usuarios por rol, preservando el orden y los metadatos de `roles`. */
export function contarUsuariosPorRol<R extends { value: string }>(
  roles: R[],
  users: Array<Pick<UserSetting, "role">>,
): Array<R & { count: number }> {
  return roles.map((role) => ({
    ...role,
    count: users.filter((u) => u.role === role.value).length,
  }));
}

/**
 * Filtra usuarios por rol y termino de busqueda, conservando el INDICE original
 * (la lista lo usa para editar la fila correcta). El nombre de la oficina se pasa
 * por accesor porque depende del catalogo de oficinas, que vive en el componente.
 *
 * El termino se busca en la cuenta, la entidad, el nombre completo y la oficina.
 */
export function filtrarUsuarios(
  users: UserSetting[],
  opts: {
    termino: string;
    rol: string;
    nombreOficina: (u: UserSetting) => string | null | undefined;
  },
): Array<{ index: number; user: UserSetting }> {
  const term = opts.termino.trim().toLowerCase();
  return users
    .map((user, index) => ({ index, user }))
    .filter(({ user }) => {
      const coincideRol = opts.rol === "todos" || user.role === opts.rol;
      const coincideTermino =
        !term ||
        etiquetaDeCuenta(user.email).toLowerCase().includes(term) ||
        (user.entity ?? "").toLowerCase().includes(term) ||
        (user.nombreCompleto ?? "").toLowerCase().includes(term) ||
        (opts.nombreOficina(user) ?? "").toLowerCase().includes(term);
      return coincideRol && coincideTermino;
    });
}
