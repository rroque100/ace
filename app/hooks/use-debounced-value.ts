"use client";

import { useState, useEffect } from "react";

/**
 * Hook que retorna un valor con debounce.
 * Útil para inputs de búsqueda que disparan queries costosas.
 */
export function useDebouncedValue<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
