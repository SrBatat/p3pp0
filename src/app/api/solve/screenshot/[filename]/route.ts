import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const filePath = `/home/z/my-project/download/physics-bot/screenshots/${filename}`;

    if (existsSync(filePath)) {
      const data = readFileSync(filePath);
      return new NextResponse(data, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
