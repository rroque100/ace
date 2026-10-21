"use client";

import { useState } from "react";
import { chatWithExpedientes, searchExpedientes } from "@/lib/expedientes-archivo-actions";
import type { ChatAnswer, SearchMode, SearchResult } from "./types";

export type ChatMessage = { role: "user" | "ai"; text: string; sources?: SearchResult[]; warnings?: string[] };

// Estado y acciones de la pestaña Buscar (búsqueda vectorial + consulta a la IA)
// y del panel de chat. Extraído del workspace para separar la búsqueda de la
// gestión de la lista/subida. Recibe `showToast` para los avisos de error.
export function useExpedienteSearch(showToast: (message: string, kind?: "success" | "error" | "warning" | "info") => void) {
  const [mode, setMode] = useState<SearchMode>("buscar");
  const [query, setQuery] = useState("");
  const [filterAnio, setFilterAnio] = useState("");
  const [filterOficina, setFilterOficina] = useState("");
  const [filterMateria, setFilterMateria] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [answer, setAnswer] = useState<ChatAnswer | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const activeFilterCount = [filterAnio, filterOficina, filterMateria].filter((v) => v.trim()).length;

  async function runSearch(event?: React.FormEvent) {
    event?.preventDefault();
    const minLen = mode === "buscar" ? 2 : 3;
    if (query.trim().length < minLen) {
      setSearchMessage(`Escribe al menos ${minLen} caracteres para ${mode === "buscar" ? "buscar" : "consultar"}.`);
      return;
    }
    setSearching(true);
    setSearchMessage(null);
    setResults(null);
    setAnswer(null);
    try {
      if (mode === "buscar") {
        const data = await searchExpedientes(query.trim(), {
          anio: filterAnio ? Number.parseInt(filterAnio, 10) : undefined,
          oficina: filterOficina.trim() || undefined,
          materia: filterMateria.trim() || undefined,
        });
        setResults(data.results);
        if (data.results.length === 0) {
          setSearchMessage(
            "Sin resultados. Prueba con otros términos, ajusta los filtros o sube el expediente si aún no está en el archivo.",
          );
        }
      } else {
        const data = await chatWithExpedientes(query.trim());
        setAnswer(data);
        setChatMessages((prev) => [
          ...prev,
          { role: "user", text: query.trim() },
          { role: "ai", text: data.answer, sources: data.sources, warnings: data.warnings },
        ]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo consultar.";
      setSearchMessage(msg);
      showToast(msg, "error");
    } finally {
      setSearching(false);
    }
  }

  // Cambia el sub-modo de búsqueda y limpia los resultados del modo anterior
  // para no mezclar salidas (resultados vectoriales vs. respuesta de chat).
  function changeMode(next: SearchMode) {
    setMode(next);
    setResults(null);
    setAnswer(null);
    setSearchMessage(null);
  }

  async function askInChat(text: string) {
    setChatMessages((prev) => [...prev, { role: "user", text }]);
    setSearching(true);
    try {
      const data = await chatWithExpedientes(text);
      setChatMessages((prev) => [...prev, { role: "ai", text: data.answer, sources: data.sources, warnings: data.warnings }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al consultar.";
      setChatMessages((prev) => [...prev, { role: "ai", text: msg }]);
      showToast(msg, "error");
    } finally {
      setSearching(false);
    }
  }

  return {
    mode,
    setMode,
    query,
    setQuery,
    filterAnio,
    setFilterAnio,
    filterOficina,
    setFilterOficina,
    filterMateria,
    setFilterMateria,
    showFilters,
    setShowFilters,
    searching,
    results,
    answer,
    searchMessage,
    chatOpen,
    setChatOpen,
    chatMessages,
    activeFilterCount,
    runSearch,
    changeMode,
    askInChat,
  };
}
