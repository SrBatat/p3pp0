module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/src/lib/db.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "db",
    ()=>db
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs, [project]/node_modules/@prisma/client)");
;
const globalForPrisma = globalThis;
const db = globalForPrisma.prisma ?? new __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["PrismaClient"]({
    log: [
        'query'
    ]
});
if ("TURBOPACK compile-time truthy", 1) globalForPrisma.prisma = db;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/child_process [external] (child_process, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("child_process", () => require("child_process"));

module.exports = mod;
}),
"[externals]/fs [external] (fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs", () => require("fs"));

module.exports = mod;
}),
"[project]/src/app/api/solve/start/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$child_process__$5b$external$5d$__$28$child_process$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/child_process [external] (child_process, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/fs [external] (fs, cjs)");
;
;
;
;
;
async function POST(req) {
    try {
        const body = await req.json();
        const { url, userName, model } = body;
        if (!url || !url.startsWith("http://") && !url.startsWith("https://")) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                success: false,
                error: "E_URL_INVALID",
                message: "URL invalida. Deve comecar com http:// ou https://"
            }, {
                status: 400
            });
        }
        // Create session
        const session = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].solverSession.create({
            data: {
                url,
                userName: userName || "p3pp4",
                status: "running"
            }
        });
        // Run the solver in the background (fire and forget)
        const pythonCmd = `cd /home/z/my-project && python3 scripts/physics_bot.py ${JSON.stringify(url)} ${JSON.stringify(userName || "p3pp4")} 2>&1`;
        const child = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$child_process__$5b$external$5d$__$28$child_process$2c$__cjs$29$__["exec"])(pythonCmd, {
            timeout: 180000,
            maxBuffer: 10 * 1024 * 1024
        }, async (error, stdout, stderr)=>{
            try {
                const output = stdout || "";
                const pythonError = error ? error.killed ? "E_PLAYWRIGHT_TIMEOUT" : "E_PYTHON_ERROR" : null;
                // Parse output
                const get = (regex)=>{
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
                const respostas = respostasMatch ? respostasMatch[1].split(",").map((s)=>s.trim().replace(/'/g, "")) : [];
                const corretasMatch = output.match(/Corretas:\s*(\{[^}]+\})/);
                let respostasCorretas = {};
                if (corretasMatch) {
                    try {
                        respostasCorretas = JSON.parse(corretasMatch[1].replace(/'/g, '"').replace(/(\w+):/g, '"$1":'));
                    } catch  {}
                }
                const varsMatch = output.match(/Variaveis extraidas:\s*(\{[^}]+\})/);
                let variaveis = {};
                if (varsMatch) {
                    try {
                        variaveis = JSON.parse(varsMatch[1].replace(/'/g, '"').replace(/(\w+):/g, '"$1":'));
                    } catch  {}
                }
                // Find screenshot
                let screenshotFilename = "";
                try {
                    const listOut = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$child_process__$5b$external$5d$__$28$child_process$2c$__cjs$29$__["execSync"])(`ls -t /home/z/my-project/download/physics-bot/screenshots/resultado_*.png 2>/dev/null | head -1`, {
                        encoding: "utf-8",
                        timeout: 5000
                    }).trim();
                    if (listOut) screenshotFilename = listOut.split("/").pop() || "";
                } catch  {}
                // VLM verify if needed
                let finalResultado = resultado;
                if (!resultado.includes("CORRETO") && !resultado.includes("INCORRETO") && screenshotFilename) {
                    try {
                        (0, __TURBOPACK__imported__module__$5b$externals$5d2f$child_process__$5b$external$5d$__$28$child_process$2c$__cjs$29$__["execSync"])(`z-ai vision -p "O resultado esta CORRETO ou INCORRETO? Responda apenas: CORRETO ou INCORRETO" -i "/home/z/my-project/download/physics-bot/screenshots/${screenshotFilename}" -o /home/z/my-project/download/physics-bot/_vlm_check.json`, {
                            timeout: 30000
                        });
                        const vlmData = JSON.parse((0, __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["readFileSync"])("/home/z/my-project/download/physics-bot/_vlm_check.json", "utf-8"));
                        const vlmText = vlmData?.choices?.[0]?.message?.content || "";
                        if (vlmText.toUpperCase().includes("CORRETO") && !vlmText.toUpperCase().includes("INCORRETO")) finalResultado = "CORRETO!";
                        else if (vlmText.toUpperCase().includes("INCORRETO")) finalResultado = "INCORRETO";
                    } catch  {}
                }
                // AI summary
                let summary = calculos;
                try {
                    const summaryPrompt = `Resuma de forma clara e didatica como resolver este problema de fisica:\n\nEnunciado: ${enunciado}\nCalculos:\n${calculos}\nRespostas: ${respostas.join(", ")}\nResultado: ${finalResultado}`;
                    (0, __TURBOPACK__imported__module__$5b$externals$5d2f$child_process__$5b$external$5d$__$28$child_process$2c$__cjs$29$__["execSync"])(`z-ai chat --prompt ${JSON.stringify(summaryPrompt)} --system "Voce e um professor de fisica. Explique de forma clara, passo a passo. Use linguagem simples em portugues. Formato markdown." --output /home/z/my-project/download/physics-bot/_summary.json`, {
                        timeout: 60000
                    });
                    const summaryData = JSON.parse((0, __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["readFileSync"])("/home/z/my-project/download/physics-bot/_summary.json", "utf-8"));
                    if (summaryData?.choices?.[0]?.message?.content) summary = summaryData.choices[0].message.content.trim();
                } catch  {}
                // Update DB
                const errors = [];
                if (pythonError) errors.push(pythonError);
                if (!screenshotFilename) errors.push("E_SCREENSHOT_NOT_FOUND");
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].solverSession.update({
                    where: {
                        id: session.id
                    },
                    data: {
                        status: finalResultado.includes("CORRETO") ? "solved" : errors.length > 0 ? "error" : "solved",
                        simulatorType,
                        enunciado,
                        variaveis: JSON.stringify(variaveis),
                        calculos: summary,
                        respostas: JSON.stringify(respostas),
                        respostasCorretas: JSON.stringify(respostasCorretas),
                        resultado: finalResultado,
                        metodo,
                        screenshotUrl: screenshotFilename ? `/api/solve/screenshot/${screenshotFilename}` : null
                    }
                });
            } catch (dbError) {
                console.error("[SOLVER BACKGROUND ERROR]", dbError);
                try {
                    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].solverSession.update({
                        where: {
                            id: session.id
                        },
                        data: {
                            status: "error",
                            resultado: "ERRO_INTERNO",
                            calculos: dbError.message?.substring(0, 500)
                        }
                    });
                } catch  {}
            }
        });
        // Don't wait for the child process — return immediately
        child.unref?.();
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: true,
            id: session.id,
            status: "running",
            message: "Solver iniciado. Faca polling em /api/solve/status para verificar o resultado."
        });
    } catch (error) {
        console.error("[API /solve/start] Error:", error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: false,
            error: "E_UNKNOWN",
            message: error.message
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__da1a1845._.js.map