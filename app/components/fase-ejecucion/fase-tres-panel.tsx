"use client";

import { FasePanel } from "../fase-panel";

export function FaseTresPanel({ processId, canManage }: { processId: string; canManage: boolean }) {
  return <FasePanel canManage={canManage} faseId="F3" processId={processId} />;
}
