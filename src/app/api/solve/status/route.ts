import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Poll solver status by session ID
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id parameter required" }, { status: 400 });
    }

    const session = await db.solverSession.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const isComplete = session.status === "solved" || session.status === "error";

    return NextResponse.json({
      id: session.id,
      status: session.status,
      complete: isComplete,
      // Only include result data when complete
      ...(isComplete ? {
        success: session.status === "solved",
        simulatorType: session.simulatorType,
        enunciado: session.enunciado,
        variaveis: session.variaveis ? JSON.parse(session.variaveis) : {},
        calculos: session.calculos,
        respostas: session.respostas ? JSON.parse(session.respostas) : [],
        respostasCorretas: session.respostasCorretas ? JSON.parse(session.respostasCorretas) : {},
        resultado: session.resultado,
        metodo: session.metodo,
        screenshotUrl: session.screenshotUrl,
      } : {}),
    });
  } catch (error: any) {
    console.error("[API /solve/status] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
