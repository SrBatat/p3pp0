import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const SCREENSHOT_DIR = "/home/z/my-project/download/physics-bot/screenshots";

// Error codes for technical debugging
const ERRORS = {
  E_URL_INVALID: { code: "E_URL_INVALID", message: "URL inválida ou não começa com http(s)" },
  E_PLAYWRIGHT_TIMEOUT: { code: "E_PLAYWRIGHT_TIMEOUT", message: "Playwright excedeu o tempo limite (180s). O simulador pode estar lento ou com animação longa." },
  E_PLAYWRIGHT_CRASH: { code: "E_PLAYWRIGHT_CRASH", message: "Playwright crashou. Possível causa: navegador Chromium não disponível ou falta de memória." },
  E_PYTHON_ERROR: { code: "E_PYTHON_ERROR", message: "Script Python falhou. Verifique o log do physics_bot.py." },
  E_VLM_ERROR: { code: "E_VLM_ERROR", message: "VLM (Vision Language Model) falhou ao verificar screenshot. A verificação visual foi pulada." },
  E_AI_SUMMARY: { code: "E_AI_SUMMARY", message: "IA falhou ao gerar resumo. O cálculo bruto foi retornado no lugar." },
  E_SCREENSHOT_NOT_FOUND: { code: "E_SCREENSHOT_NOT_FOUND", message: "Screenshot não foi gerado. O Playwright pode ter falhado antes de capturar a tela." },
  E_DB_ERROR: { code: "E_DB_ERROR", message: "Erro de banco de dados. Verifique a conexão Prisma." },
  E_UNKNOWN: { code: "E_UNKNOWN", message: "Erro desconhecido." },
} as const;

function parsePythonOutput(output: string) {
  const get = (regex: RegExp) => {
    const m = output.match(regex);
    return m ? m[1]?.trim() : null;
  };

  const resultado = get(/Resultado:\s*(.+?)(?:\n|$)/) || "Indeterminado";
  const metodo = get(/Metodo:\s*(.+?)(?:\n|$)/) || "unknown";
  const enunciado = get(/Enunciado:\s*(.+?)(?:\n\s*Campos|\n\s*\[BOT\]|$)/) || "";
  const simulatorType = get(/Tipo detectado:\s*(\S+)/) || "unknown";

  const calculosMatch = output.match(/Calculos:\n([\s\S]*?)(?=\nRespostas:|\n\[BOT\])/);
  const calculos = calculosMatch ? calculosMatch[1].trim() : "";

  const respostasMatch = output.match(/Respostas:\s*\[([^\]]+)\]/);
  const respostas = respostasMatch
    ? respostasMatch[1].split(",").map((s) => s.trim().replace(/'/g, ""))
    : [];

  const corretasMatch = output.match(/Corretas:\s*(\{[^}]+\})/);
  let respostasCorretas: Record<string, number> = {};
  if (corretasMatch) {
    try {
      respostasCorretas = JSON.parse(corretasMatch[1].replace(/'/g, '"').replace(/(\w+):/g, '"$1":'));
    } catch {
      try { respostasCorretas = JSON.parse(corretasMatch[1].replace(/'/g, '"')); } catch {}
    }
  }

  const varsMatch = output.match(/Variaveis extraidas:\s*(\{[^}]+\})/);
  let variaveis: Record<string, unknown> = {};
  if (varsMatch) {
    try {
      variaveis = JSON.parse(varsMatch[1].replace(/'/g, '"').replace(/(\w+):/g, '"$1":'));
    } catch {
      try { variaveis = JSON.parse(varsMatch[1].replace(/'/g, '"')); } catch {}
    }
  }

  return { resultado, metodo, enunciado, simulatorType, calculos, respostas, respostasCorretas, variaveis };
}

function findLatestScreenshot(): string {
  try {
    const out = execSync(`ls -t ${SCREENSHOT_DIR}/resultado_*.png 2>/dev/null | head -1`, {
      encoding: "utf-8", timeout: 5000
    }).trim();
    return out ? out.split("/").pop() || "" : "";
  } catch { return ""; }
}

function runZaiVision(imagePath: string, prompt: string): string {
  try {
    const tmpFile = `/home/z/my-project/download/physics-bot/_vlm_check_${Date.now()}.json`;
    execSync(`z-ai vision -p ${JSON.stringify(prompt)} -i ${imagePath} -o ${tmpFile}`, {
      timeout: 60000, encoding: "utf-8"
    });
    const data = JSON.parse(readFileSync(tmpFile, "utf-8"));
    return data?.choices?.[0]?.message?.content || "";
  } catch (e: any) {
    console.error("[VLM ERROR]", e.message);
    return "";
  }
}

function runZaiChat(prompt: string, system: string): string {
  try {
    const tmpFile = `/home/z/my-project/download/physics-bot/_summary_${Date.now()}.json`;
    execSync(
      `z-ai chat --prompt ${JSON.stringify(prompt)} --system ${JSON.stringify(system)} --output ${tmpFile}`,
      { timeout: 90000, encoding: "utf-8" }
    );
    const data = JSON.parse(readFileSync(tmpFile, "utf-8"));
    return data?.choices?.[0]?.message?.content || "";
  } catch (e: any) {
    console.error("[AI SUMMARY ERROR]", e.message);
    return "";
  }
}

function getLatestScreenshotPath(filename: string): string {
  return `${SCREENSHOT_DIR}/${filename}`;
}

export async function POST(req: NextRequest) {
  const errors: string[] = [];
  let body: { url?: string; userName?: string; model?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({
      success: false,
      ...ERRORS.E_URL_INVALID,
      technicalDetail: "Request body não é JSON válido",
      errors: ["E_BODY_PARSE"],
    }, { status: 400 });
  }

  const { url, userName, model } = body;

  if (!url || !url.startsWith("http")) {
    return NextResponse.json({
      success: false,
      ...ERRORS.E_URL_INVALID,
      technicalDetail: `URL recebida: "${url}"`,
      errors: ["E_URL_INVALID"],
    }, { status: 400 });
  }

  // Create session in DB
  let session;
  try {
    session = await db.solverSession.create({
      data: { url, userName: userName || "p3pp4", status: "running" },
    });
  } catch (e: any) {
    errors.push("E_DB_ERROR");
    console.error("[DB CREATE ERROR]", e.message);
  }

  // Run Python solver
  let output = "";
  let pythonError: string | null = null;

  try {
    const pythonCmd = `cd /home/z/my-project && python3 scripts/physics_bot.py ${JSON.stringify(url)} ${JSON.stringify(userName || "p3pp4")} 2>&1`;
    output = execSync(pythonCmd, {
      timeout: 180000,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (e: any) {
    pythonError = e.message?.substring(0, 500) || "Unknown python error";
    output = e.stdout || "";
    if (e.killed) {
      errors.push("E_PLAYWRIGHT_TIMEOUT");
    } else {
      errors.push("E_PYTHON_ERROR");
    }
    console.error("[PYTHON ERROR]", pythonError);
  }

  // Parse output
  const parsed = parsePythonOutput(output);

  // Find screenshot
  const screenshotFilename = findLatestScreenshot();
  if (!screenshotFilename) errors.push("E_SCREENSHOT_NOT_FOUND");

  // Verify with VLM if needed
  let finalResultado = parsed.resultado;
  if (!parsed.resultado.includes("CORRETO") && !parsed.resultado.includes("INCORRETO") && screenshotFilename) {
    const vlmText = runZaiVision(
      getLatestScreenshotPath(screenshotFilename),
      "O resultado esta CORRETO ou INCORRETO? Responda apenas: CORRETO ou INCORRETO"
    );
    if (vlmText) {
      const upper = vlmText.toUpperCase();
      if (upper.includes("CORRETO") && !upper.includes("INCORRETO")) {
        finalResultado = "CORRETO!";
      } else if (upper.includes("INCORRETO")) {
        finalResultado = "INCORRETO";
      }
    } else {
      errors.push("E_VLM_ERROR");
    }
  }

  // Generate AI summary (try with selected model or default)
  let summary = parsed.calculos;
  const summaryPrompt = `Resuma de forma clara e didática como resolver este problema de física:\n\nEnunciado: ${parsed.enunciado}\nCálculos:\n${parsed.calculos}\nRespostas: ${parsed.respostas.join(", ")}\nResultado: ${finalResultado}`;
  const summarySystem = "Voce e um professor de fisica. Explique de forma clara, passo a passo, como resolver este problema. Use linguagem simples em portugues. Formato markdown com titulos e listas.";

  const aiSummary = runZaiChat(summaryPrompt, summarySystem);
  if (aiSummary) {
    summary = aiSummary;
  } else {
    errors.push("E_AI_SUMMARY");
  }

  // Update DB
  if (session) {
    try {
      await db.solverSession.update({
        where: { id: session.id },
        data: {
          status: finalResultado.includes("CORRETO") ? "solved" : "error",
          simulatorType: parsed.simulatorType,
          enunciado: parsed.enunciado,
          variaveis: JSON.stringify(parsed.variaveis),
          calculos: summary,
          respostas: JSON.stringify(parsed.respostas),
          respostasCorretas: JSON.stringify(parsed.respostasCorretas),
          resultado: finalResultado,
          metodo: parsed.metodo,
          screenshotUrl: screenshotFilename ? `/api/solve/screenshot/${screenshotFilename}` : null,
        },
      });
    } catch (e: any) {
      errors.push("E_DB_ERROR");
      console.error("[DB UPDATE ERROR]", e.message);
    }
  }

  return NextResponse.json({
    success: !pythonError || parsed.respostas.length > 0,
    id: session?.id,
    simulatorType: parsed.simulatorType,
    enunciado: parsed.enunciado,
    variaveis: parsed.variaveis,
    calculos: summary,
    respostas: parsed.respostas,
    respostasCorretas: parsed.respostasCorretas,
    resultado: finalResultado,
    metodo: parsed.metodo,
    screenshotUrl: screenshotFilename ? `/api/solve/screenshot/${screenshotFilename}` : null,
    errors: errors.length > 0 ? errors : undefined,
    technicalDetail: pythonError || undefined,
    model: model || "glm-4",
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  return NextResponse.json({ status: "p3pp4 solver online" });
}
