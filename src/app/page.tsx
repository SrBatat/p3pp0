"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send,
  Bot,
  User,
  FlaskConical,
  CheckCircle2,
  XCircle,
  Loader2,
  Settings,
  History,
  Trash2,
  ExternalLink,
  Sparkles,
  ImageIcon,
  AlertTriangle,
  Zap,
  Skull,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// AI Models available
const AI_MODELS = [
  { id: "glm-4", name: "GLM-4", desc: "Modelo principal, rápido e preciso" },
  { id: "glm-4-plus", name: "GLM-4 Plus", desc: "Modelo avançado, mais preciso" },
  { id: "glm-4-flash", name: "GLM-4 Flash", desc: "Modelo rápido, respostas instantâneas" },
  { id: "glm-4v-plus", name: "GLM-4V Plus", desc: "Visão + texto, analisa imagens" },
];

// Technical error descriptions
const ERROR_EXPLANATIONS: Record<string, { title: string; desc: string; fix: string }> = {
  E_URL_INVALID: {
    title: "URL Inválida",
    desc: "A URL fornecida não é um endereço HTTP/HTTPS válido.",
    fix: "Verifique se a URL começa com http:// ou https:// e está completa.",
  },
  E_PLAYWRIGHT_TIMEOUT: {
    title: "Timeout do Playwright",
    desc: "O navegador headless excedeu o tempo limite de 180 segundos. Isso acontece quando o simulador tem animações longas ou trava.",
    fix: "Tente novamente. Se persistir, o simulador pode estar fora do ar ou ter mudado de estrutura.",
  },
  E_PLAYWRIGHT_CRASH: {
    title: "Crash do Playwright/Chromium",
    desc: "O navegador Chromium crashou durante a execução. Possível falta de memória ou binário corrompido.",
    fix: "Verifique se o Chromium está instalado. Em Vercel, use uma função serverless com Playwright compatível.",
  },
  E_PYTHON_ERROR: {
    title: "Erro no Script Python",
    desc: "O physics_bot.py falhou. Pode ser erro de sintaxe, seletor CSS não encontrado, ou variável JS inexistente.",
    fix: "Verifique o log do Python. O simulador pode ter estrutura diferente da esperada.",
  },
  E_VLM_ERROR: {
    title: "Erro no VLM (Vision Model)",
    desc: "O modelo de visão falhou ao verificar o screenshot. A verificação visual foi pulada.",
    fix: "A resolução ainda pode estar correta. Verifique o screenshot manualmente.",
  },
  E_AI_SUMMARY: {
    title: "Erro no Resumo IA",
    desc: "O modelo de IA falhou ao gerar o resumo didático. O cálculo bruto foi retornado.",
    fix: "Tente novamente ou troque o modelo de IA nas configurações.",
  },
  E_SCREENSHOT_NOT_FOUND: {
    title: "Screenshot Não Encontrado",
    desc: "O Playwright não gerou o arquivo de screenshot. O simulador pode ter falhado antes de renderizar.",
    fix: "Verifique se o simulador carrega corretamente no navegador.",
  },
  E_DB_ERROR: {
    title: "Erro de Banco de Dados",
    desc: "Falha ao salvar/ler no banco. Verifique a conexão Prisma/Supabase.",
    fix: "Verifique DATABASE_URL no .env e se o banco está acessível.",
  },
  E_FETCH_ERROR: {
    title: "Erro de Fetch / Gateway",
    desc: "O gateway (Caddy) ou o servidor Next.js retornou erro 502/504. Isso acontece porque o solver demora 25-60s e o gateway corta a conexão antes.",
    fix: "A arquitetura assíncrona (start + polling) já está ativa. Se persistir, verifique se o servidor está rodando.",
  },
  E_POLL_TIMEOUT: {
    title: "Timeout no Polling",
    desc: "O solver demorou mais de 240 segundos para completar. Isso é incomum e pode indicar que o Playwright travou.",
    fix: "Tente novamente. Se persistir, o simulador pode ter uma animação muito longa.",
  },
};

interface SolverResult {
  id?: string;
  success: boolean;
  simulatorType: string;
  enunciado: string;
  variaveis: Record<string, unknown>;
  calculos: string;
  respostas: string[];
  respostasCorretas: Record<string, number>;
  resultado: string;
  metodo: string;
  screenshotUrl: string | null;
  errors?: string[];
  technicalDetail?: string;
  model?: string;
  error?: string;
}

interface HistoryItem {
  id: string;
  url: string;
  userName: string;
  status: string;
  resultado: string | null;
  screenshotUrl: string | null;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  result?: SolverResult;
  timestamp: Date;
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputUrl, setInputUrl] = useState("");
  const [userName, setUserName] = useState("Helio");
  const [selectedModel, setSelectedModel] = useState("glm-4");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Bem-vindo ao **p3pp4** 🔮\n\nCole o link de qualquer simulador de física e eu resolvo automaticamente.\n\n• 🔬 Analiso o simulador com IA\n• 🧮 Calculo as respostas com precisão\n• 📸 Gero screenshot com seu nome\n• 📝 Explico passo a passo\n• 🤖 Múltiplos modelos de IA disponíveis",
        timestamp: new Date(),
      },
    ]);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const loadHistory = async () => {
    try {
      const res = await fetch("/api/history");
      if (res.ok) setHistory(await res.json());
    } catch {}
  };

  const handleSolve = async () => {
    const url = inputUrl.trim();
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      toast.error("Cole uma URL que comece com http:// ou https://");
      return;
    }

    setInputUrl("");

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: url,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setLoadingStep("Iniciando solver...");

    const steps = [
      "Iniciando solver...",
      "Analisando simulador...",
      "Extraindo dados com Playwright...",
      "Calculando respostas...",
      "Preenchendo simulador...",
      "Gerando screenshot...",
      "Criando resumo didático...",
    ];
    let stepIdx = 0;
    const stepInterval = setInterval(() => {
      stepIdx = (stepIdx + 1) % steps.length;
      setLoadingStep(steps[stepIdx]);
    }, 4000);

    try {
      // Step 1: Start the job (returns immediately)
      const startRes = await fetch("/api/solve/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, userName, model: selectedModel }),
      });

      if (!startRes.ok) {
        throw new Error(`HTTP ${startRes.status}: ${startRes.statusText}`);
      }

      const startData = await startRes.json();
      const jobId = startData.id;

      if (!jobId) {
        throw new Error("No job ID returned from server");
      }

      // Step 2: Poll for result every 3 seconds
      const MAX_POLLS = 80; // 80 * 3s = 240s max
      let pollCount = 0;

      const pollForResult = async (): Promise<any> => {
        pollCount++;
        if (pollCount > MAX_POLLS) {
          throw new Error("E_POLL_TIMEOUT");
        }

        await new Promise((r) => setTimeout(r, 3000));

        const statusRes = await fetch(`/api/solve/status?id=${jobId}`);
        if (!statusRes.ok) {
          throw new Error(`Status check failed: HTTP ${statusRes.status}`);
        }

        const statusData = await statusRes.json();

        if (statusData.complete) {
          return statusData;
        }

        // Update loading step with progress
        setLoadingStep(`Aguardando solver... (${pollCount * 3}s)`);

        return pollForResult();
      };

      const data = await pollForResult();
      clearInterval(stepInterval);

      const isCorrect = data.resultado?.includes("CORRETO");

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: isCorrect
          ? `✅ **Resolvido com sucesso!** O simulador foi resolvido corretamente.`
          : `❌ **Resultado:** ${data.resultado || "Incorreto"}`,
        result: data,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      toast.success(isCorrect ? "Correto!" : "Verifique o resultado");
    } catch (error: any) {
      clearInterval(stepInterval);

      const isTimeout = error.message?.includes("E_POLL_TIMEOUT");
      const errorCode = isTimeout ? "E_POLL_TIMEOUT" : "E_FETCH_ERROR";

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: `❌ **Erro ao resolver o simulador.**`,
        result: {
          success: false,
          simulatorType: "",
          enunciado: "",
          variaveis: {},
          calculos: "",
          respostas: [],
          respostasCorretas: {},
          resultado: "ERRO",
          metodo: "",
          screenshotUrl: null,
          errors: [errorCode],
          technicalDetail: isTimeout
            ? "Solver excedeu 240s de espera. O processo pode ter travado."
            : error.message,
          error: error.message,
        },
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      toast.error("Erro — veja detalhes técnicos");
    } finally {
      setIsLoading(false);
      setLoadingStep("");
      inputRef.current?.focus();
    }
  };

  const handleDeleteHistory = async (id: string) => {
    try {
      await fetch("/api/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setHistory((prev) => prev.filter((h) => h.id !== id));
    } catch {}
  };

  const renderErrorDetail = (result: SolverResult) => {
    if (!result.errors || result.errors.length === 0) return null;

    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-4 h-4" />
            Detalhes Técnicos do Erro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.errors.map((code) => {
            const info = ERROR_EXPLANATIONS[code];
            if (!info) return null;
            return (
              <div key={code} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="font-mono text-xs">
                    {code}
                  </Badge>
                  <span className="text-sm font-semibold text-destructive">
                    {info.title}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground ml-2">{info.desc}</p>
                <p className="text-xs text-emerald-400 ml-2">
                  💡 {info.fix}
                </p>
              </div>
            );
          })}
          {result.technicalDetail && (
            <div className="mt-2 p-2 rounded bg-black/30 border border-border">
              <p className="text-[10px] font-mono text-muted-foreground break-all">
                {result.technicalDetail}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderResult = (result: SolverResult) => {
    const isCorrect = result.resultado?.includes("CORRETO");
    return (
      <div className="mt-4 space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2 flex-wrap">
          {isCorrect ? (
            <Badge className="bg-emerald-900/50 text-emerald-400 border-emerald-800">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              CORRETO
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="w-3 h-3 mr-1" />
              {result.resultado}
            </Badge>
          )}
          <Badge variant="outline" className="border-purple-800 text-purple-300">
            <FlaskConical className="w-3 h-3 mr-1" />
            {result.simulatorType === "physics_aviary" ? "Physics Aviary" : "Genérico"}
          </Badge>
          <Badge variant="secondary" className="bg-purple-900/30 text-purple-300">
            <Zap className="w-3 h-3 mr-1" />
            {result.metodo}
          </Badge>
          {result.model && (
            <Badge variant="secondary" className="bg-violet-900/30 text-violet-300">
              🤖 {result.model}
            </Badge>
          )}
        </div>

        {/* Screenshot */}
        {result.screenshotUrl && (
          <Card className="overflow-hidden border-purple-900/30 bg-card glow-purple">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-purple-300">
                <ImageIcon className="w-4 h-4" />
                Screenshot do Resultado
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <img
                src={result.screenshotUrl}
                alt="Screenshot do simulador resolvido"
                className="w-full rounded-md border border-purple-900/20"
              />
            </CardContent>
          </Card>
        )}

        {/* Respostas */}
        {result.respostas.length > 0 && (
          <Card className="border-purple-900/30 bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-purple-300">
                <Sparkles className="w-4 h-4" />
                Respostas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.respostas.map((resp, i) => {
                  const correctKey = `Answer${i + 1}`;
                  const correctVal = result.respostasCorretas?.[correctKey];
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border border-border"
                    >
                      <span className="text-sm text-muted-foreground">Campo {i + 1}</span>
                      <div className="text-right">
                        <span className="font-mono font-bold text-foreground">{resp}</span>
                        {correctVal !== undefined && (
                          <span className="text-[11px] text-muted-foreground ml-2">
                            (exato: {typeof correctVal === "number" ? correctVal.toPrecision(4) : correctVal})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cálculos / Resumo */}
        {result.calculos && (
          <Card className="border-purple-900/30 bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-purple-300">
                📝 Resumo da Resolução
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm prose-invert max-w-none">
                {result.calculos.split("\n").map((line, i) => {
                  if (line.startsWith("## "))
                    return <h3 key={i} className="text-purple-300 font-bold mt-4 mb-1 text-sm">{line.replace("## ", "")}</h3>;
                  if (line.startsWith("### "))
                    return <h4 key={i} className="text-violet-300 font-semibold mt-3 mb-1 text-sm">{line.replace("### ", "")}</h4>;
                  if (line.startsWith("**") && line.endsWith("**"))
                    return <strong key={i} className="text-purple-200">{line.replace(/\*\*/g, "")}</strong>;
                  if (line.startsWith("- ") || line.startsWith("* "))
                    return <li key={i} className="ml-4 text-sm text-muted-foreground">{line.replace(/^[-*]\s*/, "")}</li>;
                  if (line.startsWith("```"))
                    return null;
                  if (line.match(/^\d+\./))
                    return <li key={i} className="ml-4 text-sm list-decimal text-muted-foreground">{line.replace(/^\d+\.\s*/, "")}</li>;
                  return line ? <p key={i} className="text-sm leading-relaxed text-muted-foreground">{line}</p> : null;
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error details */}
        {renderErrorDetail(result)}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-purple-900/20 bg-background/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-900/30">
              <Skull className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight glow-text text-purple-100">
                p3pp4
              </h1>
              <p className="text-[10px] text-purple-400/60">
                AI Physics Solver
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Model selector */}
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-[130px] h-8 text-xs border-purple-900/30 bg-secondary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-purple-900/30">
                {AI_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    <span className="font-semibold">{m.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Settings */}
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 border-purple-900/30 text-purple-300 hover:bg-purple-900/20 h-8">
                  <Settings className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-xs">{userName}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-purple-900/30">
                <DialogHeader>
                  <DialogTitle className="text-purple-200">Configurações</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm font-medium text-purple-300">Seu nome (aparece no simulador)</label>
                    <Input
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="Seu nome"
                      className="mt-1 bg-secondary border-purple-900/30"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-purple-300">Modelo de IA</label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger className="mt-1 bg-secondary border-purple-900/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-purple-900/30">
                        {AI_MODELS.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            <div>
                              <span className="font-semibold">{m.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">{m.desc}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* History */}
            <Dialog open={showHistory} onOpenChange={(o) => { setShowHistory(o); if (o) loadHistory(); }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 border-purple-900/30 text-purple-300 hover:bg-purple-900/20 h-8">
                  <History className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-xs">Histórico</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-purple-900/30">
                <DialogHeader>
                  <DialogTitle className="text-purple-200">Histórico</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma resolução ainda</p>
                  ) : (
                    history.map((item) => (
                      <div key={item.id} className="flex items-start justify-between p-3 rounded-lg border border-purple-900/20 bg-muted/30">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.url}</p>
                          <p className="text-xs text-muted-foreground">{item.userName} · {new Date(item.createdAt).toLocaleString("pt-BR")}</p>
                          {item.resultado && (
                            <Badge variant={item.resultado.includes("CORRETO") ? "default" : "destructive"} className="mt-1 text-[10px]">
                              {item.resultado}
                            </Badge>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteHistory(item.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Chat */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-fuchsia-600 flex items-center justify-center shrink-0 mt-1 shadow-lg shadow-purple-900/20">
                  <Skull className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-purple-600/20 border border-purple-700/30 text-purple-100" : "bg-muted/50 border border-purple-900/10"}`}>
                {msg.role === "user" ? (
                  <p className="text-sm break-all">{msg.content}</p>
                ) : (
                  <div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed text-purple-100/90">
                      {msg.content.split("\n").map((line, i) => {
                        if (line.startsWith("**") && line.endsWith("**"))
                          return <strong key={i} className="text-purple-200">{line.replace(/\*\*/g, "")}</strong>;
                        if (line.startsWith("•"))
                          return <div key={i} className="ml-2 text-muted-foreground">{line}</div>;
                        return <span key={i}>{line}{i < msg.content.split("\n").length - 1 && <br />}</span>;
                      })}
                    </div>
                    {msg.result && renderResult(msg.result)}
                  </div>
                )}
                <p className="text-[10px] text-purple-400/30 mt-1.5">
                  {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-1 border border-purple-900/20">
                  <User className="w-4 h-4 text-purple-300" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-fuchsia-600 flex items-center justify-center shrink-0 shadow-lg shadow-purple-900/20">
                <Skull className="w-4 h-4 text-white" />
              </div>
              <div className="bg-muted/50 border border-purple-900/10 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  <div>
                    <p className="text-sm font-medium text-purple-200">{loadingStep || "Processando..."}</p>
                    <p className="text-[11px] text-muted-foreground">Isso pode levar 25-60 segundos</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-3 w-3/4 bg-purple-900/10" />
                  <Skeleton className="h-3 w-1/2 bg-purple-900/10" />
                  <Skeleton className="h-24 w-full bg-purple-900/10" />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="sticky bottom-0 border-t border-purple-900/20 bg-background/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <form onSubmit={(e) => { e.preventDefault(); handleSolve(); }} className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Cole aqui o link do simulador de física..."
                disabled={isLoading}
                className="pr-4 h-12 rounded-xl text-sm bg-secondary border-purple-900/30 placeholder:text-purple-400/30 focus:border-purple-500"
                type="text"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading || !inputUrl.trim()}
              className="h-12 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white shadow-lg shadow-purple-900/30 disabled:opacity-40"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </form>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-purple-400/30">
              p3pp4 · {selectedModel} · {userName}
            </p>
            <p className="text-[10px] text-purple-400/30">
              Powered by Z.AI + Playwright
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
