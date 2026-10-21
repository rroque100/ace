/**
 * Precalcula los campos que exige cada PDF-modelo de requerimiento.
 *
 * POR QUE. La lista se deriva con la IA leyendo el modelo completo, y hoy se
 * calcula BAJO DEMANDA: la primera persona que abre una necesidad de ese
 * procedimiento paga la espera, y si la IA no responde en ese momento se queda
 * sin la lista y la ficha cae al criterio generico por objeto —sin avisar—.
 *
 * De los quince modelos cargados, solo dos tenian la lista calculada. Las cuatro
 * necesidades de Subasta Inversa y Concurso Publico abreviado nunca la vieron.
 *
 * La clave de cache lleva una HUELLA del catalogo de campos, asi que anadir o
 * renombrar un campo invalida lo guardado y hay que volver a pasar esto. Es a
 * proposito: una lista derivada de un catalogo viejo es peor que no tenerla.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/precalcular-campos-exigidos.mts
 *   npx tsx --env-file=.env.local scripts/precalcular-campos-exigidos.mts --aplicar
 */
import { camposExigidosDelModelo } from "@/lib/necesidad-copiloto";
import { PROCESOS_SELECCION } from "@/lib/procesos-seleccion";
import { supabaseRest } from "@/lib/supabase-server";
import { catalogoCampos } from "@/lib/necesidad-ficha-secciones";

const APLICAR = process.argv.includes("--aplicar");
/**
 * Recalcula aunque ya haya lista guardada.
 *
 * La clave de cache solo detecta que cambio el CATALOGO de campos, no que la
 * respuesta de la IA fuera mala. Y las hay: una entrada de este mismo corpus
 * dejaba fuera «subcontratacion» aunque el modelo trae ese apartado y el
 * catalogo el campo. Sin esta bandera, una lista equivocada se queda para
 * siempre.
 */
const FORZAR = process.argv.includes("--forzar");

type Doc = { id: string; file_name: string; metadata: Record<string, unknown> | null };

const modelos = await supabaseRest<Doc[]>(
  "documents?file_name=ilike.*REQUERIM*&select=id,file_name,metadata&order=file_name",
);

console.log(`${modelos.length} modelos cargados · ${APLICAR ? "MODO REAL" : "SIMULACION"}\n`);

let pendientes = 0;
let calculados = 0;
let fallidos = 0;

for (const doc of modelos) {
  const proceso = String((doc.metadata as { procesoSeleccion?: unknown })?.procesoSeleccion ?? "").trim();
  if (!proceso) {
    console.log(`  ${doc.file_name.slice(0, 52).padEnd(54)} SIN PROCESO VINCULADO, se omite`);
    continue;
  }
  const entrada = PROCESOS_SELECCION.find((p) => p.value === proceso);
  if (!entrada) {
    console.log(`  ${doc.file_name.slice(0, 52).padEnd(54)} proceso desconocido: «${proceso}»`);
    continue;
  }

  // Un modelo que declara su objeto solo sirve para ese; el que no lo declara
  // vale para todos los del procedimiento (Subasta Inversa, Comparacion de
  // Precios y el No Competitivo sirven a varios a proposito).
  const suyo = String((doc.metadata as { objeto?: unknown })?.objeto ?? "").trim();
  const objetos = suyo ? [suyo] : entrada.objetos;

  for (const objeto of objetos) {
    const etiqueta = `${doc.file_name.slice(0, 46)} · ${objeto}`;
    if (!APLICAR) {
      pendientes += 1;
      console.log(`  ${etiqueta.padEnd(62)} se calcularia`);
      continue;
    }
    try {
      if (FORZAR) {
        // Se borra la entrada de esa clave antes de pedirla, que es la unica
        // forma de saltarse la cache sin tocar la funcion que la lee.
        const meta = (doc.metadata ?? {}) as Record<string, unknown>;
        const cache = { ...((meta.camposExigidos ?? {}) as Record<string, unknown>) };
        for (const k of Object.keys(cache)) if (k.startsWith(`${objeto}:`)) delete cache[k];
        await supabaseRest(`documents?id=eq.${doc.id}`, {
          body: JSON.stringify({ metadata: { ...meta, camposExigidos: cache } }),
          headers: { Prefer: "return=minimal" },
          method: "PATCH",
        });
      }
      const r = await camposExigidosDelModelo({
        camposObjetivo: catalogoCampos(proceso, objeto),
        tipoObjeto: objeto,
        tipoProcesoSeleccion: proceso,
      });
      if (r.exigidos.length === 0) {
        fallidos += 1;
        console.log(`  ${etiqueta.padEnd(62)} SIN RESULTADO (¿IA no disponible?)`);
      } else {
        calculados += 1;
        console.log(
          `  ${etiqueta.padEnd(62)} ${String(r.exigidos.length).padStart(2)} campos` +
            `${r.cacheado ? " (ya estaba)" : ""}`,
        );
      }
    } catch (e) {
      fallidos += 1;
      console.log(`  ${etiqueta.padEnd(62)} FALLA: ${(e as Error).message.slice(0, 60)}`);
    }
  }
}

console.log(
  APLICAR
    ? `\n  ${calculados} calculados · ${fallidos} sin resultado`
    : `\n  ${pendientes} combinaciones modelo×objeto por calcular.\n` +
      "  Nada se ha modificado. Para ejecutarlo de verdad:\n" +
      "    npx tsx --env-file=.env.local scripts/precalcular-campos-exigidos.mts --aplicar",
);
