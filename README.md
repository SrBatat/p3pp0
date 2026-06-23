# p3pp4 🔮

**Physics Aviary Solver** — Resolução automática de simuladores de física usando IA (GLM/Z.AI).

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Python](https://img.shields.io/badge/Python-3-yellow?style=flat-square&logo=python)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)

## 🎯 Sobre

O **p3pp4** é um solver automático para simuladores do [Physics Aviary](https://physicsaviary.com/). Ele usa visão computacional (VLM) para analisar o simulador, identificar variáveis, calcular a resposta correta e submeter automaticamente — tudo com tema gótico dark.

### Simuladores Suportados

| Simulador | Descrição |
|-----------|-----------|
| **Universal Gravity** | Lei da Gravitação Universal de Newton |
| **Incline Acceleration** | Aceleração em planos inclinados |
| **Projectile Problem** | Lançamento de projéteis |
| **Force Table** | Tabela de forças vetoriais |
| **Friction Problem** | Problemas de atrito |

## ⚙️ Arquitetura

O sistema usa uma **arquitetura assíncrona** (start + polling) para evitar timeouts de gateway:

1. **POST `/api/solve/start`** — Inicia o job e retorna imediatamente um `jobId`
2. **GET `/api/solve/status?jobId=...`** — Frontend faz polling a cada 3s
3. **Python Solver** — Processa o simulador em background (screenshot → análise VLM → cálculo → submissão)

```
[Frontend] → POST /solve/start → [Job Queue]
     ↓                              ↓
  Polling (3s)              [Python physics_bot.py]
     ↓                              ↓
  GET /solve/status ←──── [Resultado pronto]
```

## 🚀 Instalação

```bash
# Clone o repositório
git clone https://github.com/SrBatat/p3pp0.git
cd p3pp0

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações

# Gere o client do Prisma
npx prisma generate

# Rode o projeto
npm run dev
```

## 🔧 Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Caminho do banco SQLite (ex: `file:./db/custom.db`) |

## 🛠️ Tech Stack

- **Frontend**: Next.js 16 + React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes (async polling)
- **Solver**: Python + Playwright + Z.AI SDK (GLM)
- **Database**: SQLite via Prisma ORM
- **Tema**: Gothic dark UI

## 📁 Estrutura do Projeto

```
p3pp4/
├── src/
│   ├── app/
│   │   ├── page.tsx              # UI principal (gótico dark)
│   │   ├── layout.tsx            # Layout global
│   │   ├── globals.css           # Estilos globais
│   │   └── api/
│   │       ├── solve/
│   │       │   ├── start/route.ts   # Inicia job assíncrono
│   │       │   └── status/route.ts  # Polling de status
│   │       └── history/route.ts     # Histórico de sessões
│   ├── components/ui/           # Componentes shadcn/ui
│   ├── hooks/                   # Custom hooks
│   └── lib/                     # Utilitários (db, utils)
├── scripts/
│   └── physics_bot.py           # Solver Python (IA + Playwright)
├── prisma/
│   └── schema.prisma            # Schema do banco de dados
├── public/                      # Assets estáticos
├── .env.example                 # Template de variáveis
└── .gitignore                   # Arquivos ignorados pelo git
```

## 📜 Licença

Projeto privado — todos os direitos reservados.
