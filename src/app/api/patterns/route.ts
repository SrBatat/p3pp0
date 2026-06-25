import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { readFileSync } from "fs";

// GET /api/patterns — Lista todos os padrões de adaptação salvos
export async function GET() {
  try {
    const patterns = await db.solverPattern.findMany({
      orderBy: { updatedAt: "desc" },
    });

    // Also try to read the Python-side memory file
    let pythonPatterns: Record<string, unknown> = {};
    try {
      const memPath = "/home/z/my-project/download/physics-bot/solver_patterns.json";
      const data = readFileSync(memPath, "utf-8");
      pythonPatterns = JSON.parse(data);
    } catch {}

    return NextResponse.json({
      success: true,
      dbPatterns: patterns,
      pythonPatterns,
      totalTypes: Object.keys(pythonPatterns).length,
    });
  } catch (error: any) {
    console.error("[API /patterns] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/patterns — Limpa a memória de adaptação
export async function DELETE() {
  try {
    await db.solverPattern.deleteMany();
    return NextResponse.json({ success: true, message: "Memória de adaptação limpa." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
