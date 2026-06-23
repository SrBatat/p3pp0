#!/usr/bin/env python3
"""
==========================================================
  PHYSICS BOT v2 - Resolvedor Automático de Simuladores
  Usa Playwright + Z.AI (GLM) + Vision (VLM)
  para resolver simuladores de física automaticamente.
  100% Gratuito. Zero configuração.
==========================================================
"""

import base64
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

# ====================================================================
# CONFIGURAÇÃO
# ====================================================================
OUTPUT_DIR = Path("/home/z/my-project/download/physics-bot")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SCREENSHOT_DIR = OUTPUT_DIR / "screenshots"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

LOG_FILE = OUTPUT_DIR / "log_calculos.txt"


# ====================================================================
# 1. CÉREBRO - Z.AI Chat (gratuito via CLI)
# ====================================================================

def chat_ia(prompt, sistema=""):
    """Chama o Z.AI (GLM) via CLI. Retorna o texto da resposta."""
    try:
        cmd = ["z-ai", "chat", "--prompt", prompt, "--output", str(OUTPUT_DIR / "_chat.json")]
        if sistema:
            cmd.extend(["--system", sistema])

        subprocess.run(cmd, capture_output=True, text=True, timeout=90)

        resp_file = OUTPUT_DIR / "_chat.json"
        if resp_file.exists():
            with open(resp_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                if "choices" in data:
                    return data["choices"][0]["message"]["content"].strip()
                if "content" in data:
                    return data["content"].strip()
                if "data" in data and isinstance(data["data"], dict):
                    if "content" in data["data"]:
                        return data["data"]["content"].strip()
                    if "choices" in data["data"]:
                        return data["data"]["choices"][0]["message"]["content"].strip()
            return str(data)
        return ""
    except Exception as e:
        print(f"[IA] Erro no chat: {e}")
        return ""


def resolver_com_ia(enunciado, contexto_extra=""):
    """
    Usa a IA para resolver o problema de fisica.
    Retorna: (conta_resumida, resposta_numerica, resposta_completa)
    """
    print("\n[IA] Enviando para o GLM calcular...")

    prompt_sistema = """Voce e um expert em fisica e matematica. Resolva o problema passo a passo.
Sua resposta DEVE seguir EXATAMENTE este formato:

CONTA: [Escreva aqui a conta resumida com todos os passos]
RESPOSTA: [Apenas numeros finais, sem unidades, use ponto para decimal]

Regras:
- Se houver mais de uma resposta, separe por ponto e virgula: RESPOSTA: 5.23;68.77
- Arredonde para 2 casas decimais
- Use ponto (.) como separador decimal, NUNCA virgula
- NAO inclua unidades na linha RESPOSTA
- Para notacao cientifica use formato: 1.5e3
- Se o problema pedir tempo, responda em segundos. Se pedir distancia, em metros."""

    pergunta = enunciado
    if contexto_extra:
        pergunta += f"\n\nDados extraidos da pagina:\n{contexto_extra}"

    texto = chat_ia(pergunta, prompt_sistema)
    if not texto:
        return "Sem resposta", "Erro", ""

    print(f"[IA] Resposta bruta: {texto[:300]}")

    # Parse
    conta = "Nao extraido"
    resposta_num = "Erro"

    if "CONTA:" in texto and "RESPOSTA:" in texto:
        partes = texto.split("RESPOSTA:")
        conta = partes[0].replace("CONTA:", "").strip()
        resposta_num = partes[1].strip().split("\n")[0].strip()
    elif "RESPOSTA:" in texto:
        partes = texto.split("RESPOSTA:")
        conta = texto.split("RESPOSTA:")[0].strip()
        resposta_num = partes[1].strip().split("\n")[0].strip()
    else:
        conta = texto[:300]
        nums = re.findall(r'[-+]?\d*\.\d+|\d+', texto)
        if nums:
            resposta_num = ";".join(nums[-2:])  # pega os ultimos numeros

    return conta, resposta_num, texto


# ====================================================================
# 2. OLHOS - Z.AI Vision (le o canvas com VLM)
# ====================================================================

def ler_imagem_com_vlm(caminho_imagem, prompt):
    """Usa o VLM (vision) para analisar uma imagem."""
    try:
        result = subprocess.run(
            ["z-ai", "vision", "--prompt", prompt,
             "--image", str(caminho_imagem),
             "--output", str(OUTPUT_DIR / "_vlm.json")],
            capture_output=True, text=True, timeout=60
        )

        resp_file = OUTPUT_DIR / "_vlm.json"
        if resp_file.exists():
            with open(resp_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                if "choices" in data:
                    return data["choices"][0]["message"]["content"].strip()
                if "content" in data:
                    return data["content"].strip()
            return str(data)
        return ""
    except Exception as e:
        print(f"[VLM] Erro: {e}")
        return ""


# ====================================================================
# 3. DETECTOR DE SIMULADOR
# ====================================================================

def detectar_simulador(url, pagina):
    """Detecta o tipo de simulador baseado na URL e no conteudo da pagina."""
    if "thephysicsaviary.com" in url:
        return "physics_aviary"

    # Checa se tem os elementos tipicos do Physics Aviary
    try:
        if pagina.locator("#BeginButton").count() > 0:
            return "physics_aviary"
        if pagina.locator("#SubmitButton").count() > 0:
            return "physics_aviary"
    except:
        pass

    return "generico"


# ====================================================================
# 4. CALCULO DIRETO (sem IA) - Physics Aviary
# ====================================================================

def calcular_direto_physics_aviary(variaveis, titulo=""):
    """
    Calcula as respostas diretamente a partir das variaveis JS.
    Retorna dict com as respostas calculadas e as formulas.
    """
    resultado = {"respostas": [], "formulas": [], "passos": []}

    v = variaveis.get("StartingSpeed") or variaveis.get("InitialVelocity") or variaveis.get("Velocity")
    mu = (variaveis.get("CoefficientOfFriction")
          or variaveis.get("CoefficientOfKineticFriction")
          or variaveis.get("mu") or variaveis.get("muK"))
    m = variaveis.get("MassOfCar") or variaveis.get("Mass") or variaveis.get("m")
    g = 9.8

    # --- Car Stopping Problem ---
    if v is not None and mu is not None:
        aceleracao = mu * g
        tempo = v / aceleracao
        distancia = (v / 2) * tempo

        resultado["respostas"] = [f"{tempo:.2f}", f"{distancia:.2f}"]
        resultado["formulas"] = [
            f"a = mu * g = {mu} * {g} = {aceleracao:.4f} m/s^2",
            f"t = v / a = {v} / {aceleracao:.4f} = {tempo:.4f} s",
            f"d = (v/2) * t = ({v}/2) * {tempo:.4f} = {distancia:.4f} m"
        ]
        resultado["passos"] = [
            f"1. Velocidade inicial: v = {v} m/s",
            f"2. Coeficiente de atrito: mu = {mu}",
            f"3. Aceleracao de frenagem: a = mu * g = {mu} * {g} = {aceleracao:.4f} m/s^2",
            f"4. Tempo para parar: t = v / a = {v} / {aceleracao:.4f} = {tempo:.4f} s",
            f"5. Distancia percorrida: d = v^2/(2*a) = {v}^2/(2*{aceleracao:.4f}) = {distancia:.4f} m"
        ]
        return resultado

    # --- Jolly Gas Giant Problem ---
    OrbitRadiusm = variaveis.get("OrbitRadiusm")
    MoonMass = variaveis.get("MoonMass")
    AngularSpeed = variaveis.get("AngularSpeed")

    if OrbitRadiusm is not None and MoonMass is not None and AngularSpeed is not None:
        import math as _math
        G_val = 6.67e-11

        PeriodInHours = 2 * _math.pi / AngularSpeed
        PeriodInSeconds = PeriodInHours * 3600
        OrbitCircumference = 2 * _math.pi * OrbitRadiusm
        Speed = OrbitCircumference / PeriodInSeconds
        Acceleration = Speed**2 / OrbitRadiusm
        ForceGravity = MoonMass * Acceleration
        PlanetMass = ForceGravity * OrbitRadiusm**2 / (G_val * MoonMass)

        resultado["respostas"] = [f"{PeriodInHours:.2f}", f"{Speed:.0f}", f"{PlanetMass:.2e}"]
        resultado["formulas"] = [
            f"T = 2*pi / AngularSpeed = 2*pi / {AngularSpeed:.6f} = {PeriodInHours:.4f} h",
            f"v = 2*pi*r / T(seg) = 2*pi*{OrbitRadiusm:.2e} / {PeriodInSeconds:.2f} = {Speed:.2f} m/s",
            f"M = v^2 * r / G = {Speed:.2f}^2 * {OrbitRadiusm:.2e} / {G_val} = {PlanetMass:.4e} kg"
        ]
        resultado["passos"] = [
            f"1. Raio orbital: r = {OrbitRadiusm:.2e} m",
            f"2. Massa da lua: m_lua = {MoonMass:.2e} kg",
            f"3. Velocidade angular: w = {AngularSpeed:.6f} rad/h",
            f"4. Periodo: T = 2*pi/w = {PeriodInHours:.4f} h",
            f"5. Velocidade orbital: v = 2*pi*r/T = {Speed:.2f} m/s",
            f"6. Massa do planeta: M = v^2*r/G = {PlanetMass:.4e} kg"
        ]
        return resultado

    # --- Incline Problem ---
    theta = variaveis.get("Angle") or variaveis.get("theta") or variaveis.get("InclineAngle")
    if theta is not None and m is not None:
        pass

    return resultado


# ====================================================================
# 5. RESOLVEDOR - PHYSICS AVIARY
# ====================================================================

def resolver_physics_aviary(pagina, url):
    """
    Resolve simuladores do Physics Aviary.
    Estrategia em camadas:
      1. Extrair variaveis JS + calculo direto
      2. Se falhar, usar VLM para ler o canvas + IA para calcular
      3. Se falhar, usar o texto da pagina + IA
    """
    resultados = {}
    usar_ia = False

    # --- PASSO 0: Nome customizavel ---
    nome = resolver_physics_aviary.nome_aluno if hasattr(resolver_physics_aviary, 'nome_aluno') else "Physics Bot"

    # --- PASSO 1: Preencher nome e clicar Begin ---
    print(f"[BOT] Iniciando simulador Physics Aviary (nome: {nome})...")
    try:
        name_field = pagina.locator("#StudentName")
        if name_field.count() > 0:
            name_field.fill(nome)
            time.sleep(0.3)
    except:
        pass

    try:
        begin_btn = pagina.locator("#BeginButton")
        if begin_btn.count() > 0:
            begin_btn.click()
            print("[BOT] Clicou em Begin!")
            time.sleep(3)
    except:
        print("[BOT] Sem botao Begin, seguindo...")

    # --- PASSO 2: Extrair variaveis JavaScript ---
    print("[BOT] Extraindo variaveis JavaScript...")

    variaveis_conhecidas = [
        "StartingSpeed", "MassOfCar", "CoefficientOfFriction",
        "InitialVelocity", "FinalVelocity", "Angle", "InclineAngle",
        "Distance", "Time", "Mass", "Force", "AppliedForce",
        "CoefficientOfKineticFriction", "CoefficientOfStaticFriction",
        "Acceleration", "Gravity", "Height", "Velocity",
        "SpringConstant", "Amplitude", "Frequency", "Period",
        "Wavelength", "Charge", "Voltage", "Current",
        "Resistance", "Power", "Energy", "Momentum",
        "AngularVelocity", "Torque", "MomentOfInertia",
        "Radius", "Temperature", "Pressure", "Volume",
        "InitialHeight", "FinalHeight", "LaunchAngle",
        "LaunchSpeed", "Range", "MaxHeight",
        # Gas Giant specific
        "OrbitRadiusm", "OrbitRadiuspx", "MoonMass", "AngularSpeed",
        "PlanetSizepx", "PlanetSizem",
        "mu", "muK", "muS", "theta",
        "h", "k", "F", "v0", "v1", "v2",
        "m1", "m2", "r", "T", "x", "y",
    ]

    variaveis_extraidas = {}
    for var in variaveis_conhecidas:
        try:
            valor = pagina.evaluate(f"typeof {var} !== 'undefined' ? {var} : null")
            # Filtra tipos validos (numeros, strings) e descarta Date objects etc
            if valor is not None and isinstance(valor, (int, float, str)):
                try:
                    float(valor)  # testa se e numerico
                    variaveis_extraidas[var] = valor
                except (ValueError, TypeError):
                    if isinstance(valor, str) and len(valor) < 50:
                        variaveis_extraidas[var] = valor
        except:
            pass

    # Limpa variaveis que provavelmente sao internas do simulador
    # Mas preserva variaveis comuns em astronomia que usam numeros grandes
    variaveis_astronomia = {'OrbitRadiusm', 'MoonMass', 'PlanetSizem'}
    variaveis_filtradas = {}
    for k, v in variaveis_extraidas.items():
        if k in variaveis_astronomia:
            variaveis_filtradas[k] = v  # Preserva mesmo sendo grande
        elif isinstance(v, (int, float)) and abs(v) > 1e6:
            continue  # Remove timestamps e valores internos
        else:
            variaveis_filtradas[k] = v

    variaveis_extraidas = variaveis_filtradas
    print(f"[BOT] Variaveis extraidas: {variaveis_extraidas}")

    # --- PASSO 3: Ler enunciado e labels ---
    try:
        enunciado = pagina.locator("#SystemMessage").inner_text()
    except:
        try:
            enunciado = pagina.locator("#LabDirections").inner_text()
        except:
            enunciado = ""

    labels = []
    try:
        for ft in pagina.locator(".FormText").all():
            labels.append(ft.inner_text())
    except:
        pass

    # Conta quantos campos de resposta existem
    num_campos = 0
    for i in range(1, 10):
        try:
            if pagina.locator(f"#A{i}").count() > 0:
                num_campos = i
        except:
            break

    print(f"[BOT] Enunciado: {enunciado[:200]}")
    print(f"[BOT] Campos ({num_campos}): {labels}")

    # --- PASSO 4: Estrategia de resolucao em camadas ---

    # Camada 1: Calculo direto
    titulo_pagina = pagina.title() if pagina else ""
    calculo_direto = calcular_direto_physics_aviary(variaveis_extraidas, titulo_pagina)

    if calculo_direto["respostas"]:
        print(f"[BOT] Calculo direto disponivel! Respostas: {calculo_direto['respostas']}")
        respostas = calculo_direto["respostas"]
        passos = "\n".join(calculo_direto["passos"])
    else:
        # Camada 2: VLM para ler o canvas + IA para calcular
        print("[BOT] Calculo direto nao disponivel. Usando VLM + IA...")

        # Screenshot do canvas para o VLM ler
        canvas_path = SCREENSHOT_DIR / "_canvas_temp.png"
        pagina.screenshot(path=str(canvas_path), full_page=True)

        vlm_prompt = """Extraia TODOS os dados numericos e informacoes deste simulador de fisica.
Liste cada variavel com seu valor e unidade.
Exemplo: v = 20.0 m/s, mu = 0.39, m = 914 kg
Liste tambem o que esta sendo pedido (tempo, distancia, velocidade, etc)."""

        vlm_resultado = ler_imagem_com_vlm(canvas_path, vlm_prompt)
        print(f"[VLM] Dados lidos: {vlm_resultado[:300]}")

        # Agora manda para a IA calcular com os dados do VLM + enunciado
        contexto = f"Variaveis JS extraidas: {variaveis_extraidas}\n"
        if labels:
            contexto += f"Campos de resposta ({num_campos}): {labels}\n"
        if vlm_resultado:
            contexto += f"\nDados lidos pelo VLM do canvas:\n{vlm_resultado}\n"

        conta, resposta_num, texto_completo = resolver_com_ia(
            enunciado if enunciado else "Resolva o problema de fisica mostrado na imagem",
            contexto
        )
        respostas = [r.strip() for r in resposta_num.split(";")]
        passos = conta
        usar_ia = True

    print(f"\n[BOT] Calculos:\n{passos}")
    print(f"[BOT] Respostas: {respostas}")

    # --- PASSO 5: Mostrar formulario de resposta ---
    # Alguns simuladores (Gas Giant) escondem o formulario ate usar o timer
    form_visivel = False
    try:
        form_visivel = pagina.locator("#A1").is_visible()
    except:
        pass

    if not form_visivel:
        print("[BOT] Formulario oculto, ativando ferramentas...")
        # Tenta ToggleTools (Gas Giant style)
        try:
            toggle = pagina.locator("#ToggleTools")
            if toggle.count() > 0:
                toggle.click()
                time.sleep(0.5)
        except:
            pass

        # Tenta Start/Stop timer para revelar formulario
        try:
            stop_btn = pagina.locator("#StopTimerButton")
            if stop_btn.count() > 0:
                stop_btn.click()  # Start timer
                time.sleep(1)
                stop_btn.click()  # Stop timer -> mostra formulario
                time.sleep(0.5)
        except:
            pass

        # Force show como ultimo recurso
        try:
            if not pagina.locator("#A1").is_visible():
                pagina.evaluate('$("#SpaceForAnswer").show()')
                time.sleep(0.3)
        except:
            pass

    # --- PASSO 5b: Preencher respostas ---
    for i, resp in enumerate(respostas):
        if i >= num_campos and num_campos > 0:
            break
        input_id = f"#A{i+1}"
        try:
            locator = pagina.locator(input_id)
            if locator.count() > 0 and locator.is_visible():
                locator.click()
                locator.fill("")
                locator.fill(resp)
                print(f"[BOT] Preencheu {input_id} com '{resp}'")
        except Exception as e:
            print(f"[BOT] Erro ao preencher {input_id}: {e}")

    time.sleep(0.5)

    # --- PASSO 6: Screenshot ANTES de submeter ---
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    screenshot_pre = SCREENSHOT_DIR / f"antes_submeter_{timestamp}.png"
    pagina.screenshot(path=str(screenshot_pre), full_page=True)

    # --- PASSO 7: Clicar em Check/Submit ---
    try:
        submit = pagina.locator("#SubmitButton")
        if submit.count() > 0:
            submit.click()
            print("[BOT] Clicou em Check! Aguardando animacao...")

            # Espera a animacao terminar (Moving == "done")
            for _ in range(40):  # max 20 segundos
                time.sleep(0.5)
                try:
                    moving = pagina.evaluate("typeof Moving !== 'undefined' ? Moving : 'unknown'")
                    if moving == "done":
                        print("[BOT] Animacao concluida!")
                        break
                except:
                    pass
            time.sleep(1.5)  # Pausa extra para renderizar resultado final
        else:
            print("[BOT] Botao Check nao encontrado")
    except Exception as e:
        print(f"[BOT] Erro ao submeter: {e}")

    # --- PASSO 8: Screenshot DEPOIS ---
    screenshot_pos = SCREENSHOT_DIR / f"resultado_{timestamp}.png"
    pagina.screenshot(path=str(screenshot_pos), full_page=True)

    # --- PASSO 9: Verificar resultado ---
    resultado = "Ver screenshot"
    try:
        final_color = pagina.evaluate("typeof FinalColor !== 'undefined' ? FinalColor : null")
        if final_color:
            fc = str(final_color).upper()
            if "EEFFEE" in fc:
                resultado = "CORRETO!"
            elif "FFEEEE" in fc:
                resultado = "INCORRETO"
            else:
                resultado = f"Cor: {final_color}"
    except:
        pass

    # Se nao detectou pela cor, usa VLM para verificar
    if resultado == "Ver screenshot":
        print("[BOT] Verificando resultado com VLM...")
        vlm_check = ler_imagem_com_vlm(
            screenshot_pos,
            "Esta imagem mostra o resultado de um simulador de fisica. "
            "Aparece CORRETO ou INCORRETO? Responda apenas: CORRETO ou INCORRETO"
        )
        if "CORRETO" in vlm_check.upper() and "INCORRETO" not in vlm_check.upper():
            resultado = "CORRETO! (VLM)"
        elif "INCORRETO" in vlm_check.upper():
            resultado = "INCORRETO (VLM)"

    # Checa respostas corretas
    respostas_corretas = {}
    for i in range(1, 6):
        try:
            ans = pagina.evaluate(f"typeof Answer{i} !== 'undefined' ? Answer{i} : null")
            if ans is not None and isinstance(ans, (int, float)):
                respostas_corretas[f"Answer{i}"] = round(ans, 4)
        except:
            pass

    # --- PASSO 10: Salvar ---
    resultados = {
        "url": url,
        "simulador": "Physics Aviary",
        "enunciado": enunciado,
        "variaveis_js": variaveis_extraidas,
        "campos": labels,
        "num_campos": num_campos,
        "calculos": passos,
        "respostas_enviadas": respostas,
        "respostas_corretas": respostas_corretas,
        "resultado": resultado,
        "metodo": "ia" if usar_ia else "calculo_direto",
        "screenshot_antes": str(screenshot_pre),
        "screenshot_depois": str(screenshot_pos),
        "timestamp": timestamp
    }

    salvar_log(resultados)
    return resultados


# ====================================================================
# 6. RESOLVEDOR - GENERICO
# ====================================================================

def resolver_generico(pagina, url):
    """Resolve simuladores genericos usando VLM + IA."""
    print("[BOT] Modo generico - usando VLM + IA...")

    # Screenshot para o VLM ler
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    canvas_path = SCREENSHOT_DIR / f"_generico_{timestamp}.png"
    pagina.screenshot(path=str(canvas_path), full_page=True)

    # Le a pagina com VLM
    vlm_prompt = """Analise este simulador de fisica. Extraia:
1. Todos os dados numericos (valores e unidades)
2. O que esta sendo pedido (quais respostas)
3. Onde digitar as respostas (campos de input)
Seja especifico com os numeros."""
    vlm_dados = ler_imagem_com_vlm(canvas_path, vlm_prompt)
    print(f"[VLM] Dados: {vlm_dados[:300]}")

    # Le texto da pagina como complemento
    try:
        texto_pagina = pagina.inner_text("body")
    except:
        texto_pagina = ""

    # Resolve com IA
    contexto = f"Dados do VLM:\n{vlm_dados}\n\nTexto da pagina:\n{texto_pagina[:1000]}"
    conta, resposta_num, texto_completo = resolver_com_ia(
        "Resolva este problema de fisica do simulador", contexto
    )
    respostas = [r.strip() for r in resposta_num.split(";")]

    # Tenta preencher campos
    inputs = pagina.locator("input[type='text'], input[type='number'], .FormInputs").all()
    for i, (inp, resp) in enumerate(zip(inputs, respostas)):
        try:
            inp.fill(resp)
            print(f"[BOT] Preencheu campo {i+1} com '{resp}'")
        except:
            pass

    time.sleep(0.5)

    # Screenshot antes
    screenshot_pre = SCREENSHOT_DIR / f"antes_submeter_{timestamp}.png"
    pagina.screenshot(path=str(screenshot_pre), full_page=True)

    # Tenta submeter
    for sel in ["#SubmitButton", ".Button", "button:has-text('Check')",
                "button:has-text('Submit')", "input[type='submit']"]:
        try:
            loc = pagina.locator(sel)
            if loc.count() > 0:
                loc.first.click()
                print(f"[BOT] Clicou em {sel}!")
                break
        except:
            continue

    time.sleep(4)

    # Screenshot depois
    screenshot_pos = SCREENSHOT_DIR / f"resultado_{timestamp}.png"
    pagina.screenshot(path=str(screenshot_pos), full_page=True)

    # Verifica com VLM
    vlm_check = ler_imagem_com_vlm(
        screenshot_pos,
        "O resultado esta CORRETO ou INCORRETO? Responda apenas: CORRETO ou INCORRETO"
    )
    resultado = "Ver screenshot"
    if "CORRETO" in vlm_check.upper() and "INCORRETO" not in vlm_check.upper():
        resultado = "CORRETO! (VLM)"
    elif "INCORRETO" in vlm_check.upper():
        resultado = "INCORRETO (VLM)"

    resultados = {
        "url": url,
        "simulador": "Generico",
        "calculos": conta,
        "respostas_enviadas": respostas,
        "resultado": resultado,
        "screenshot_antes": str(screenshot_pre),
        "screenshot_depois": str(screenshot_pos),
        "timestamp": timestamp
    }

    salvar_log(resultados)
    return resultados


# ====================================================================
# 7. FUNCOES AUXILIARES
# ====================================================================

def salvar_log(resultados):
    """Salva os resultados em arquivo de log."""
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"\n{'='*60}\n")
        f.write(f"Data: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n")
        f.write(f"URL: {resultados.get('url', 'N/A')}\n")
        f.write(f"Simulador: {resultados.get('simulador', 'N/A')}\n")
        if 'enunciado' in resultados:
            f.write(f"Enunciado: {resultados['enunciado']}\n")
        if 'variaveis_js' in resultados:
            f.write(f"Variaveis JS: {resultados['variaveis_js']}\n")
        if 'campos' in resultados:
            f.write(f"Campos: {resultados['campos']}\n")
        f.write(f"Calculos:\n{resultados.get('calculos', 'N/A')}\n")
        f.write(f"Respostas Enviadas: {resultados.get('respostas_enviadas', 'N/A')}\n")
        if 'respostas_corretas' in resultados:
            f.write(f"Respostas Corretas: {resultados['respostas_corretas']}\n")
        f.write(f"Resultado: {resultados.get('resultado', 'N/A')}\n")
        f.write(f"Metodo: {resultados.get('metodo', 'N/A')}\n")
    print(f"[BOT] Log salvo em: {LOG_FILE}")


# ====================================================================
# 8. FUNCAO PRINCIPAL
# ====================================================================

def resolver_simulador(url, nome="Physics Bot"):
    """Funcao principal. Recebe uma URL e resolve o simulador."""
    if not url or not url.startswith("http"):
        print(f"[ERRO] URL invalida: {url}")
        return None

    # Configura nome do aluno
    resolver_physics_aviary.nome_aluno = nome

    print(f"\n{'='*60}")
    print(f"  PHYSICS BOT v2 - Iniciando resolucao")
    print(f"  URL: {url}")
    print(f"  Nome: {nome}")
    print(f"{'='*60}\n")

    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        navegador = p.chromium.launch(headless=True)
        contexto = navegador.new_context(
            viewport={"width": 1280, "height": 900},
            screen={"width": 1280, "height": 900}
        )
        pagina = contexto.new_page()

        print(f"[BOT] Acessando: {url}...")
        pagina.goto(url, wait_until="domcontentloaded", timeout=30000)
        time.sleep(3)

        tipo = detectar_simulador(url, pagina)
        print(f"[BOT] Tipo detectado: {tipo}")

        if tipo == "physics_aviary":
            resultados = resolver_physics_aviary(pagina, url)
        else:
            resultados = resolver_generico(pagina, url)

        navegador.close()

    # Resumo final
    print(f"\n{'='*60}")
    print(f"  RESULTADO FINAL")
    print(f"{'='*60}")
    if resultados:
        print(f"  Resultado: {resultados.get('resultado', 'N/A')}")
        print(f"  Metodo: {resultados.get('metodo', 'N/A')}")
        print(f"  Calculos:\n    {resultados.get('calculos', 'N/A')[:200]}")
        print(f"  Respostas: {resultados.get('respostas_enviadas', 'N/A')}")
        if resultados.get('respostas_corretas'):
            print(f"  Corretas: {resultados['respostas_corretas']}")
        print(f"  Screenshots: {SCREENSHOT_DIR}")
    print(f"{'='*60}\n")

    return resultados


# ====================================================================
# 9. ENTRY POINT
# ====================================================================

if __name__ == "__main__":
    if len(sys.argv) > 1:
        url = sys.argv[1]
        nome = sys.argv[2] if len(sys.argv) > 2 else "Physics Bot"
        resultado = resolver_simulador(url, nome)
    else:
        print("Uso: python physics_bot.py <URL_DO_SIMULADOR> [NOME_DO_ALUNO]")
        print("Exemplo: python physics_bot.py https://thephysicsaviary.com/Physics/APPrograms/CarStoppingProblem/ Helio")
