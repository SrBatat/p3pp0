/**
 * Solver Service - Microservice que roda o Playwright + Z.AI para resolver simuladores
 * Porta: 3030
 */
import { createServer } from "http";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const PORT = 3030;
const OUTPUT_DIR = "/home/z/my-project/download/physics-bot";
const SCREENSHOT_DIR = join(OUTPUT_DIR, "screenshots");

if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });

// Helper: run z-ai chat
function zaiChat(prompt: string, system: string = ""): string {
  const tmpFile = join(OUTPUT_DIR, `_chat_${Date.now()}.json`);
  const cmd = system
    ? `z-ai chat --prompt ${JSON.stringify(prompt)} --system ${JSON.stringify(system)} --output ${tmpFile}`
    : `z-ai chat --prompt ${JSON.stringify(prompt)} --output ${tmpFile}`;
  try {
    execSync(cmd, { timeout: 90000 });
    const data = JSON.parse(readFileSync(tmpFile, "utf-8"));
    if (data.choices) return data.choices[0].message.content.trim();
    if (data.content) return data.content.trim();
    return JSON.stringify(data);
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}

// Helper: run z-ai vision
function zaiVision(imagePath: string, prompt: string): string {
  const tmpFile = join(OUTPUT_DIR, `_vlm_${Date.now()}.json`);
  try {
    execSync(
      `z-ai vision --prompt ${JSON.stringify(prompt)} --image ${imagePath} --output ${tmpFile}`,
      { timeout: 60000 }
    );
    const data = JSON.parse(readFileSync(tmpFile, "utf-8"));
    if (data.choices) return data.choices[0].message.content.trim();
    if (data.content) return data.content.trim();
    return JSON.stringify(data);
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}

// Helper: run z-ai page_reader
function zaiPageReader(url: string): any {
  const tmpFile = join(OUTPUT_DIR, `_page_${Date.now()}.json`);
  try {
    execSync(
      `z-ai function -n page_reader -a '${JSON.stringify({ url })}' -o ${tmpFile}`,
      { timeout: 30000 }
    );
    return JSON.parse(readFileSync(tmpFile, "utf-8"));
  } catch {
    return null;
  }
}

interface SolveRequest {
  url: string;
  userName: string;
}

interface SolveResult {
  success: boolean;
  simulatorType: string;
  enunciado: string;
  variaveis: Record<string, any>;
  calculos: string;
  respostas: string[];
  respostasCorretas: Record<string, any>;
  resultado: string;
  metodo: string;
  screenshotPath: string;
  error?: string;
}

const server = createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "POST" && req.url === "/solve") {
    const body: SolveRequest = await new Promise((resolve) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(JSON.parse(data)));
    });

    console.log(`[SOLVER] Received: ${body.url} | Name: ${body.userName}`);
    const resultId = randomUUID();

    try {
      // Step 1: Read the page with z-ai page_reader
      console.log("[SOLVER] Step 1: Reading page...");
      const pageData = zaiPageReader(body.url);
      const htmlContent = pageData?.data?.html || "";
      const title = pageData?.data?.title || "Unknown";

      // Step 2: Detect simulator type
      const isPhysicsAviary = body.url.includes("thephysicsaviary.com") ||
        htmlContent.includes("#BeginButton") ||
        htmlContent.includes("#SubmitButton");

      const simulatorType = isPhysicsAviary ? "physics_aviary" : "generic";
      console.log(`[SOLVER] Detected: ${simulatorType}`);

      // Step 3: Run the Python solver
      console.log("[SOLVER] Step 3: Running Python solver...");
      const solveScript = join(OUTPUT_DIR, `solve_${resultId}.json`);

      const pythonCmd = `cd /home/z/my-project && python3 scripts/physics_bot.py ${JSON.stringify(body.url)} ${JSON.stringify(body.userName)} 2>&1`;
      console.log(`[SOLVER] Running: ${pythonCmd}`);

      const output = execSync(pythonCmd, { timeout: 180000, encoding: "utf-8" });
      console.log("[SOLVER] Python output received");

      // Step 4: Parse the output
      const resultMatch = output.match(/RESULTADO FINAL\s*=+\s*\n\s*Resultado:\s*(.+?)\n\s*Metodo:\s*(.+?)\n/);

      // Extract calculations from output
      const calcMatch = output.match(/Calculos:\n([\s\S]*?)(?=Respostas:|$)/);
      const respMatch = output.match(/Respostas:\s*\[([^\]]+)\]/);
      const correctMatch = output.match(/Corretas:\s*(\{[^}]+\})/);

      const resultado = resultMatch ? resultMatch[1].trim() : "Ver screenshot";
      const metodo = resultMatch ? resultMatch[2].trim() : "unknown";
      const calculos = calcMatch ? calcMatch[1].trim() : "";
      const respostas = respMatch ? respMatch[1].split(",").map((s: string) => s.trim().replace(/'/g, "")) : [];
      const respostasCorretas = correctMatch ? JSON.parse(correctMatch[1]) : {};

      // Step 5: Find the screenshot
      const screenshotDir = SCREENSHOT_DIR;
      const listCmd = `ls -t ${screenshotDir}/resultado_*.png 2>/dev/null | head -1`;
      const screenshotPath = execSync(listCmd, { encoding: "utf-8" }).trim();

      // Also find enunciado from output
      const enunciadoMatch = output.match(/Enunciado:\s*(.+?)(?:\n|Campos)/);
      const enunciado = enunciadoMatch ? enunciadoMatch[1].trim() : "";

      // Extract variaveis
      const varsMatch = output.match(/Variaveis extraidas:\s*(\{[^}]+\})/);
      const variaveis = varsMatch ? JSON.parse(varsMatch[1].replace(/'/g, '"')) : {};

      // Step 6: If no direct result, use VLM to verify screenshot
      let finalResultado = resultado;
      if (resultado === "Ver screenshot" && screenshotPath) {
        console.log("[SOLVER] Using VLM to verify result...");
        const vlmResult = zaiVision(screenshotPath,
          "O resultado esta CORRETO ou INCORRETO? Responda apenas: CORRETO ou INCORRETO");
        if (vlmResult.toUpperCase().includes("CORRETO") && !vlmResult.toUpperCase().includes("INCORRETO")) {
          finalResultado = "CORRETO!";
        } else if (vlmResult.toUpperCase().includes("INCORRETO")) {
          finalResultado = "INCORRETO";
        }
      }

      // Step 7: Generate resolution summary with AI
      console.log("[SOLVER] Step 7: Generating summary...");
      const summary = zaiChat(
        `Resuma de forma clara e didática como resolver este problema de física:\n\n` +
        `Simulador: ${title}\n` +
        `Enunciado: ${enunciado}\n` +
        `Cálculos realizados:\n${calculos}\n` +
        `Respostas: ${respostas.join(", ")}\n` +
        `Resultado: ${finalResultado}`,
        "Você é um professor de física. Explique de forma clara, passo a passo, como resolver este problema. Use linguagem simples e didática em português."
      );

      const result: SolveResult = {
        success: true,
        simulatorType,
        enunciado,
        variaveis,
        calculos: summary || calculos,
        respostas,
        respostasCorretas,
        resultado: finalResultado,
        metodo,
        screenshotPath: screenshotPath || "",
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));

    } catch (error: any) {
      console.error("[SOLVER] Error:", error.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
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
        screenshotPath: "",
      }));
    }
    return;
  }

  if (req.method === "GET" && req.url?.startsWith("/screenshot/")) {
    const filename = req.url.replace("/screenshot/", "");
    const filePath = join(SCREENSHOT_DIR, filename);
    if (existsSync(filePath)) {
      const data = readFileSync(filePath);
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(data);
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
    return;
  }

  // Health check
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok", service: "solver" }));
});

server.listen(PORT, () => {
  console.log(`[SOLVER] Service running on port ${PORT}`);
});
