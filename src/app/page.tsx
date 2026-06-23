"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
  ChevronDown,
  Sparkles,
  ImageIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface SolverResult {
  id?: string;
  success: boolean;
  simulatorType: string;
  enunciado: string;
  variaveis: Record<string, any>;
  calculos: string;
  respostas: string[];
  respostasCorretas: Record<string, any>;
  resultado: string;
  metodo: string;
  screenshotUrl: string | null;
  error?: string;
}

interface HistoryItem {
  id: string;
  url: string;
  userName: string;
  status: string;
  resultado: string | null;
  enunciado: string | null;
  calculos: string | null;
  screenshotUrl: string | null;
  metodo: string | null;
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
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Welcome message
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Olá! 👋 Sou o **PhysicsSolver AI**. Cole o link de um simulador de física e eu resolvo para você automaticamente!\n\n• 🔬 Analiso o simulador\n• 🧮 Calculo as respostas\n• 📸 Gero screenshot com seu nome\n• 📝 Explico o passo a passo",
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
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch {}
  };

  const handleSolve = async () => {
    if (!inputUrl.trim() || !inputUrl.startsWith("http")) {
      toast.error("Cole uma URL válida do simulador");
      return;
    }

    const url = inputUrl.trim();
    setInputUrl("");

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: url,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, userName }),
      });

      const data: SolverResult = await res.json();

      if (data.success) {
        const isCorrect = data.resultado.includes("CORRETO");

        const assistantMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: isCorrect
            ? `✅ **Resolvido com sucesso!** O simulador foi resolvido corretamente.`
            : `⚠️ **Resultado:** ${data.resultado}`,
          result: data,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        toast.success(
          isCorrect ? "Simulador resolvido corretamente!" : "Verifique o resultado"
        );
      } else {
        const errorMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: `❌ **Erro ao resolver:** ${data.error || "Erro desconhecido"}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        toast.error("Erro ao resolver o simulador");
      }
    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: `❌ **Erro de conexão:** Não foi possível conectar ao solver. Tente novamente.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      toast.error("Erro de conexão");
    } finally {
      setIsLoading(false);
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
      toast.success("Item removido");
    } catch {}
  };

  const renderResult = (result: SolverResult) => {
    const isCorrect = result.resultado.includes("CORRETO");
    return (
      <div className="mt-4 space-y-4">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {isCorrect ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              CORRETO
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="w-3 h-3 mr-1" />
              {result.resultado}
            </Badge>
          )}
          <Badge variant="outline">
            <FlaskConical className="w-3 h-3 mr-1" />
            {result.simulatorType === "physics_aviary"
              ? "Physics Aviary"
              : "Genérico"}
          </Badge>
          <Badge variant="secondary">{result.metodo}</Badge>
        </div>

        {/* Screenshot */}
        {result.screenshotUrl && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Screenshot do Resultado
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <img
                src={result.screenshotUrl}
                alt="Screenshot do simulador resolvido"
                className="w-full rounded-md border"
              />
            </CardContent>
          </Card>
        )}

        {/* Respostas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
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
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                  >
                    <span className="text-sm text-muted-foreground">
                      Campo {i + 1}
                    </span>
                    <div className="text-right">
                      <span className="font-mono font-semibold">{resp}</span>
                      {correctVal !== undefined && (
                        <span className="text-xs text-muted-foreground ml-2">
                          (correto: {typeof correctVal === "number" ? correctVal.toPrecision(4) : correctVal})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Cálculos / Resumo */}
        {result.calculos && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                📝 Resumo da Resolução
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {result.calculos.split("\n").map((line, i) => {
                  if (line.startsWith("**") || line.startsWith("## ")) {
                    return (
                      <h4 key={i} className="font-semibold mt-3 mb-1">
                        {line.replace(/\*\*/g, "").replace(/##\s*/, "")}
                      </h4>
                    );
                  }
                  if (line.startsWith("- ") || line.startsWith("* ")) {
                    return (
                      <li key={i} className="ml-4 text-sm">
                        {line.replace(/^[-*]\s*/, "")}
                      </li>
                    );
                  }
                  if (line.match(/^\d+\./)) {
                    return (
                      <li key={i} className="ml-4 text-sm list-decimal">
                        {line.replace(/^\d+\.\s*/, "")}
                      </li>
                    );
                  }
                  return line ? (
                    <p key={i} className="text-sm leading-relaxed">
                      {line}
                    </p>
                  ) : null;
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Link para o simulador */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ExternalLink className="w-3 h-3" />
          <a
            href={result.enunciado ? "#" : "#"}
            className="hover:underline"
            onClick={() => window.open(messages.find(m => m.result === result)?.content || "#", "_blank")}
          >
            Abrir simulador original
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">PhysicsSolver AI</h1>
              <p className="text-xs text-muted-foreground">
                Resolva simuladores automaticamente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Name Dialog */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">{userName}</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Configurações</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm font-medium">Seu nome (aparece no simulador)</label>
                    <Input
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="Seu nome"
                      className="mt-1"
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* History Dialog */}
            <Dialog
              open={showHistory}
              onOpenChange={(open) => {
                setShowHistory(open);
                if (open) loadHistory();
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <History className="w-4 h-4" />
                  <span className="hidden sm:inline">Histórico</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Histórico de Resoluções</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma resolução ainda
                    </p>
                  ) : (
                    history.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between p-3 rounded-lg border"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.url}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.userName} ·{" "}
                            {new Date(item.createdAt).toLocaleString("pt-BR")}
                          </p>
                          {item.resultado && (
                            <Badge
                              variant={
                                item.resultado.includes("CORRETO")
                                  ? "default"
                                  : "destructive"
                              }
                              className="mt-1 text-xs"
                            >
                              {item.resultado}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => handleDeleteHistory(item.id)}
                        >
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

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.role === "user" ? (
                  <p className="text-sm break-all">{msg.content}</p>
                ) : (
                  <div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {msg.content.split("\n").map((line, i) => {
                        if (line.startsWith("**") && line.endsWith("**")) {
                          return (
                            <strong key={i}>
                              {line.replace(/\*\*/g, "")}
                            </strong>
                          );
                        }
                        if (line.startsWith("•")) {
                          return (
                            <div key={i} className="ml-2">
                              {line}
                            </div>
                          );
                        }
                        return (
                          <span key={i}>
                            {line}
                            {i < msg.content.split("\n").length - 1 && <br />}
                          </span>
                        );
                      })}
                    </div>
                    {msg.result && renderResult(msg.result)}
                  </div>
                )}
                <p className="text-[10px] opacity-50 mt-1">
                  {msg.timestamp.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Analisando simulador...</p>
                    <p className="text-xs text-muted-foreground">
                      Extraindo dados, calculando e resolvendo
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-32 w-full" />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="sticky bottom-0 border-t bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSolve();
            }}
            className="flex gap-2"
          >
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Cole aqui o link do simulador de física..."
                disabled={isLoading}
                className="pr-4 h-12 rounded-xl text-sm"
                type="url"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading || !inputUrl.trim()}
              className="h-12 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            PhysicsSolver AI · Powered by Z.AI (GLM) + Playwright · Nome: {userName}
          </p>
        </div>
      </footer>
    </div>
  );
}
