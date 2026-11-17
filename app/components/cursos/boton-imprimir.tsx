"use client";

import { Printer } from "lucide-react";
import { Button } from "@/app/components/ui/button";

export function BotonImprimir() {
  return (
    <Button variant="secondary" onClick={() => window.print()} className="print:hidden">
      <Printer size={17} aria-hidden /> Imprimir o guardar en PDF
    </Button>
  );
}
