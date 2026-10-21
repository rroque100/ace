import { deleteStorageObjects } from "@/lib/supabase-server";

/** Lo mínimo que hace falta de un documento para borrar su fichero. */
export type DocumentoConFichero = {
  storage_bucket: string | null;
  storage_path: string | null;
};

/**
 * Rutas a borrar, agrupadas por bucket.
 *
 * El borrado del almacén se pide por bucket, así que hay que agrupar aunque hoy
 * todos los documentos vivan en el mismo: el bucket viaja en cada fila y nada
 * garantiza que siga siendo uno solo.
 *
 * Descarta las filas sin ruta o sin bucket en vez de romper. Un documento a
 * medio subir puede no tenerlas, y que eso impida borrar la necesidad entera
 * sería peor que dejarse un fichero.
 */
export function rutasPorBucket(docs: DocumentoConFichero[]): Map<string, string[]> {
  const porBucket = new Map<string, string[]>();
  for (const doc of docs) {
    const bucket = doc.storage_bucket?.trim();
    const ruta = doc.storage_path?.trim();
    if (!bucket || !ruta) continue;
    const rutas = porBucket.get(bucket) ?? [];
    if (!rutas.includes(ruta)) rutas.push(ruta);
    porBucket.set(bucket, rutas);
  }
  return porBucket;
}

/**
 * Borra del almacén los ficheros de estos documentos.
 *
 * NO lanza. Se llama antes de borrar filas, y un fallo del almacén no debe
 * impedir el borrado: quedaría la fila apuntando a un fichero que el usuario
 * cree eliminado, que es peor que un huérfano. El huérfano se ve y se limpia;
 * una fila que no se puede borrar bloquea el trabajo.
 *
 * Se devuelve lo que falló para que quien llama pueda registrarlo.
 */
export async function borrarFicherosDe(docs: DocumentoConFichero[]): Promise<string[]> {
  const fallos: string[] = [];
  for (const [bucket, rutas] of rutasPorBucket(docs)) {
    try {
      await deleteStorageObjects(bucket, rutas);
    } catch (error) {
      fallos.push(`${bucket}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return fallos;
}
