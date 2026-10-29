import { type NextFetchEvent, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  // `waitUntil` deja que el registro de auditoría termine después de responder, sin añadir espera a la persona.
  return updateSession(request, (trabajo) => event.waitUntil(trabajo));
}

export const config = {
  matcher: [
    // Todas las rutas salvo assets estaticos de Next, archivos de imagen y favicon dinamico.
    "/((?!_next/static|_next/image|favicon.ico|icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
