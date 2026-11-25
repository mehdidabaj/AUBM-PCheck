import { NextResponse } from "next/server";
import { listFiches, upsertFiche } from "@/lib/fiches";
import type { FicheInput, FicheStatus } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as FicheStatus | null;
  const fiches = listFiches(status ?? undefined);
  return NextResponse.json(fiches);
}

export async function POST(request: Request) {
  const body = (await request.json()) as FicheInput;

  if (
    !body.version?.trim() ||
    !body.owner?.trim() ||
    !body.pcName?.trim() ||
    !body.startDate ||
    !body.tasks?.length
  ) {
    return NextResponse.json(
      {
        error:
          "version, owner, pcName, startDate et au moins une tâche sont requis.",
      },
      { status: 400 },
    );
  }

  if (body.status !== "draft" && body.status !== "finalized") {
    return NextResponse.json({ error: "status invalide." }, { status: 400 });
  }

  const fiche = upsertFiche(body);
  return NextResponse.json(fiche, { status: 201 });
}
