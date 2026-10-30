import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/app/components/login-form";
import { AuthAlert, AuthLayout, authBotonSecundario, authTitulo } from "@/app/components/auth/auth-ui";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; acceso?: string }>;
};

const AVISOS: Record<string, { titulo: string; texto: string }> = {
  vencido: { titulo: "Tu acceso ha vencido", texto: "Contacta con el administrador para renovarlo." },
  sin_modulos: { titulo: "Tu cuenta aún no tiene módulos habilitados", texto: "Contacta con el administrador para que te asigne el acceso." },
};

function safeNext(value?: string) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, acceso } = await searchParams;
  const target = safeNext(next);
  const user = await getSessionUser();
  // Una cuenta externa vencida o sin módulos NO se redirige: el proxy la devolvería aquí y daría vueltas sin fin.
  // Se le explica y se le deja cerrar la sesión.
  const sinAcceso = Boolean(user?.esExterno && (user.externoVencido || user.modulosExternos.length === 0));
  const aviso = sinAcceso ? AVISOS[user?.externoVencido ? "vencido" : "sin_modulos"] : (acceso ? AVISOS[acceso] : undefined);

  if (user && !sinAcceso) {
    redirect(target);
  }

  return (
    <AuthLayout>
      <h1 className={authTitulo}>Ingresa a ACE</h1>
      <p className="mb-6 text-md text-muted">
        {sinAcceso ? "Tu sesión está iniciada, pero esta cuenta no puede usar ACE por ahora." : "Entra con tu DNI y tu contraseña."}
      </p>
      {aviso ? (
        <div className="mb-5">
          <AuthAlert tono="aviso" titulo={aviso.titulo}>{aviso.texto}</AuthAlert>
        </div>
      ) : null}
      {sinAcceso ? (
        <form action="/auth/signout" method="post">
          <button className={authBotonSecundario} type="submit">Cerrar sesión</button>
        </form>
      ) : (
        <LoginForm next={target} />
      )}
    </AuthLayout>
  );
}
