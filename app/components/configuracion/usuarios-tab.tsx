"use client";

import {
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crown,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
import { EmptyState } from "./empty-state";
import { useToastHelpers } from "@/lib/toast";
import {
  btnPrimary,
  btnSecondary as btnSec,
  btnSecondarySm as btnSecCompact,
  fieldLabel as formLabel,
  inputBase,
  inputSelect,
} from "./ui";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../confirm-dialog";
import {
  type CreatedCredential,
  type EntitySettings,
  type LinkedUser,
  type OficinaOption,
  type RoleOption,
  type RolePermission,
  type UserSetting,
} from "@/lib/configuracion-types";
import {
  getPasswordStrength, STRENGTH_COLORS, STRENGTH_LABELS,
} from "@/lib/password-strength";
import {
  etiquetaDeCuenta,
  normalizarUsuario,
  esUsuarioValido,
  USUARIO_LONGITUD,
} from "@/lib/usuario-credencial";
// Conteo por rol y filtrado de la lista: lógica pura, probada sin montar React.
import { contarUsuariosPorRol, filtrarUsuarios } from "@/lib/usuarios-lista";
import { ROLE_CAPABILITIES } from "@/lib/permisos-contratacion";

const PASSWORD_MINIMO = 8;

function generarPassword(): string {
  const alfabeto = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return `Ace-${[...bytes].map((b) => alfabeto[b % alfabeto.length]).join("")}`;
}

type Props = {
  entity: EntitySettings;
  users: UserSetting[];
  setUsers: React.Dispatch<React.SetStateAction<UserSetting[]>>;
  oficinas: OficinaOption[];
  roles: RoleOption[];
  rolePermissions: RolePermission[];
  createdCredentials: CreatedCredential[];
  linkedUsers: LinkedUser[];
  creatingUser: boolean;
  savingUserId: string | null;
  currentUserId: string;
  onCreateUser: (input: {
    usuario: string;
    entity: string;
    esJefe: boolean;
    oficinaId: string;
    password: string;
    role: string;
    nombreCompleto: string;
    dni: string;
    cargo: string;
    gradoAcademico: string;
  }) => Promise<void>;
  onSeedRoleUsers: () => void;
  onSaveUser: (user: UserSetting) => Promise<void>;
  onResetPassword: (user: UserSetting, password?: string) => Promise<void>;
  onDeleteUser: (user: UserSetting) => Promise<void>;
  onToggleActivo: (user: UserSetting) => Promise<void>;
  onReloadOficinas?: () => void | Promise<void>;
};

const ROLE_COLORS: Record<string, { avatar: string; badge: string; badgeBg: string; badgeBorder: string }> = {
  consulta: { avatar: "#7c8a99", badge: "#56636f", badgeBg: "#f1f4f7", badgeBorder: "#dfe5ea" },
  area_usuaria: { avatar: "#4f6f93", badge: "#41607f", badgeBg: "#eaf0f6", badgeBorder: "#d7e0eb" },
  dec: { avatar: "var(--brand)", badge: "var(--brand-dark)", badgeBg: "var(--soft)", badgeBorder: "#d3e6e2" },
  legal: { avatar: "#835a76", badge: "#6e4a63", badgeBg: "#f4edf1", badgeBorder: "#e7dae2" },
  admin: { avatar: "var(--accent)", badge: "#9a5a2c", badgeBg: "#f7eee3", badgeBorder: "#ecdcc8" },
};

const ROLE_BORDER_LEFT: Record<string, string> = {
  consulta: "#7c8a99",
  area_usuaria: "#4f6f93",
  dec: "var(--brand)",
  legal: "#835a76",
  admin: "var(--accent)",
};

export function UsuariosTab({
  entity,
  users,
  setUsers,
  oficinas,
  roles,
  rolePermissions,
  createdCredentials,
  linkedUsers,
  creatingUser,
  savingUserId,
  currentUserId,
  onCreateUser,
  onSeedRoleUsers,
  onSaveUser,
  onResetPassword,
  onDeleteUser,
  onToggleActivo,
  onReloadOficinas,
}: Props) {
  const { success: toastSuccess, error: toastError } = useToastHelpers();
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("todos");
  const [newUserUsuario, setNewUserUsuario] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserPassword2, setNewUserPassword2] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [newUserRole, setNewUserRole] = useState("consulta");
  const [newUserEntity, setNewUserEntity] = useState("");
  const [newUserOficinaId, setNewUserOficinaId] = useState("");
  const [newUserEsJefe, setNewUserEsJefe] = useState(false);
  const [newUserNombre, setNewUserNombre] = useState("");
  const [newUserCargo, setNewUserCargo] = useState("");
  const [newUserGrado, setNewUserGrado] = useState("");
  const [pendingDelete, setPendingDelete] = useState<UserSetting | null>(null);
  const [pendingReset, setPendingReset] = useState<UserSetting | null>(null);
  const [assignPassword, setAssignPassword] = useState("");
  const [assignPassword2, setAssignPassword2] = useState("");
  const [verAssignPassword, setVerAssignPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const editingUser = expandedId ? users.find(u => u.id === expandedId) ?? null : null;
  const editingIndex = editingUser ? users.findIndex(u => u.id === editingUser.id) : -1;
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  function openCreate() {
    void onReloadOficinas?.();
    setNewUserEntity(entity.name ?? "");
    setShowCreate(true);
  }

  async function copyText(key: string, text: string) {
    const flash = () => {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 2000);
    };
    try {
      await navigator.clipboard.writeText(text);
      flash();
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        flash();
      } catch {
        toastError("No se pudo copiar", "Copia manualmente el texto que se muestra en pantalla.");
      }
    }
  }

  function descargarCredenciales() {
    const text = createdCredentials.map(c => `Usuario: ${c.usuario}\nContraseña: ${c.password}\n`).join('\n---\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'credenciales.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  const visibleCredentials = createdCredentials.filter(c => !dismissedIds.has(`${c.usuario}-${c.role}`));

  const userRoleCounts = useMemo(() => contarUsuariosPorRol(roles, users), [roles, users]);
  const visibleUsers = useMemo(
    () => filtrarUsuarios(users, { termino: userSearch, rol: userRoleFilter, nombreOficina: oficinaNombre }),
    // `oficinaNombre` depende de `oficinas`, que sí está en las dependencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users, userSearch, userRoleFilter, oficinas],
  );

  const totalPages = Math.max(1, Math.ceil(visibleUsers.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages - 1);
  const pageUsers = visibleUsers.slice(pageClamped * PAGE_SIZE, pageClamped * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [userSearch, userRoleFilter]);

  // Limpia el campo al cambiar de usuario o cerrar el panel: sin esto, la
  // contraseña tecleada para uno se quedaba en el formulario del siguiente.
  useEffect(() => {
    setAssignPassword("");
    setAssignPassword2("");
    setVerAssignPassword(false);
  }, [expandedId]);

  const assignPasswordOk =
    assignPassword.length >= PASSWORD_MINIMO && assignPassword === assignPassword2;

  async function handleAssignPassword() {
    if (!editingUser || !assignPasswordOk) return;
    await onResetPassword(editingUser, assignPassword);
    setAssignPassword("");
    setAssignPassword2("");
    setVerAssignPassword(false);
  }

  function roleLabel(roleValue: string) {
    return roles.find((role) => role.value === roleValue)?.label ?? roleValue;
  }

  function userInitials(user: UserSetting) {
    const nombre = (user.nombreCompleto ?? "").trim();
    if (nombre) {
      const partes = nombre.split(/\s+/).filter(Boolean);
      return (partes.slice(0, 2).map((p) => p[0]).join("") || "?").toUpperCase();
    }
    const source = etiquetaDeCuenta(user.email).split("@")[0] ?? "";
    const parts = source.split(/[.\-_]+/).filter(Boolean);
    const initials = parts.slice(0, 2).map((part) => part[0]).join("");
    return (initials || source.slice(0, 2) || "?").toUpperCase();
  }

  function oficinaNombre(user: UserSetting) {
    return (
      oficinas.find((oficina) => oficina.id === user.oficinaId)?.nombre ||
      user.entity ||
      null
    );
  }

  function scopeLabel(user: UserSetting) {
    if (user.role === "admin") return "Ve todo el archivo";
    if (user.esJefe && oficinaNombre(user)) return "Ve todo lo de su oficina";
    return "Solo ve lo que sube";
  }

  function updateUser(index: number, patch: Partial<UserSetting>) {
    setUsers((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  const usuarioOk = esUsuarioValido(newUserUsuario);
  const passwordOk =
    newUserPassword.length >= PASSWORD_MINIMO && newUserPassword === newUserPassword2;
  const puedeCrear = usuarioOk && passwordOk;

  async function handleCreate() {
    if (!puedeCrear) return;
    await onCreateUser({
      usuario: newUserUsuario,
      entity: newUserEntity,
      esJefe: newUserEsJefe,
      oficinaId: newUserOficinaId,
      password: newUserPassword,
      role: newUserRole,
      nombreCompleto: newUserNombre,
      dni: newUserUsuario,
      cargo: newUserCargo,
      gradoAcademico: newUserGrado,
    });
    setNewUserUsuario("");
    setNewUserPassword("");
    setNewUserPassword2("");
    setVerPassword(false);
    setNewUserEntity("");
    setNewUserOficinaId("");
    setNewUserEsJefe(false);
    setNewUserRole("consulta");
    setNewUserNombre("");
    setNewUserCargo("");
    setNewUserGrado("");
    setShowCreate(false);
  }

  async function confirmDelete() {
    if (pendingDelete) {
      await onDeleteUser(pendingDelete);
    }
    setPendingDelete(null);
  }

  async function confirmReset() {
    const user = pendingReset;
    setPendingReset(null);
    if (user) {
      await onResetPassword(user);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="m-0 max-w-[60ch] text-sm leading-relaxed text-muted">
          Administra cuentas, perfil institucional y permisos efectivos por rol.
          Hay <strong>{users.length}</strong> usuario{users.length === 1 ? "" : "s"} registrado{users.length === 1 ? "" : "s"}.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className={btnSec}
            disabled={creatingUser}
            onClick={onSeedRoleUsers}
            type="button"
            title="Crea automáticamente un usuario de ejemplo por cada rol, con contraseñas temporales."
          >
            <Users size={16} /> Crear uno por rol
          </button>
          <button className={btnPrimary} onClick={openCreate} type="button">
            <UserPlus size={16} /> Nuevo usuario
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
        <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <ShieldCheck size={14} /> Perfiles configurados
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {userRoleCounts.map((role) => (
            <article
              data-role={role.value}
              key={role.value}
              className="grid gap-1.5 rounded-xl border border-[rgba(15,118,110,0.14)] bg-[linear-gradient(180deg,rgba(236,253,245,0.6),#ffffff)] p-3 border-l-[3px]"
              style={{ borderLeftColor: ROLE_BORDER_LEFT[role.value] ?? "var(--line)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm text-ink">{role.label}</strong>
                <span className="grid min-w-[25px] h-[25px] place-items-center rounded-full bg-white text-xs font-[950] text-brand-dark">
                  {role.count}
                </span>
              </div>
              <details className="group">
                <summary className="w-fit cursor-pointer list-none rounded-full bg-brand-soft px-1.5 py-1 text-xs font-[900] text-brand-dark hover:bg-brand-soft/70">
                  {role.value}
                </summary>
                <div className="mt-1 flex flex-wrap gap-1">
                  {ROLE_CAPABILITIES[role.value as keyof typeof ROLE_CAPABILITIES]?.map((cap) => (
                    <span key={cap} className="rounded-full bg-surface border border-line px-2 py-0.5 text-xs font-medium text-muted">
                      {cap.replace("expediente.", "").replace("necesidad.", "")}
                    </span>
                  ))}
                </div>
              </details>
              <span className="text-xs leading-snug text-muted">{role.description}</span>
            </article>
          ))}
        </div>
      </div>

      {visibleCredentials.length > 0 ? (
        <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <KeyRound size={14} /> Credenciales temporales creadas
          </div>
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2.5">
            <span className="m-0 text-sm text-muted">
              Cópialas y entrégalas al usuario ahora. Por seguridad, solo se muestran esta vez.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`${btnSecCompact} text-xs`}
                onClick={() => {
                  descargarCredenciales();
                  toastSuccess("Credenciales descargadas", `${visibleCredentials.length} credenciales en el .txt`);
                }}
              >
                Descargar .txt
              </button>
              <button
                type="button"
                className={`${btnSecCompact} text-xs`}
                onClick={() =>
                  copyText(
                    "__all__",
                    visibleCredentials
                      .map((c) => `${roleLabel(c.role)}: ${c.usuario} / ${c.password}`)
                      .join("\n"),
                  )
                }
              >
                {copiedKey === "__all__" ? <Check size={15} /> : <Copy size={15} />}
                {copiedKey === "__all__" ? "Copiado" : "Copiar todas"}
              </button>
            </div>
          </div>
          {visibleCredentials.map((credential) => {
            const key = `${credential.usuario}-${credential.role}`;
            const line = `${credential.usuario} / ${credential.password}`;
            return (
              <div className="col-span-full flex flex-wrap items-center gap-2" key={key}>
                <span
                  className="shrink-0 rounded-full border px-2 py-[3px] text-xs font-semibold"
                  style={{
                    borderColor: (ROLE_COLORS[credential.role] ?? ROLE_COLORS.consulta).badgeBorder,
                    background: (ROLE_COLORS[credential.role] ?? ROLE_COLORS.consulta).badgeBg,
                    color: (ROLE_COLORS[credential.role] ?? ROLE_COLORS.consulta).badge,
                  }}
                >
                  {roleLabel(credential.role)}
                </span>
                <code className="min-w-0 flex-1 text-base" style={{ flex: "1 1 220px" }}>{line}</code>
                <button
                  type="button"
                  className="shrink-0 inline-flex items-center gap-1.5 min-h-[32px] rounded-md border border-line bg-white px-2.5 text-xs font-medium text-[#243145] cursor-pointer transition-[background,border-color,color] duration-150 ease hover:border-[rgba(15,118,110,0.35)] hover:bg-brand-soft hover:text-brand-ink"
                  aria-label={`Copiar credenciales de ${credential.usuario}`}
                  title="Copiar usuario y contraseña"
                  onClick={() => copyText(key, line)}
                >
                  {copiedKey === key ? <Check size={15} /> : <Copy size={15} />}
                  {copiedKey === key ? "Copiado" : "Copiar"}
                </button>
                <button
                  type="button"
                  className="shrink-0 text-xs font-medium text-muted hover:text-ink cursor-pointer border-0 bg-transparent"
                  onClick={() => {
                    setDismissedIds((prev) => new Set(prev).add(key));
                    toastSuccess("Credencial entregada", `${roleLabel(credential.role)}: ${credential.usuario}`);
                  }}
                  title="Marcar como entregada"
                >
                  Ya la entregué
                </button>
                {(() => {
                  const level = getPasswordStrength(credential.password);
                  const widths: Record<string, string> = { 'weak': '25%', 'acceptable': '50%', 'strong': '75%', 'very-strong': '100%' };
                  return (
                    <div className="flex items-center gap-2 w-full mt-1">
                      <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${STRENGTH_COLORS[level]}`} style={{ width: widths[level] }} />
                      </div>
                      <span className="text-xs text-muted">{STRENGTH_LABELS[level]}</span>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      ) : null}
      {linkedUsers.length > 0 ? (
        <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <CheckCircle2 size={14} /> Usuarios existentes vinculados
          </div>
          <p className="m-0 mb-2 text-sm text-muted">
            Estas cuentas ya existían en Supabase Auth; se actualizó su perfil ACE, rol y permisos.
          </p>
          {linkedUsers.map((linked) => (
            <code key={`${linked.usuario}-${linked.userId}`} className="block text-sm">
              {roleLabel(linked.role)}: {linked.usuario}
            </code>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong className="text-sm">Usuarios registrados</strong>
            <span className="ml-1.5 text-xs text-muted">
              {visibleUsers.length} de {users.length}
            </span>
          </div>
        </div>

        <div
          className="mb-3.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-2.5 items-start rounded-xl border border-[#d3e6e2] bg-brand-soft p-3"
          role="note"
          aria-label="Modelo de acceso al archivo"
        >
          <ShieldCheck className="text-brand" size={17} aria-hidden />
          <div>
            <strong className="text-sm text-ink">Quién ve qué en el archivo de expedientes</strong>
            <div className="mt-1 flex flex-wrap gap-x-1 gap-y-4">
              <span className="text-xs leading-snug text-muted"><strong className="inline-flex items-center gap-1 font-[850] text-brand">Administrador</strong> ve y administra todo.</span>
              <span className="text-xs leading-snug text-muted"><strong className="inline-flex items-center gap-1 font-[850] text-brand"><Crown size={11} aria-hidden /> Jefe de oficina</strong> ve todo lo de su oficina.</span>
              <span className="text-xs leading-snug text-muted"><strong className="inline-flex items-center gap-1 font-[850] text-brand">Los demás</strong> solo ven y editan lo que ellos mismos suben.</span>
            </div>
          </div>
        </div>

        {users.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 pb-3">
            <label className="flex flex-1 min-w-[200px] items-center gap-2 rounded-lg border border-line bg-white px-3 text-muted focus-within:border-[rgba(15,118,110,0.45)] focus-within:shadow-[0_0_0_3px_rgba(15,118,110,0.1)]">
              <Search size={15} />
              <input
                className="w-full border-0 bg-transparent py-2.5 text-ink outline-none"
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Buscar por correo, nombre u oficina..."
                value={userSearch}
              />
            </label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por rol">
              <button
                aria-pressed={userRoleFilter === "todos"}
                onClick={() => setUserRoleFilter("todos")}
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1.5 text-xs font-[850] text-muted cursor-pointer transition-[border-color,color,background] duration-150 ease hover:border-[rgba(15,118,110,0.4)] hover:text-ink aria-pressed:border-transparent aria-pressed:bg-brand aria-pressed:text-white"
              >
                Todos
                <span className="rounded-full bg-ink/[0.06] px-1.5 py-[1px] text-xs font-[900]">{users.length}</span>
              </button>
              {userRoleCounts.map((role) => (
                <button
                  aria-pressed={userRoleFilter === role.value}
                  data-role={role.value}
                  key={role.value}
                  onClick={() => setUserRoleFilter(role.value)}
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1.5 text-xs font-[850] text-muted cursor-pointer transition-[border-color,color,background] duration-150 ease hover:border-[rgba(15,118,110,0.4)] hover:text-ink aria-pressed:border-transparent aria-pressed:bg-brand aria-pressed:text-white"
                >
                  {role.label}
                  <span className="rounded-full bg-ink/[0.06] px-1.5 py-[1px] text-xs font-[900]">{role.count}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aún no hay usuarios"
            description='Usa "Nuevo usuario" para crear el primero, o "Crear uno por rol" para generar un usuario de ejemplo por cada perfil.'
            action={{ label: "Nuevo usuario", onClick: openCreate }}
          />
        ) : visibleUsers.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Sin resultados"
            description="Ningún usuario coincide con la búsqueda o el filtro."
            action={{
              label: "Limpiar filtros",
              onClick: () => {
                setUserSearch("");
                setUserRoleFilter("todos");
              },
            }}
          />
        ) : (
          <>
          <div className="flex flex-col gap-2">
            {pageUsers.map(({ user }) => {
              const roleColor = ROLE_COLORS[user.role] ?? ROLE_COLORS.consulta;
              return (
                <div className="overflow-hidden rounded-lg border border-line bg-white" key={user.id}>
                  <button
                    className="flex w-full items-center gap-3 border-0 bg-transparent px-3.5 py-2.5 text-left font-inherit cursor-pointer hover:bg-[#f8fafc]"
                    type="button"
                    onClick={() => setExpandedId(user.id)}
                  >
                    <span
                      className="grid w-[38px] h-[38px] shrink-0 place-items-center rounded-lg text-white text-sm font-[900] tracking-wide"
                      data-role={user.role}
                      aria-hidden
                      style={{ background: roleColor.avatar }}
                    >
                      {userInitials(user)}
                    </span>
                    <div className="grid min-w-0 gap-1">
                      <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-ink">
                        {user.nombreCompleto?.trim() || etiquetaDeCuenta(user.email) || "Usuario sin identificar"}
                      </strong>
                      {user.nombreCompleto?.trim() && etiquetaDeCuenta(user.email) ? (
                        <small className="mt-0.5 block font-mono text-xs text-muted" title="Usuario con el que inicia sesión">
                          {etiquetaDeCuenta(user.email)}
                        </small>
                      ) : null}
                      <div className="mt-0.5 flex flex-wrap items-center gap-1" aria-label="Rol y alcance">
                        {(user.activo ?? true) ? null : (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border border-danger/25 bg-danger-soft px-2 py-1 text-xs font-[850] leading-none text-danger"
                            title="No puede iniciar sesión"
                          >
                            <UserX size={11} aria-hidden />
                            Inactivo
                          </span>
                        )}
                        <span
                          className="w-fit rounded-full border px-2.5 py-[3px] text-xs font-[850] tracking-wide"
                          data-role={user.role}
                          style={{
                            borderColor: roleColor.badgeBorder,
                            background: roleColor.badgeBg,
                            color: roleColor.badge,
                          }}
                        >
                          {roleLabel(user.role)}
                        </span>
                        {oficinaNombre(user) ? (
                          <small className="inline-flex items-center gap-1 rounded-full border border-brand/15 bg-brand-soft px-2 py-1 text-xs font-[850] leading-none text-brand" title="Oficina asignada">
                            <Building2 size={11} aria-hidden />
                            {oficinaNombre(user)}
                          </small>
                        ) : (
                          <small
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-[850] leading-none"
                            style={{
                              borderColor: ROLE_COLORS.consulta.badgeBorder,
                              background: ROLE_COLORS.consulta.badgeBg,
                              color: ROLE_COLORS.consulta.badge,
                            }}
                          >
                            Sin oficina
                          </small>
                        )}
                        {user.esJefe ? (
                          <small
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-[850] leading-none"
                            style={{
                              borderColor: ROLE_COLORS.admin.badgeBorder,
                              background: ROLE_COLORS.admin.badgeBg,
                              color: ROLE_COLORS.admin.badge,
                            }}
                            title="Ve y administra todo lo de su oficina"
                          >
                            <Crown size={11} aria-hidden />
                            Jefe
                          </small>
                        ) : null}
                      </div>
                      <span className="mt-0.5 text-xs text-muted">{scopeLabel(user)}</span>
                    </div>
                    <ChevronRight size={18} className="ml-auto shrink-0 text-muted" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
          {totalPages > 1 ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 border-t border-line pt-3">
              <button
                className={`${btnSecCompact} text-xs`}
                type="button"
                disabled={pageClamped === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft size={15} /> Anterior
              </button>
              <span className="flex flex-col items-center gap-px text-sm font-semibold text-ink">
                Página {pageClamped + 1} de {totalPages}
                <small className="text-xs font-normal text-muted">
                  {pageClamped * PAGE_SIZE + 1}–{Math.min(visibleUsers.length, (pageClamped + 1) * PAGE_SIZE)} de {visibleUsers.length}
                </small>
              </span>
              <button
                className={`${btnSecCompact} text-xs`}
                type="button"
                disabled={pageClamped >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Siguiente <ChevronRight size={15} />
              </button>
            </div>
          ) : null}
          </>
        )}
      </div>

      <details className="rounded-xl border border-line bg-panel p-5 shadow-card [&>summary]:flex [&>summary]:items-center [&>summary]:gap-2 [&>summary]:cursor-pointer [&>summary]:text-xs [&>summary]:font-semibold [&>summary]:uppercase [&>summary]:tracking-wide [&>summary]:text-slate-600 [&>summary]:list-none">
        <summary>
          <ShieldCheck size={14} /> Ver matriz de permisos por rol
        </summary>
        <div className="mt-3 overflow-auto rounded-xl border border-line bg-white" role="table" aria-label="Matriz de permisos">
          <div className="grid sticky top-0 z-[1] min-w-[850px] grid-cols-[minmax(220px,1.4fr)_repeat(5,minmax(105px,0.7fr))] border-b border-line bg-brand-soft text-xs font-[950] uppercase text-brand-dark" role="row">
            <span className="grid content-center min-h-[54px] border-r border-line px-3 py-2.5">Módulo</span>
            {roles.map((role) => (
              <span key={role.value} className="grid content-center min-h-[54px] border-r border-line px-3 py-2.5 last:border-r-0">
                {role.label}
              </span>
            ))}
          </div>
          {rolePermissions.map((item, index) => (
            <div
              className={`grid min-w-[850px] grid-cols-[minmax(220px,1.4fr)_repeat(5,minmax(105px,0.7fr))] border-b border-line last:border-b-0 ${index % 2 === 0 ? "bg-white" : "bg-surface"}`}
              key={item.area}
              role="row"
            >
              <div className="grid content-center min-h-[54px] border-r border-line px-3 py-2.5">
                <strong className="text-sm text-ink">{item.area}</strong>
                <small className="mt-0.5 text-xs leading-snug text-muted">{item.scope}</small>
              </div>
              {roles.map((role) => {
                const permite = item.permissions[role.value];
                return (
                  <span
                    className={`grid content-center justify-items-center min-h-[54px] border-r border-line px-3 py-2.5 last:border-r-0 ${permite ? "text-emerald-700" : "text-red-700"}`}
                    key={role.value}
                    title={permite ? `Permite ${role.label}` : `No permite ${role.label}`}
                  >
                    {permite ? <Check size={15} aria-hidden /> : <X size={15} aria-hidden />}
                    <span className="sr-only">{permite ? "Permite" : "No permite"}</span>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </details>

      <Dialog.Root open={showCreate} onOpenChange={setShowCreate}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[1100] grid place-items-center bg-[rgba(23,32,51,0.55)] p-4" />
          <Dialog.Content
            aria-label="Crear o vincular usuario"
            className="fixed top-1/2 left-1/2 z-[1101] w-[calc(100%-32px)] max-w-[560px] max-h-[90vh] overflow-auto rounded-xl border border-line bg-panel text-ink shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
            onInteractOutside={(e) => e.preventDefault()}
          >
            <div className="sticky top-0 z-[1] flex items-center justify-between gap-3 border-b border-line bg-panel px-5 py-3">
              <Dialog.Title asChild>
                <strong className="inline-flex items-center gap-2 text-md font-[650]">
                  <UserPlus size={18} /> Crear o vincular usuario
                </strong>
              </Dialog.Title>
              <button
                aria-label="Cerrar"
                className="grid place-items-center w-[30px] h-[30px] rounded-md border border-transparent bg-transparent text-muted cursor-pointer hover:bg-surface hover:border-line hover:text-ink"
                onClick={() => setShowCreate(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              <p className="m-0 mb-3.5 text-sm text-muted">
                El usuario es el <strong>DNI</strong>: con ese número y su contraseña entra a ACE.
                Si ya existe, ACE actualiza su perfil y permisos. Los datos personales identifican al
                firmante en los documentos oficiales (designación de evaluadores, membretes, actas).
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={`${formLabel} col-span-full`}>
                  <span className="text-sm font-semibold text-slate-700">Usuario <span className="text-xs font-normal text-muted">obligatorio</span></span>
                  <input
                    className={inputBase}
                    autoComplete="off"
                    inputMode="numeric"
                    maxLength={USUARIO_LONGITUD}
                    onChange={(event) => setNewUserUsuario(normalizarUsuario(event.target.value))}
                    placeholder={`${USUARIO_LONGITUD} dígitos — es el DNI`}
                    value={newUserUsuario}
                  />
                  {newUserUsuario && !usuarioOk ? (
                    <small role="alert" className="mt-1 block text-xs leading-snug text-warning">
                      Faltan {USUARIO_LONGITUD - newUserUsuario.length} de {USUARIO_LONGITUD} dígitos.
                    </small>
                  ) : null}
                </label>
                <label className={`${formLabel} col-span-full`}>
                  <span className="text-sm font-semibold text-slate-700">Nombre completo</span>
                  <input
                    className={inputBase}
                    onChange={(event) => setNewUserNombre(event.target.value)}
                    placeholder="Nombres y apellidos"
                    value={newUserNombre}
                  />
                </label>
                <label className={formLabel}>
                  <span className="text-sm font-semibold text-slate-700">Cargo</span>
                  <input
                    className={inputBase}
                    onChange={(event) => setNewUserCargo(event.target.value)}
                    placeholder="p. ej. Especialista en contrataciones"
                    value={newUserCargo}
                  />
                </label>
                <label className={`${formLabel} col-span-full`}>
                  <span className="text-sm font-semibold text-slate-700">Grado académico</span>
                  <input
                    className={inputBase}
                    onChange={(event) => setNewUserGrado(event.target.value)}
                    placeholder="p. ej. Abogado, Ingeniero, Bachiller"
                    value={newUserGrado}
                  />
                </label>
                <label className={formLabel}>
                  <span className="text-sm font-semibold text-slate-700">Perfil</span>
                  <select className={inputSelect} onChange={(event) => setNewUserRole(event.target.value)} value={newUserRole}>
                    {roles.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={formLabel}>
                  <span className="text-sm font-semibold text-slate-700">Oficina asignada</span>
                  <select
                    className={inputSelect}
                    onChange={(event) => setNewUserOficinaId(event.target.value)}
                    value={newUserOficinaId}
                  >
                    <option value="">— Sin oficina —</option>
                    {oficinas.map((oficina) => (
                      <option key={oficina.id} value={oficina.id}>
                        {oficina.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={formLabel}>
                  <span className="text-sm font-semibold text-slate-700">Contraseña <span className="text-xs font-normal text-muted">obligatorio</span></span>
                  <input
                    className={inputBase}
                    autoComplete="new-password"
                    minLength={PASSWORD_MINIMO}
                    onChange={(event) => setNewUserPassword(event.target.value)}
                    placeholder={`Mínimo ${PASSWORD_MINIMO} caracteres`}
                    type={verPassword ? "text" : "password"}
                    value={newUserPassword}
                  />
                  {newUserPassword && newUserPassword.length < PASSWORD_MINIMO ? (
                    <small className="mt-1 block text-xs leading-snug text-warning">
                      Muy corta: mínimo {PASSWORD_MINIMO} caracteres.
                    </small>
                  ) : null}
                </label>
                <label className={formLabel}>
                  <span className="text-sm font-semibold text-slate-700">Repetir contraseña</span>
                  <input
                    className={inputBase}
                    autoComplete="new-password"
                    onChange={(event) => setNewUserPassword2(event.target.value)}
                    placeholder="La misma otra vez"
                    type={verPassword ? "text" : "password"}
                    value={newUserPassword2}
                  />
                  {newUserPassword2 && newUserPassword !== newUserPassword2 ? (
                    <small className="mt-1 block text-xs leading-snug text-warning">No coinciden.</small>
                  ) : null}
                </label>
                <label className="col-span-full flex flex-row items-center gap-2 flex-wrap">
                  <button
                    className={`${btnSecCompact} text-xs`}
                    onClick={() => setVerPassword((v) => !v)}
                    type="button"
                  >
                    {verPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    {verPassword ? "Ocultar" : "Ver"}
                  </button>
                  <button
                    className={`${btnSecCompact} text-xs`}
                    onClick={() => {
                      const generada = generarPassword();
                      setNewUserPassword(generada);
                      setNewUserPassword2(generada);
                      setVerPassword(true);
                    }}
                    type="button"
                  >
                    <KeyRound size={14} /> Generar una
                  </button>
                </label>
                {!newUserOficinaId ? (
                  <label className={formLabel}>
                    <span className="text-sm font-semibold text-slate-700">Entidad o unidad</span>
                    <input
                      className={inputBase}
                      onChange={(event) => setNewUserEntity(event.target.value)}
                      placeholder={entity.name || "Entidad asociada"}
                      value={newUserEntity}
                    />
                  </label>
                ) : null}
                <label className="col-span-full flex flex-row items-center gap-2">
                  <input
                    className="size-4 accent-brand"
                    checked={newUserEsJefe}
                    onChange={(event) => setNewUserEsJefe(event.target.checked)}
                    type="checkbox"
                  />
                  <span className="font-medium text-ink">
                    <Crown size={13} className="inline -translate-y-px" aria-hidden /> Jefe de oficina — ve y
                    administra todo lo de su oficina.
                  </span>
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-line bg-panel px-5 py-3.5">
              <button className={btnSec} onClick={() => setShowCreate(false)} type="button">
                Cancelar
              </button>
              <button
                className={btnPrimary}
                disabled={creatingUser || !puedeCrear}
                onClick={handleCreate}
                title={puedeCrear ? undefined : "Completa el usuario (8 dígitos) y la contraseña"}
                type="button"
              >
                <Plus size={16} />
                {creatingUser ? "Procesando..." : "Crear / vincular"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Eliminar usuario"
        message={
          pendingDelete
            ? `Eliminar usuario ${pendingDelete.nombreCompleto?.trim() || etiquetaDeCuenta(pendingDelete.email) || pendingDelete.id}? Esta accion quita el acceso y no se puede deshacer.`
            : ""
        }
        tone="danger"
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={pendingReset !== null}
        title="Restablecer contraseña"
        message={
          pendingReset
            ? `Se generará una contraseña temporal para ${pendingReset.nombreCompleto?.trim() || etiquetaDeCuenta(pendingReset.email) || pendingReset.id}. La contraseña actual dejará de funcionar y la nueva se muestra una sola vez: cópiala y entrégasela.`
            : ""
        }
        tone="warning"
        confirmLabel="Restablecer"
        onConfirm={confirmReset}
        onCancel={() => setPendingReset(null)}
      />

      {editingUser && (
        // `open` es OBLIGATORIO: sin él, Radix Dialog.Root arranca cerrado y el
        // panel de edición no aparecía al pulsar un usuario. Como el Root solo se
        // monta cuando hay `editingUser`, va siempre abierto; al cerrarlo (X, Esc u
        // overlay) `onOpenChange(false)` limpia `expandedId` y esto se desmonta.
        <Dialog.Root open onOpenChange={(open) => { if (!open) setExpandedId(null); }}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
            <Dialog.Content className="fixed top-0 right-0 z-50 h-full w-full max-w-md overflow-y-auto bg-panel p-6 shadow-xl border-l border-line">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title asChild>
                <h3 className="text-base font-semibold text-ink">Editar usuario</h3>
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  aria-label="Cerrar"
                  className="grid place-items-center w-[30px] h-[30px] rounded-md border border-transparent bg-transparent text-muted cursor-pointer hover:bg-surface hover:border-line hover:text-ink"
                  type="button"
                >
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={`${formLabel} col-span-full`}>
                <span className="text-sm font-semibold text-slate-700">Nombre completo</span>
                <input
                  className={inputBase}
                  onChange={(event) => updateUser(editingIndex, { nombreCompleto: event.target.value })}
                  placeholder="Nombres y apellidos"
                  value={editingUser.nombreCompleto ?? ""}
                />
              </label>
              <label className={formLabel}>
                <span className="text-sm font-semibold text-slate-700">DNI</span>
                <input
                  className={inputBase}
                  inputMode="numeric"
                  onChange={(event) => updateUser(editingIndex, { dni: event.target.value })}
                  placeholder="Documento de identidad"
                  value={editingUser.dni ?? ""}
                />
              </label>
              <label className={formLabel}>
                <span className="text-sm font-semibold text-slate-700">Cargo</span>
                <input
                  className={inputBase}
                  onChange={(event) => updateUser(editingIndex, { cargo: event.target.value })}
                  placeholder="p. ej. Especialista en contrataciones"
                  value={editingUser.cargo ?? ""}
                />
              </label>
              <label className={`${formLabel} col-span-full`}>
                <span className="text-sm font-semibold text-slate-700">Grado académico</span>
                <input
                  className={inputBase}
                  onChange={(event) => updateUser(editingIndex, { gradoAcademico: event.target.value })}
                  placeholder="p. ej. Abogado, Ingeniero, Bachiller"
                  value={editingUser.gradoAcademico ?? ""}
                />
              </label>
              <label className={formLabel}>
                <span className="text-sm font-semibold text-slate-700">Rol</span>
                <select
                  className={inputSelect}
                  onChange={(event) => updateUser(editingIndex, { role: event.target.value })}
                  value={editingUser.role}
                >
                  {roles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={formLabel}>
                <span className="text-sm font-semibold text-slate-700">Oficina</span>
                <select
                  className={inputSelect}
                  onChange={(event) => updateUser(editingIndex, { oficinaId: event.target.value || null })}
                  value={editingUser.oficinaId ?? ""}
                >
                  <option value="">— Sin oficina —</option>
                  {oficinas.map((oficina) => (
                    <option key={oficina.id} value={oficina.id}>
                      {oficina.nombre}
                    </option>
                  ))}
                </select>
              </label>
              {!editingUser.oficinaId ? (
                <label className={formLabel}>
                  <span className="text-sm font-semibold text-slate-700">Entidad asociada</span>
                  <input
                    className={inputBase}
                    onChange={(event) => updateUser(editingIndex, { entity: event.target.value })}
                    placeholder={entity.name || "Entidad o unidad"}
                    value={editingUser.entity}
                  />
                </label>
              ) : null}
              <label
                className="flex flex-row items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 cursor-pointer select-none transition-[border-color,background] duration-150 ease hover:border-[rgba(15,118,110,0.35)] has-[input:checked]:border-[rgba(15,118,110,0.45)] has-[input:checked]:bg-[#f0fdfa] self-end col-span-full"
                title="Jefe de oficina: ve y administra todo lo de su oficina"
              >
                <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                  <Crown size={12} aria-hidden /> Jefe de oficina
                </span>
                <label className="relative inline-flex items-center gap-2 text-sm text-muted cursor-pointer">
                  <input
                    className="peer sr-only"
                    checked={Boolean(editingUser.esJefe)}
                    onChange={(event) => updateUser(editingIndex, { esJefe: event.target.checked })}
                    type="checkbox"
                  />
                  <div className="h-5 w-[34px] rounded-full bg-[#d5dedb] transition-colors duration-150 peer-checked:bg-brand after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-[0_1px_3px_rgba(15,23,42,0.3)] after:transition-all after:duration-150 peer-checked:after:left-[16px]" />
                  Ve y administra todo lo de su oficina
                </label>
              </label>
            </div>
            <div className="mt-4 grid gap-2 rounded-lg border border-line bg-white p-3 pt-2.5">
              <span className="text-sm font-semibold text-slate-700">Asignar contraseña específica</span>
              <p className="m-0 text-xs leading-snug text-muted">
                Para cuando la temporal aleatoria no sirve — p. ej. hay que dictarla por
                teléfono. La contraseña actual del usuario deja de funcionar de inmediato.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  autoComplete="new-password"
                  className={inputBase}
                  minLength={PASSWORD_MINIMO}
                  onChange={(event) => setAssignPassword(event.target.value)}
                  placeholder={`Mínimo ${PASSWORD_MINIMO} caracteres`}
                  type={verAssignPassword ? "text" : "password"}
                  value={assignPassword}
                />
                <input
                  autoComplete="new-password"
                  className={inputBase}
                  onChange={(event) => setAssignPassword2(event.target.value)}
                  placeholder="Repetir contraseña"
                  type={verAssignPassword ? "text" : "password"}
                  value={assignPassword2}
                />
              </div>
              {assignPassword && assignPassword.length < PASSWORD_MINIMO ? (
                <small className="text-xs leading-snug text-warning">
                  Muy corta: mínimo {PASSWORD_MINIMO} caracteres.
                </small>
              ) : null}
              {assignPassword2 && assignPassword !== assignPassword2 ? (
                <small className="text-xs leading-snug text-warning">No coinciden.</small>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className={`${btnSecCompact} text-xs`}
                  onClick={() => setVerAssignPassword((v) => !v)}
                  type="button"
                >
                  {verAssignPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  {verAssignPassword ? "Ocultar" : "Ver"}
                </button>
                <button
                  className={`${btnSecCompact} text-xs`}
                  onClick={() => {
                    const generada = generarPassword();
                    setAssignPassword(generada);
                    setAssignPassword2(generada);
                    setVerAssignPassword(true);
                  }}
                  type="button"
                >
                  <KeyRound size={14} /> Generar una
                </button>
                <button
                  className={`${btnSec} ml-auto`}
                  disabled={savingUserId === editingUser.id || !assignPasswordOk}
                  onClick={handleAssignPassword}
                  title={assignPasswordOk ? undefined : `Escribe la misma contraseña dos veces (mínimo ${PASSWORD_MINIMO} caracteres)`}
                  type="button"
                >
                  <KeyRound size={15} />
                  {savingUserId === editingUser.id ? "Asignando..." : "Asignar contraseña"}
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2.5 pt-4 border-t border-line">
              <button
                className={btnPrimary}
                disabled={savingUserId === editingUser.id}
                onClick={() => onSaveUser(editingUser)}
                type="button"
              >
                <Save size={15} />
                {savingUserId === editingUser.id ? "Guardando..." : "Guardar"}
              </button>
              <button
                className={btnSec}
                disabled={savingUserId === editingUser.id}
                onClick={() => setPendingReset(editingUser)}
                type="button"
                title="Genera una contraseña temporal aleatoria para este usuario"
              >
                <KeyRound size={15} /> Restablecer contraseña
              </button>
              <button
                className={btnSec}
                disabled={savingUserId === editingUser.id || (editingUser.id === currentUserId && (editingUser.activo ?? true))}
                onClick={() => void onToggleActivo(editingUser)}
                type="button"
                title={
                  editingUser.id === currentUserId && (editingUser.activo ?? true)
                    ? "No puedes inactivar tu propia cuenta"
                    : (editingUser.activo ?? true)
                      ? "Revoca el acceso sin borrar la ficha del usuario"
                      : "Restaura el acceso de este usuario"
                }
              >
                {(editingUser.activo ?? true) ? (
                  <>
                    <UserX size={15} /> Inactivar
                  </>
                ) : (
                  <>
                    <UserCheck size={15} /> Activar
                  </>
                )}
              </button>
              <button
                className={btnSec}
                disabled={savingUserId === editingUser.id || editingUser.id === currentUserId}
                onClick={() => setPendingDelete(editingUser)}
                type="button"
                title={editingUser.id === currentUserId ? "No puedes eliminar tu propia cuenta" : "Eliminar usuario"}
              >
                <Trash2 size={15} /> Eliminar
              </button>
            </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
