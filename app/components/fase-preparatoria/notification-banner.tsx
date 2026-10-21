"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

type CronogramaFila = { area: string; fecha: string };

type Notification = {
  id: string;
  action: string;
  details: { message?: string; code?: string; cronograma?: CronogramaFila[] };
  created_at: string;
};

export function NotificationBanner({ processId }: { processId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/processes/${processId}/notificaciones`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setNotifications(d.notificaciones ?? []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [processId]);

  if (loading) return null;
  if (notifications.length === 0) return null;

  return (
    <div className="mb-2 flex flex-col gap-1.5">
      {notifications.map((n) => (
        <div
          className="flex items-center gap-2 rounded-[6px] border-l-[3px] border-l-[#d97706] bg-[#fef3c7] px-3 py-2 text-[12.5px] leading-[1.4] text-[#92400e]"
          key={n.id}
        >
          <Bell size={14} />
          <span>{n.details?.message ?? "Notificación del sistema."}</span>
          {n.details?.cronograma && n.details.cronograma.length > 0 ? (
            <ul className="ml-[22px] mt-0.5 flex list-none flex-col gap-0.5 p-0 text-[12px]">
              {n.details.cronograma.map((c, i) => (
                <li key={i}>
                  <strong>{c.area}:</strong> {c.fecha}
                </li>
              ))}
            </ul>
          ) : null}
          <button
            className="ml-auto p-0.5 text-[#92400e] opacity-60 hover:opacity-100"
            onClick={() => setNotifications((prev) => prev.filter((x) => x.id !== n.id))}
            type="button"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
