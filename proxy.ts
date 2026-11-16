import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { rutaCanonicaCursos } from "@/lib/cursos/ruta-canonica";

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  // «/Cursos» → «/cursos» antes de tocar la sesión (ver lib/cursos/ruta-canonica.ts para por qué no va en next.config).
  const canonica = rutaCanonicaCursos(request.nextUrl.pathname);
  if (canonica) {
    const destino = request.nextUrl.clone();
    destino.pathname = canonica;
    return NextResponse.redirect(destino, 308);
  }
  // `waitUntil` deja que el registro de auditoría termine después de responder, sin añadir espera a la persona.
  return updateSession(request, (trabajo) => event.waitUntil(trabajo));
}

export const config = {
  matcher: [
    // Todas las rutas salvo assets estaticos de Next, archivos de imagen y favicon dinamico.
    "/((?!_next/static|_next/image|favicon.ico|icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
