import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthLayout } from "@/app/components/auth/auth-ui";
import { SolicitudAccesoForm } from "@/app/components/auth/solicitud-acceso-form";

export const dynamic = "force-dynamic";

// Pública: la persona todavía no tiene cuenta. Solo deja una solicitud pendiente; no crea ninguna cuenta ni concede nada.
// Quien ya tiene sesión no la necesita (y una cuenta externa ni siquiera puede abrir esta ruta: el proxy la devuelve a su módulo).
export default async function AccesoPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <AuthLayout ancho="max-w-[560px]">
      <SolicitudAccesoForm />
    </AuthLayout>
  );
}
