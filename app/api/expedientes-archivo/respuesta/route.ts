import { NextResponse } from "next/server";

// Este endpoint monolitico (/api/expedientes-archivo/respuesta) fue dividido en:
//   GET  /api/expedientes-archivo/respuesta/list
//   POST /api/expedientes-archivo/respuesta/save
// Responde 410 Gone para senalar a clientes que migren.
export async function GET() {
  return NextResponse.json(
    { error: "Endpoint deprecado. Use /api/expedientes-archivo/respuesta/list." },
    { status: 410 },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "Endpoint deprecado. Use /api/expedientes-archivo/respuesta/save." },
    { status: 410 },
  );
}
