"use client";

import { FasePanel } from "../fase-panel";

export function FaseDosPanel({ processId, canManage }: { processId: string; canManage: boolean }) {
  return <FasePanel canManage={canManage} faseId="F2" processId={processId} />;
}
