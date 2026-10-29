import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/app/components/login-form";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; acceso?: string }>;
};

const AVISOS: Record<string, string> = {
  vencido: "Tu acceso a ACE ha vencido. Contacta con el administrador para renovarlo.",
  sin_modulos: "Tu cuenta aún no tiene ningún módulo habilitado. Contacta con el administrador.",
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
    <main className="authShell">
      <section className="authCard">
        <div className="authBrand">
          <div className="brandMark">A</div>
          <div>
            <strong>ACE IA Juridica</strong>
            <span>Contrataciones publicas - Peru</span>
          </div>
        </div>
        <p className="authLead">
          Accede para consultar el corpus normativo y tu historial privado de consultas.
        </p>
        {aviso ? <p className="authError" role="alert">{aviso}</p> : null}
        {sinAcceso ? (
          <form action="/auth/signout" method="post">
            <button className="secondaryButton" type="submit">Cerrar sesión</button>
          </form>
        ) : (
          <LoginForm next={target} />
        )}
      </section>
    </main>
  );
}
