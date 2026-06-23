import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export const maxDuration = 180; // 3 minutes timeout

export async function POST(req: NextRequest) {
  try {
    const { url, userName } = await req.json();

    if (!url || !url.startsWith("http")) {
      return NextResponse.json({ error: "URL invalida" }, { status: 400 });
    }

    // Create session in DB
    const session = await db.solverSession.create({
      data: {
        url,
        userName: userName || "Physics Bot",
        status: "running",
      },
    });

    // Run the Python solver directly
    const pythonCmd = `cd /home/z/my-project && python3 scripts/physics_bot.py ${JSON.stringify(url)} ${JSON.stringify(userName || "Physics Bot")} 2>&1`;

    let output: string;
    try {
      output = execSync(pythonCmd, {
        timeout: 180000,
        encoding: "utf-8",
        maxBuffer: 1024 * 1024 * 10,
      });
    } catch (e: any) {
      output = e.stdout || e.message;
    }

    // Parse the output
    const resultadoMatch = output.match(/Resultado:\s*(.+?)(?:\n|$)/);
    const metodoMatch = output.match(/Metodo:\s*(.+?)(?:\n|$)/);
    const calculosMatch = output.match(/Calculos:\n([\s\S]*?)(?=\nRespostas:|$)/);
    const respostasMatch = output.match(/Respostas:\s*\[([^\]]+)\]/);
    const corretasMatch = output.match(/Corretas:\s*(\{[^}]+\})/);
    const enunciadoMatch = output.match(/Enunciado:\s*(.+?)(?:\n|Campos)/);
    const varsMatch = output.match(/Variaveis extraidas:\s*(\{[^}]+\})/);
    const tipoMatch = output.match(/Tipo detectado:\s*(\S+)/);

    const resultado = resultadoMatch ? resultadoMatch[1].trim() : "Ver screenshot";
    const metodo = metodoMatch ? metodoMatch[1].trim() : "unknown";
    const calculos = calculosMatch ? calculosMatch[1].trim() : "";
    const respostas = respostasMatch
      ? respostasMatch[1].split(",").map((s) => s.trim().replace(/'/g, ""))
      : [];
    const respostasCorretas = corretasMatch
      ? (() => { try { return JSON.parse(corretasMatch[1].replace(/'/g, '"')); } catch { return {}; } })()
      : {};
    const enunciado = enunciadoMatch ? enunciadoMatch[1].trim() : "";
    const variaveis = varsMatch
      ? (() => { try { return JSON.parse(varsMatch[1].replace(/'/g, '"')); } catch { return {}; } })()
      : {};
    const simulatorType = tipoMatch ? tipoMatch[1].trim() : "unknown";

    // Find latest screenshot
    const screenshotDir = "/home/z/my-project/download/physics-bot/screenshots";
    let screenshotFilename = "";
    try {
      const listOutput = execSync(
        `ls -t ${screenshotDir}/resultado_*.png 2>/dev/null | head -1`,
        { encoding: "utf-8" }
      ).trim();
      if (listOutput) {
        screenshotFilename = listOutput.split("/").pop() || "";
      }
    } catch {}

    // Use VLM to verify if result is unclear
    let finalResultado = resultado;
    if (!resultado.includes("CORRETO") && !resultado.includes("INCORRETO") && screenshotFilename) {
      try {
        const vlmOut = execSync(
          `z-ai vision -p "O resultado esta CORRETO ou INCORRETO? Responda apenas: CORRETO ou INCORRETO" -i "${screenshotDir}/${screenshotFilename}" -o /home/z/my-project/download/physics-bot/_vlm_check.json`,
          { timeout: 30000, encoding: "utf-8" }
        );
        const vlmData = JSON.parse(
          readFileSync("/home/z/my-project/download/physics-bot/_vlm_check.json", "utf-8")
        );
        const vlmText = vlmData?.choices?.[0]?.message?.content || "";
        if (vlmText.toUpperCase().includes("CORRETO") && !vlmText.toUpperCase().includes("INCORRETO")) {
          finalResultado = "CORRETO!";
        } else if (vlmText.toUpperCase().includes("INCORRETO")) {
          finalResultado = "INCORRETO";
        }
      } catch {}
    }

    // Generate AI summary
    let summary = calculos;
    try {
      const summaryPrompt = `Resuma de forma clara e didática como resolver este problema de física:\n\nEnunciado: ${enunciado}\nCálculos:\n${calculos}\nRespostas: ${respostas.join(", ")}\nResultado: ${finalResultado}`;
      execSync(
        `z-ai chat --prompt ${JSON.stringify(summaryPrompt)} --system "Voce e um professor de fisica. Explique de forma clara, passo a passo, como resolver este problema. Use linguagem simples em portugues. Formato markdown." --output /home/z/my-project/download/physics-bot/_summary.json`,
        { timeout: 60000 }
      );
      const summaryData = JSON.parse(
        readFileSync("/home/z/my-project/download/physics-bot/_summary.json", "utf-8")
      );
      if (summaryData?.choices?.[0]?.message?.content) {
        summary = summaryData.choices[0].message.content.trim();
      }
    } catch {}

    // Update DB
    const updated = await db.solverSession.update({
      where: { id: session.id },
      data: {
        status: finalResultado.includes("CORRETO") ? "solved" : "error",
        simulatorType,
        enunciado,
        variaveis: JSON.stringify(variaveis),
        calculos: summary,
        respostas: JSON.stringify(respostas),
        respostasCorretas: JSON.stringify(respostasCorretas),
        resultado: finalResultado,
        metodo,
        screenshotUrl: screenshotFilename
          ? `/api/solve/screenshot/${screenshotFilename}`
          : null,
      },
    });

    return NextResponse.json({
      success: true,
      id: updated.id,
      simulatorType,
      enunciado,
      variaveis,
      calculos: summary,
      respostas,
      respostasCorretas,
      resultado: finalResultado,
      metodo,
      screenshotUrl: updated.screenshotUrl,
    });
  } catch (error: any) {
    console.error("[API /solve] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        simulatorType: "",
        enunciado: "",
        variaveis: {},
        calculos: "",
        respostas: [],
        respostasCorretas: {},
        resultado: "ERRO",
        metodo: "",
        screenshotUrl: null,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
