"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import {
  EXP_PAGINATION,
  EXP_PAGINATION_BTN,
  EXP_PAGINATION_BTN_ACTIVE,
  EXP_PAGINATION_CONTROLS,
  EXP_PAGINATION_DOTS,
  EXP_PAGINATION_INFO,
} from "./estilos";
import { cn } from "@/lib/utils";

export type PaginationInfo = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type Props = {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
};

function buildPageRange(current: number, total: number): (number | "...")[] {
  const delta = 1; // páginas a cada lado de la actual
  const range: (number | "...")[] = [];
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);

  range.push(1);
  if (left > 2) range.push("...");

  for (let i = left; i <= right; i++) {
    range.push(i);
  }

  if (right < total - 1) range.push("...");
  if (total > 1) range.push(total);

  return range;
}

export function Pagination({ pagination, onPageChange }: Props) {
  const { page, totalPages, total, limit } = pagination;

  if (totalPages <= 1) {
    return (
      <div className={cn("tw", EXP_PAGINATION)} aria-label="Paginación">
        <span className={EXP_PAGINATION_INFO}>
          {total} resultado{total === 1 ? "" : "s"}
        </span>
      </div>
    );
  }

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const range = buildPageRange(page, totalPages);

  return (
    <nav
      className={cn("tw", EXP_PAGINATION)}
      role="navigation"
      aria-label="Paginación de resultados"
    >
      <div className={EXP_PAGINATION_INFO}>
        Mostrando <strong>{start}</strong>–<strong>{end}</strong> de{" "}
        <strong>{total}</strong>
      </div>

      <div className={EXP_PAGINATION_CONTROLS}>
        <button
          type="button"
          className={EXP_PAGINATION_BTN}
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          aria-label="Primera página"
          title="Primera página"
        >
          <ChevronsLeft size={14} />
        </button>
        <button
          type="button"
          className={EXP_PAGINATION_BTN}
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Página anterior"
          title="Página anterior"
        >
          <ChevronLeft size={14} />
        </button>

        {range.map((item, idx) =>
          item === "..." ? (
            <span
              key={`dots-${idx}`}
              className={EXP_PAGINATION_DOTS}
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={cn(EXP_PAGINATION_BTN, item === page && EXP_PAGINATION_BTN_ACTIVE)}
              onClick={() => onPageChange(item)}
              aria-label={`Página ${item}`}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          className={EXP_PAGINATION_BTN}
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Página siguiente"
          title="Página siguiente"
        >
          <ChevronRight size={14} />
        </button>
        <button
          type="button"
          className={EXP_PAGINATION_BTN}
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          aria-label="Última página"
          title="Última página"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </nav>
  );
}
