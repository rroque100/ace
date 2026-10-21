"use client";

import {
  EXP_CARD,
  EXP_CARDS_GRID,
  EXP_CARD_HEADER,
  EXP_LIST,
  EXP_LIST_ITEM,
  EXP_LIST_ITEM_ACTIONS,
  EXP_LIST_ITEM_BODY,
  EXP_LIST_ITEM_ICON,
  EXP_SKELETON,
  EXP_STATS,
  EXP_STAT_HEADER,
  EXP_TABLE,
  EXP_TABLE_TD,
  EXP_TABLE_TH,
  EXP_TABLE_THEAD,
  EXP_TABLE_WRAP,
  expStatCardClass,
} from "./estilos";
import { cn } from "@/lib/utils";

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className={cn("tw", EXP_LIST)} aria-busy="true" aria-label="Cargando expedientes">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={EXP_LIST_ITEM}>
          <div className={EXP_LIST_ITEM_ICON}>
            <div className={cn(EXP_SKELETON, "size-[18px] rounded")} />
          </div>
          <div className={EXP_LIST_ITEM_BODY}>
            <div className={cn(EXP_SKELETON, "mb-2 h-3.5 w-[70%]")} />
            <div className={cn(EXP_SKELETON, "mb-1.5 h-[11px] w-1/2")} />
            <div className={cn(EXP_SKELETON, "h-[11px] w-2/5")} />
          </div>
          <div className={EXP_LIST_ITEM_ACTIONS}>
            <div className={cn(EXP_SKELETON, "size-6 rounded-md")} />
            <div className={cn(EXP_SKELETON, "size-6 rounded-md")} />
            <div className={cn(EXP_SKELETON, "size-6 rounded-md")} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className={cn("tw", EXP_STATS)} aria-busy="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={expStatCardClass()}>
          <div className={EXP_STAT_HEADER}>
            <div className={cn(EXP_SKELETON, "h-2.5 w-[50px]")} />
            <div className={cn(EXP_SKELETON, "size-4 rounded")} />
          </div>
          <div className={cn(EXP_SKELETON, "mt-2 h-[26px] w-[60px]")} />
          <div className={cn(EXP_SKELETON, "mt-1.5 h-2.5 w-20")} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className={cn("tw", EXP_CARDS_GRID)} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn(EXP_CARD, "cursor-default")}>
          <div className={EXP_CARD_HEADER}>
            <div className={cn(EXP_SKELETON, "size-8 rounded-lg")} />
            <div className={cn(EXP_SKELETON, "h-4 w-[60px] rounded-full")} />
          </div>
          <div className={cn(EXP_SKELETON, "mt-2 h-3.5 w-[85%]")} />
          <div className={cn(EXP_SKELETON, "mt-2 h-[11px] w-3/5")} />
          <div className={cn(EXP_SKELETON, "mt-1 h-[11px] w-[70%]")} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className={cn("tw", EXP_TABLE_WRAP)} aria-busy="true">
      <table className={EXP_TABLE}>
        <thead className={EXP_TABLE_THEAD}>
          <tr>
            <th className={cn(EXP_TABLE_TH, "w-9")}></th>
            <th className={EXP_TABLE_TH}></th>
            <th className={EXP_TABLE_TH}></th>
            <th className={EXP_TABLE_TH}></th>
            <th className={EXP_TABLE_TH}></th>
            <th className={EXP_TABLE_TH}></th>
            <th className={cn(EXP_TABLE_TH, "w-[140px]")}></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td className={EXP_TABLE_TD}><div className={cn(EXP_SKELETON, "size-4 rounded-[3px]")} /></td>
              <td className={EXP_TABLE_TD}>
                <div className={cn(EXP_SKELETON, "mb-1.5 h-[13px] w-4/5")} />
                <div className={cn(EXP_SKELETON, "h-2.5 w-1/2")} />
              </td>
              <td className={EXP_TABLE_TD}><div className={cn(EXP_SKELETON, "h-3 w-10")} /></td>
              <td className={EXP_TABLE_TD}><div className={cn(EXP_SKELETON, "h-3 w-20")} /></td>
              <td className={EXP_TABLE_TD}><div className={cn(EXP_SKELETON, "h-3 w-[50px]")} /></td>
              <td className={EXP_TABLE_TD}><div className={cn(EXP_SKELETON, "h-[18px] w-[70px] rounded-full")} /></td>
              <td className={EXP_TABLE_TD}>
                <div className="flex gap-1">
                  <div className={cn(EXP_SKELETON, "size-7 rounded-md")} />
                  <div className={cn(EXP_SKELETON, "size-7 rounded-md")} />
                  <div className={cn(EXP_SKELETON, "size-7 rounded-md")} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
