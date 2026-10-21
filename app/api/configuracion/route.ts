import { NextResponse } from "next/server";

// Este endpoint monolítico (/api/configuracion) fue dividido en:
//   GET/PUT  /api/configuracion/settings
//   GET/POST/DELETE  /api/configuracion/users
//   PATCH  /api/configuracion/users/[id]
//   POST   /api/configuracion/users/seed
// Responde 410 Gone para señalizar a clientes que migren.
export async function GET() {
  return NextResponse.json(
    {
      error: "Endpoint deprecado. Use /api/configuracion/settings.",
    },
    { status: 410 },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "Endpoint deprecado. Use /api/configuracion/users." },
    { status: 410 },
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: "Endpoint deprecado. Use /api/configuracion/settings." },
    { status: 410 },
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: "Endpoint deprecado. Use /api/configuracion/users/[id]." },
    { status: 410 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Endpoint deprecado. Use /api/configuracion/users?userId=X." },
    { status: 410 },
  );
}
