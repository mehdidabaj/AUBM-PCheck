import { NextResponse } from "next/server";
import { deleteFiche, getFiche, upsertFiche } from "@/lib/fiches";
import type { FicheInput } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const fiche = getFiche(id);
  if (!fiche) {
    return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });
  }
  return NextResponse.json(fiche);
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as FicheInput;
  const fiche = upsertFiche({ ...body, id });
  return NextResponse.json(fiche);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const ok = deleteFiche(id);
  if (!ok) {
    return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
