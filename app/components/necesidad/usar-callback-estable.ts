import { useCallback, useEffect, useRef } from "react";

/**
 * Un callback con identidad fija que siempre llama a la versión más reciente.
 *
 * Las funciones declaradas en el cuerpo de un componente se crean de nuevo en
 * cada render. Pasar una de ellas a un hijo envuelto en `memo` le da una prop
 * distinta cada vez y **anula la memoización por completo**: el hijo vuelve a
 * pintarse igual, y la extracción solo habría movido el problema de fichero.
 *
 * `useCallback` a secas no sirve aquí porque haría falta declarar dependencias
 * que cambian en cada render —el formulario entero, entre ellas—. El ref guarda
 * la última versión y el callback devuelto no cambia nunca.
 *
 * Solo para manejadores de eventos. No lo llames durante el render: entre el
 * render y el efecto que actualiza el ref, apuntaría a la versión anterior.
 */
export function useCallbackEstable<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}
