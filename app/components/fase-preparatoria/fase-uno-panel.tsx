"use client";

import { useState } from "react";
import { FasePanel } from "../fase-panel";

export function FaseUnoPanel({ processId, canManage }: { processId: string; canManage: boolean }) {
  const [notifiedMsg, setNotifiedMsg] = useState<string | null>(null);
  const [notifKey, setNotifKey] = useState(0);

  return (
    <>
      {notifiedMsg ? <p className="formMessage successText">{notifiedMsg}</p> : null}
      <FasePanel
        canManage={canManage}
        faseId="F1"
        key={notifKey}
        onNotified={() => {
          setNotifiedMsg("Notificación enviada al área usuaria sobre el cronograma de segmentación.");
          setTimeout(() => setNotifiedMsg(null), 5000);
          setNotifKey((k) => k + 1);
        }}
        processId={processId}
      />
    </>
  );
}
