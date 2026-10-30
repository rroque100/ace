import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { inicioExterno } from "@/lib/modulos-acceso";
import { usuarioDeCorreo } from "@/lib/usuario-credencial";
import { AuthLayout } from "@/app/components/auth/auth-ui";
import { CambiarPasswordForm } from "@/app/components/auth/cambiar-password-form";

export const dynamic = "force-dynamic";

// El primer ingreso de una cuenta externa: la contraseña que le dio el administrador es temporal y la conoce él. Hasta que
// la persona elija la suya, el proxy no la deja abrir nada más (ver decidirAccesoExterno en lib/modulos-acceso.ts).
export default async function CambiarPasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Fcambiar-password");
  // Esta pantalla es solo para cuentas externas; el personal de la entidad tiene su propia gestión de contraseñas.
  if (!user.esExterno) redirect("/");
  // Vencida o sin módulos: la pantalla de entrada se lo explica; aquí no hay nada que hacer.
  if (user.externoVencido || user.modulosExternos.length === 0) redirect("/login");
  if (!user.debeCambiarPassword) redirect(inicioExterno(user.modulosExternos));

  return (
    <AuthLayout>
      <CambiarPasswordForm usuario={usuarioDeCorreo(user.email)} destino={inicioExterno(user.modulosExternos)} />
    </AuthLayout>
  );
}
