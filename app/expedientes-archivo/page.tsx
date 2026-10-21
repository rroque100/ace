import { AppShell } from "../components/app-shell";
import { ExpedientesArchivoWorkspace } from "../components/expedientes-archivo-workspace";
import { getSessionUser } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-server";

// Nombre de la OFICINA del usuario (ej. "Unidad de Abastecimiento"), no el de
// la entidad/municipalidad entera (`user.entity`): el wizard de Subir precarga
// el campo "Oficina" con esto. Mismo helper que ya usa app-shell.tsx para el
// nombre que se ve en el sidebar (duplicado a propósito: es un componente
// server distinto y la función es trivial, no amerita una lib compartida
// todavía). Si no hay oficina resuelta (perfil sin oficina_id, o la fila no
// existe), cae a `entity` para no dejar el campo en blanco.
async function getOfficeName(oficinaId: string | null | undefined): Promise<string | null> {
  if (!oficinaId) return null;
  try {
    const rows = await supabaseRest<Array<{ nombre: string }>>(
      `expedientes_oficinas?id=eq.${oficinaId}&select=nombre&limit=1`,
    );
    return rows[0]?.nombre ?? null;
  } catch {
    return null;
  }
}

export default async function ExpedientesArchivoPage() {
  const user = await getSessionUser();
  // A diferencia de /archivo y /documentos (que usan isEditor = dec/admin tal
  // cual), aqui el area usuaria tambien administra: sube y responde sus
  // propios expedientes archivados, no solo busca.
  const canManage = Boolean(user?.isEditor || user?.role === "area_usuaria");
  const isAdmin = Boolean(user?.isAdmin);
  const userOficina = user ? ((await getOfficeName(user.oficinaId)) ?? user.entity ?? null) : null;

  return (
    <AppShell
      active="expedientes-archivo"
      eyebrow="Biblioteca de expedientes"
      title="Expedientes archivados"
    >
      <section className="singleWorkspace">
        <ExpedientesArchivoWorkspace canManage={canManage} isAdmin={isAdmin} userOficina={userOficina} />
      </section>
    </AppShell>
  );
}
