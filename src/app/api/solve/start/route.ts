import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { readFileSync } from "fs";

// Start a solver job — returns immediately with a job ID
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, userName, model } = body;

    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      return NextResponse.json({
        success: false,
        error: "E_URL_INVALID",
        message: "URL invalida. Deve comecar com http:// ou https://",
      }, { status: 400 });
    }

    // Create session
    const session = await db.solverSession.create({
      data: {
        url,
        userName: userName || "p3pp4",
        status: "running",
      },
    });

    // Run the solver in the background (fire and forget)
    const pythonCmd = `cd /home/z/my-project && python3 scripts/physics_bot.py ${JSON.stringify(url)} ${JSON.stringify(userName || "p3pp4")} 2>&1`;
    
    const child = exec(pythonCmd, { timeout: 180000, maxBuffer: 10 * 1024 * 1024 }, async (error, stdout, stderr) => {
      try {
        const output = stdout || "";
        console.log("[SOLVER] Output length:", output.length);
        
        const pythonError = error ? (error.killed ? "E_PLAYWRIGHT_TIMEOUT" : "E_PYTHON_ERROR") : null;

        // Parse output with more robust patterns
        const getLine = (label: string) => {
          const regex = new RegExp(`${label}:\\s*(.+?)(?:\\n|$)`);
          const m = output.match(regex);
          return m ? m[1]?.trim() : null;
        };
        
        const resultado = getLine("Resultado") || getLine("ERRO") || "Indeterminado";
        const metodo = getLine("Metodo") || "unknown";
        
        // Get enunciado - more flexible
        let enunciado = "";
        const enunciadoMatch = output.match(/Enunciado:\s*([\s\S]*?)(?=\nVariaveis|Campos|Calculos)/);
        if (enunciadoMatch) enunciado = enunciadoMatch[1].trim();
        
        const simulatorType = getLine("Tipo detectado") || "unknown";
        
        // Get calculos - between "Calculos:" and "Respostas:"
        const calculosMatch = output.match(/Calculos:\n([\s\S]*?)(?=\nRespostas:|Respostas Enviadas)/);
        let calculos = calculosMatch ? calculosMatch[1].trim() : "";
        
        // Get respostas
        const respostasMatch = output.match(/Respostas(?:\s+Enviadas)?:\s*\[([^\]]+)\]/);
        const respostas = respostasMatch ? respostasMatch[1].split(",").map(s => s.trim().replace(/['"]/g, "")) : [];
        
        // Get correct answers
        const corretasMatch = output.match(/Respostas Corretas:\s*(\{[^}]+\})/);
        let respostasCorretas: Record<string, number> = {};
        if (corretasMatch) {
          try { respostasCorretas = JSON.parse(corretasMatch[1].replace(/'/g, '"').replace(/(\w+):/g, '"$1":')); } catch {}
        }
        
        // Get variaveis
        const varsMatch = output.match(/Variaveis(?:\s+JS)?:\s*(\{[^}]+\})/);
        let variaveis: Record<string, unknown> = {};
        if (varsMatch) {
          try { variaveis = JSON.parse(varsMatch[1].replace(/'/g, '"').replace(/(\w+):/g, '"$1":')); } catch {}
        }

        // Find screenshot
        let screenshotFilename = "";
        try {
          const { execSync } = require("child_process");
          const listOut = execSync(`ls -t /home/z/my-project/download/physics-bot/screenshots/resultado_*.png 2>/dev/null | head -1`, { encoding: "utf-8", timeout: 5000 }).trim();
          if (listOut) screenshotFilename = listOut.split("/").pop() || "";
        } catch {}

        // VLM verify if needed
        let finalResultado = resultado;
        if (!resultado.includes("CORRETO") && !resultado.includes("INCORRETO") && screenshotFilename) {
          try {
            const { execSync } = require("child_process");
            execSync(`z-ai vision -p "O resultado esta CORRETO ou INCORRETO? Responda apenas: CORRETO ou INCORRETO" -i "/home/z/my-project/download/physics-bot/screenshots/${screenshotFilename}" -o /home/z/my-project/download/physics-bot/_vlm_check.json`, { timeout: 30000 });
            const vlmData = JSON.parse(readFileSync("/home/z/my-project/download/physics-bot/_vlm_check.json", "utf-8"));
            const vlmText = vlmData?.choices?.[0]?.message?.content || "";
            if (vlmText.toUpperCase().includes("CORRETO") && !vlmText.toUpperCase().includes("INCORRETO")) finalResultado = "CORRETO!";
            else if (vlmText.toUpperCase().includes("INCORRETO")) finalResultado = "INCORRETO";
          } catch {}
        }

        // AI summary
        let summary = calculos;
        try {
          const { execSync } = require("child_process");
          const summaryPrompt = `Resuma de forma clara e didatica como resolver este problema de fisica:\n\nEnunciado: ${enunciado}\nCalculos:\n${calculos}\nRespostas: ${respostas.join(", ")}\nResultado: ${finalResultado}`;
          execSync(`z-ai chat --prompt ${JSON.stringify(summaryPrompt)} --system "Voce e um professor de fisica. Explique de forma clara, passo a passo. Use linguagem simples em portugues. Formato markdown." --output /home/z/my-project/download/physics-bot/_summary.json`, { timeout: 60000 });
          const summaryData = JSON.parse(readFileSync("/home/z/my-project/download/physics-bot/_summary.json", "utf-8"));
          if (summaryData?.choices?.[0]?.message?.content) summary = summaryData.choices[0].message.content.trim();
        } catch {}

        // Update DB
        const errors: string[] = [];
        if (pythonError) errors.push(pythonError);
        if (!screenshotFilename) errors.push("E_SCREENSHOT_NOT_FOUND");
        
        // Determine status based on result
        let status: string;
        if (finalResultado.includes("CORRETO")) {
          status = "solved";
        } else if (finalResultado.includes("INCORRETO")) {
          status = "solved"; // Still solved, just wrong answer
        } else if (finalResultado.includes("ERRO")) {
          status = "error";
        } else if (errors.length > 0) {
          status = "error";
        } else {
          status = "solved";
        }

        await db.solverSession.update({
          where: { id: session.id },
          data: {
            status,
            simulatorType,
            enunciado,
            variaveis: JSON.stringify(variaveis),
            calculos: summary,
            respostas: JSON.stringify(respostas),
            respostasCorretas: JSON.stringify(respostasCorretas),
            resultado: finalResultado,
            metodo,
            screenshotUrl: screenshotFilename ? `/api/solve/screenshot/${screenshotFilename}` : null,
          },
        });
      } catch (dbError: any) {
        console.error("[SOLVER BACKGROUND ERROR]", dbError);
        try {
          await db.solverSession.update({
            where: { id: session.id },
            data: { status: "error", resultado: "ERRO_INTERNO", calculos: dbError.message?.substring(0, 500) },
          });
        } catch {}
      }
    });

    // Don't wait for the child process — return immediately
    child.unref?.();

    return NextResponse.json({
      success: true,
      id: session.id,
      status: "running",
      message: "Solver iniciado. Faca polling em /api/solve/status para verificar o resultado.",
    });
  } catch (error: any) {
    console.error("[API /solve/start] Error:", error);
    return NextResponse.json({
      success: false,
      error: "E_UNKNOWN",
      message: error.message,
    }, { status: 500 });
  }
}
