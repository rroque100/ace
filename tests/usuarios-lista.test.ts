import { describe, expect, it } from "vitest";
import { contarUsuariosPorRol, filtrarUsuarios } from "@/lib/usuarios-lista";
import type { UserSetting } from "@/lib/configuracion-types";

let seq = 0;
const u = (extra: Partial<UserSetting>): UserSetting => ({
  createdAt: null,
  email: `1000000${seq++}@ace.local`,
  entity: "",
  id: `id-${seq}`,
  role: "consulta",
  ...extra,
});

describe("contarUsuariosPorRol", () => {
  it("cuenta por rol y conserva el orden y los metadatos de roles", () => {
    const roles = [
      { value: "dec", label: "DEC" },
      { value: "consulta", label: "Consulta" },
    ];
    const users = [u({ role: "dec" }), u({ role: "consulta" }), u({ role: "dec" })];
    expect(contarUsuariosPorRol(roles, users)).toEqual([
      { value: "dec", label: "DEC", count: 2 },
      { value: "consulta", label: "Consulta", count: 0 + 1 },
    ]);
  });
});

describe("filtrarUsuarios", () => {
  const sinOficina = () => null;

  it("con rol «todos» y sin término devuelve todos, con su índice original", () => {
    const users = [u({}), u({}), u({})];
    const out = filtrarUsuarios(users, { termino: "", rol: "todos", nombreOficina: sinOficina });
    expect(out.map((o) => o.index)).toEqual([0, 1, 2]);
  });

  it("filtra por rol", () => {
    const users = [u({ role: "dec" }), u({ role: "consulta" }), u({ role: "dec" })];
    const out = filtrarUsuarios(users, { termino: "", rol: "dec", nombreOficina: sinOficina });
    expect(out.map((o) => o.index)).toEqual([0, 2]);
  });

  it("busca en el nombre completo (sin distinguir mayúsculas) y conserva el índice", () => {
    const users = [u({}), u({ nombreCompleto: "María Quispe" }), u({})];
    const out = filtrarUsuarios(users, { termino: "quispe", rol: "todos", nombreOficina: sinOficina });
    expect(out).toHaveLength(1);
    expect(out[0].index).toBe(1);
  });

  it("busca también por el nombre de la oficina (accesor)", () => {
    const users = [u({ id: "a" }), u({ id: "b" })];
    const nombreOficina = (x: UserSetting) => (x.id === "b" ? "Sub Gerencia de Obras" : null);
    const out = filtrarUsuarios(users, { termino: "obras", rol: "todos", nombreOficina });
    expect(out.map((o) => o.user.id)).toEqual(["b"]);
  });
});
