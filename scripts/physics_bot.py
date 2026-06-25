#!/usr/bin/env python3
"""
==========================================================
  PHYSICS BOT v3 - Resolvedor Automático de Simuladores
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
            resposta_num = ";".join(nums[-2:])

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
    url_lower = url.lower()
    
    # Physics Aviary - check by URL patterns
    if "thephysicsaviary.com" in url_lower:
        return "physics_aviary"

    # Checa se tem os elementos tipicos do Physics Aviary
    try:
        if pagina.locator("#BeginButton").count() > 0:
            return "physics_aviary"
        if pagina.locator("#SubmitButton").count() > 0:
            return "physics_aviary"
        if pagina.locator("#StudentName").count() > 0:
            return "physics_aviary"
        if pagina.locator(".FormInputs").count() > 0:
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

    v = variaveis.get("StartingSpeed") or variaveis.get("InitialVelocity") or variaveis.get("Velocity") or variaveis.get("StartSpeed")
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
    theta = variaveis.get("Angle") or variaveis.get("theta") or variaveis.get("InclineAngle") or variaveis.get("AngleOfIncline") or variaveis.get("AngleinRad")
    mu_incline = variaveis.get("coefficientoffriction") or variaveis.get("CoefficientOfFriction") or variaveis.get("muK")
    m_slide = variaveis.get("SlidingMass") or variaveis.get("Mass")
    m_hang = variaveis.get("MassHanging")
    g = 9.8

    if theta is not None and mu_incline is not None and m_slide is not None and m_hang is not None:
        import math as _math2
        theta_rad = _math2.radians(theta) if theta > 3.14 else theta
        Fgx = m_slide * g * _math2.sin(theta_rad)
        Fn = m_slide * g * _math2.cos(theta_rad)
        Ff = mu_incline * Fn
        F_hang = m_hang * g
        if Fgx > F_hang:
            F_liq = Fgx - F_hang - Ff
        else:
            F_liq = F_hang - Fgx - Ff
        massa_total = m_slide + m_hang
        aceleracao = F_liq / massa_total
        T = m_hang * (g - aceleracao) if F_hang > Fgx else m_hang * (g + aceleracao)
        
        if Fgx > F_hang:
            aceleracao = -abs(aceleracao)
        else:
            aceleracao = abs(aceleracao)

        resultado["respostas"] = [f"{aceleracao:.2f}", f"{abs(T):.2f}"]
        resultado["formulas"] = [
            f"Fgx = m*g*sin(theta) = {m_slide}*{g}*sin({theta}) = {Fgx:.4f} N",
            f"Ff = mu*m*g*cos(theta) = {mu_incline}*{m_slide}*{g}*cos({theta}) = {Ff:.4f} N",
            f"F_hang = m_hang*g = {m_hang}*{g} = {F_hang:.4f} N",
            f"a = F_liq / (m1+m2) = {F_liq:.4f} / {massa_total} = {aceleracao:.4f} m/s^2",
            f"T = {abs(T):.4f} N"
        ]
        resultado["passos"] = [
            f"1. Angulo: theta = {theta} graus",
            f"2. Massa deslizante: m1 = {m_slide} kg",
            f"3. Massa pendurada: m2 = {m_hang} kg",
            f"4. Coeficiente de atrito: mu = {mu_incline}",
            f"5. Fgx = m1*g*sin(theta) = {Fgx:.4f} N",
            f"6. Ff = mu*m1*g*cos(theta) = {Ff:.4f} N",
            f"7. F_hang = m2*g = {F_hang:.4f} N",
            f"8. Aceleracao: a = {aceleracao:.4f} m/s^2",
            f"9. Tensao: T = {abs(T):.4f} N"
        ]
        return resultado

    # --- Friction to Projectile Problem ---
    StartSpeed = variaveis.get("StartSpeed") or variaveis.get("StartingSpeed")
    HeightOfLabTable = variaveis.get("HeightOfLabTable")
    TableDistance = variaveis.get("TableDistance")
    CoF = variaveis.get("CoefficientOfFriction")
    MassBox = variaveis.get("MassOfBox")
    GravField = variaveis.get("GravitationalField") or 9.8

    if CoF is not None and MassBox is not None and TableDistance is not None and HeightOfLabTable is not None:
        import math as _math3
        v0_sq = StartSpeed**2 - 2 * CoF * GravField * TableDistance if StartSpeed else None
        if v0_sq is not None and v0_sq > 0:
            launch_speed = _math3.sqrt(v0_sq)
        else:
            launch_speed = 0

        t_flight = _math3.sqrt(2 * HeightOfLabTable / GravField)
        d_horizontal = launch_speed * t_flight

        resultado["respostas"] = [f"{launch_speed:.2f}", f"{t_flight:.2f}", f"{d_horizontal:.2f}"]
        resultado["formulas"] = [
            f"v^2 = v0^2 - 2*mu*g*d = {StartSpeed}^2 - 2*{CoF}*{GravField}*{TableDistance} = {launch_speed:.4f} m/s",
            f"t = sqrt(2*h/g) = sqrt(2*{HeightOfLabTable}/{GravField}) = {t_flight:.4f} s",
            f"d = v*t = {launch_speed:.4f}*{t_flight:.4f} = {d_horizontal:.4f} m"
        ]
        resultado["passos"] = [
            f"1. Velocidade inicial: v0 = {StartSpeed:.4f} m/s",
            f"2. Atrito na mesa: mu = {CoF}",
            f"3. Distancia na mesa: d = {TableDistance} m",
            f"4. Velocidade na borda: v = sqrt(v0^2 - 2*mu*g*d) = {launch_speed:.4f} m/s",
            f"5. Altura da mesa: h = {HeightOfLabTable} m",
            f"6. Tempo de voo: t = sqrt(2h/g) = {t_flight:.4f} s",
            f"7. Distancia horizontal: d = v*t = {d_horizontal:.4f} m"
        ]
        return resultado

    # --- Universal Gravity Problem ---
    import math as _math4
    m1 = variaveis.get("mass1")
    m2 = variaveis.get("mass2")
    Gc = variaveis.get("Gc") or 6.67e-11
    x1 = variaveis.get("XObject1")
    x2 = variaveis.get("XObject2")
    
    # Radius in meters (from pixels)
    r1m = variaveis.get("Radius1m")
    r2m = variaveis.get("Radius2m")
    r1px = variaveis.get("Radius1")
    r2px = variaveis.get("Radius2")
    
    # Density values - some versions use material indices + Densities array
    density1 = variaveis.get("Density1")
    density2 = variaveis.get("Density2")
    material1_idx = variaveis.get("material1")
    material2_idx = variaveis.get("material2")
    densities_array = variaveis.get("Densities")
    
    # Resolve density from material index + Densities array
    if density1 is None and material1_idx is not None and densities_array and isinstance(densities_array, list):
        try:
            idx = int(material1_idx)
            if 0 <= idx < len(densities_array):
                density1 = densities_array[idx]
        except:
            pass
    if density2 is None and material2_idx is not None and densities_array and isinstance(densities_array, list):
        try:
            idx = int(material2_idx)
            if 0 <= idx < len(densities_array):
                density2 = densities_array[idx]
        except:
            pass

    # If masses not given directly, compute from radius and density
    if m1 is None and r1m is not None and density1 is not None:
        vol1 = (4/3) * _math4.pi * r1m**3
        m1 = vol1 * density1
    elif m1 is None and r1px is not None and density1 is not None:
        r1m_calc = r1px / 10.0 if r1px > 10 else r1px
        vol1 = (4/3) * _math4.pi * r1m_calc**3
        m1 = vol1 * density1
        
    if m2 is None and r2m is not None and density2 is not None:
        vol2 = (4/3) * _math4.pi * r2m**3
        m2 = vol2 * density2
    elif m2 is None and r2px is not None and density2 is not None:
        r2m_calc = r2px / 10.0 if r2px > 10 else r2px
        vol2 = (4/3) * _math4.pi * r2m_calc**3
        m2 = vol2 * density2

    if m1 is not None and m2 is not None and x1 is not None and x2 is not None:
        # Distance from positions: rad = (x2 - x1) / 10 is the formula the simulator uses
        rad = abs(x2 - x1) / 10.0
        
        F_gravity = Gc * m1 * m2 / (rad ** 2)

        resultado["respostas"] = [f"{rad:.2f}", f"{F_gravity:.2e}"]
        resultado["formulas"] = [
            f"rad = (x2-x1)/10 = ({x2:.2f}-{x1:.2f})/10 = {rad:.4f} m",
            f"F = G*m1*m2/rad^2 = {Gc}*{m1:.2e}*{m2:.2e}/{rad:.4f}^2 = {F_gravity:.4e} N"
        ]
        resultado["passos"] = [
            f"1. Massa 1: m1 = {m1:.2e} kg",
            f"2. Massa 2: m2 = {m2:.2e} kg",
            f"3. Distancia entre centros: rad = (x2-x1)/10 = {rad:.4f} m",
            f"4. Forca gravitacional: F = G*m1*m2/rad^2 = {F_gravity:.4e} N"
        ]
        return resultado

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

    nome = resolver_physics_aviary.nome_aluno if hasattr(resolver_physics_aviary, 'nome_aluno') else "Physics Bot"

    # --- PASSO 1: Esperar a pagina carregar completamente ---
    print(f"[BOT] Iniciando simulador Physics Aviary (nome: {nome})...")
    
    # Wait for the page to be fully loaded
    try:
        pagina.wait_for_load_state("networkidle", timeout=15000)
    except:
        pass
    time.sleep(2)
    
    # Take initial screenshot to see what we're working with
    initial_screenshot = SCREENSHOT_DIR / "_initial_state.png"
    pagina.screenshot(path=str(initial_screenshot), full_page=True)
    
    # Check if we got redirected to homepage (404 → redirect)
    current_url = pagina.url
    if "find.php" in current_url or (current_url.rstrip("/") == "https://thephysicsaviary.com" or current_url.rstrip("/") == "https://thephysicsaviary.com/Physics"):
        print(f"[BOT] AVISO: Pagina redirecionou para {current_url}. URL original pode estar errada.")
        # Try to detect if we need to wait more
        time.sleep(3)

    # --- PASSO 2: Preencher nome e clicar Begin ---
    try:
        name_field = pagina.locator("#StudentName")
        if name_field.count() > 0:
            name_field.click()
            name_field.fill("")
            name_field.fill(nome)
            time.sleep(0.3)
            print(f"[BOT] Nome preenchido: {nome}")
    except Exception as e:
        print(f"[BOT] Erro ao preencher nome: {e}")

    # Click Begin - try multiple strategies
    begin_clicked = False
    for attempt in range(3):
        try:
            begin_btn = pagina.locator("#BeginButton")
            if begin_btn.count() > 0 and begin_btn.is_visible():
                begin_btn.click()
                begin_clicked = True
                print("[BOT] Clicou em Begin!")
                time.sleep(4)
                break
        except:
            pass
        
        # Try alternative selectors
        for selector in ["button:has-text('Begin')", "input[value='Begin']", "#BeginButton", ".BeginButton"]:
            try:
                btn = pagina.locator(selector)
                if btn.count() > 0:
                    btn.first.click()
                    begin_clicked = True
                    print(f"[BOT] Clicou em Begin via selector: {selector}")
                    time.sleep(4)
                    break
            except:
                continue
        if begin_clicked:
            break
        time.sleep(2)

    if not begin_clicked:
        print("[BOT] Sem botao Begin, simulador pode ja estar iniciado...")

    # Wait for simulation to initialize
    time.sleep(3)

    # --- PASSO 3: Extrair variaveis JavaScript ---
    print("[BOT] Extraindo variaveis JavaScript...")

    variaveis_conhecidas = [
        "StartingSpeed", "MassOfCar", "CoefficientOfFriction",
        "InitialVelocity", "FinalVelocity", "Angle", "InclineAngle",
        "Distance", "Time", "Mass", "Force", "AppliedForce",
        "CoefficientOfKineticFriction", "CoefficientOfStaticFriction",
        "coefficientoffriction",
        "Acceleration", "Gravity", "Height", "Velocity",
        "SpringConstant", "Amplitude", "Frequency", "Period",
        "Wavelength", "Charge", "Voltage", "Current",
        "Resistance", "Power", "Energy", "Momentum",
        "AngularVelocity", "Torque", "MomentOfInertia",
        "Radius", "Temperature", "Pressure", "Volume",
        "InitialHeight", "FinalHeight", "LaunchAngle",
        "LaunchSpeed", "Range", "MaxHeight",
        "OrbitRadiusm", "OrbitRadiuspx", "MoonMass", "AngularSpeed",
        "PlanetSizepx", "PlanetSizem",
        "StartSpeed", "MassOfBox", "HeightOfLabTable", "TableDistance",
        "GravitationalField", "HorizontalRange",
        "HeightOfLabTablemm", "MassOfBoxg", "TableDistancecm",
        "AngleOfIncline", "AngleinRad", "MassHanging", "SlidingMass",
        "Ff", "Fgx", "TotalForcex",
        "mass1", "mass2", "Gc", "Radius1m", "Radius2m",
        "Radius1", "Radius2", "XObject1", "XObject2", "YObject",
        "Density1", "Density2",
        "material1", "material2",
        "mu", "muK", "muS", "theta",
        "k", "F", "v0", "v1", "v2",
        "m1", "m2", "r", "T",
    ]

    variaveis_extraidas = {}
    for var in variaveis_conhecidas:
        try:
            valor = pagina.evaluate(f"typeof {var} !== 'undefined' ? {var} : null")
            if valor is not None and isinstance(valor, (int, float, str)):
                try:
                    float(valor)
                    variaveis_extraidas[var] = valor
                except (ValueError, TypeError):
                    if isinstance(valor, str) and len(valor) < 50:
                        variaveis_extraidas[var] = valor
        except:
            pass

    # Filter out huge timestamps but preserve important variables
    variaveis_preservar = {
        'OrbitRadiusm', 'MoonMass', 'PlanetSizem',
        'mass1', 'mass2', 'StartSpeed',
        'XObject1', 'XObject2', 'Radius1', 'Radius2',
        'Radius1m', 'Radius2m', 'Density1', 'Density2',
    }
    variaveis_filtradas = {}
    for k, v in variaveis_extraidas.items():
        if k in variaveis_preservar:
            variaveis_filtradas[k] = v
        elif isinstance(v, (int, float)) and abs(v) > 1e10:
            continue
        else:
            variaveis_filtradas[k] = v

    variaveis_extraidas = variaveis_filtradas
    print(f"[BOT] Variaveis extraidas: {variaveis_extraidas}")
    
    # Special: Extract Densities array for Universal Gravity problems
    try:
        densities_array = pagina.evaluate("typeof Densities !== 'undefined' ? Densities : null")
        if densities_array and isinstance(densities_array, list):
            variaveis_extraidas["Densities"] = densities_array
            # Also get Materials array
            materials_array = pagina.evaluate("typeof Materials !== 'undefined' ? Materials : null")
            if materials_array:
                variaveis_extraidas["Materials"] = materials_array
            print(f"[BOT] Densities array: {densities_array}")
            if materials_array:
                print(f"[BOT] Materials: {materials_array}")
    except:
        pass

    # --- PASSO 4: Ler enunciado e labels ---
    enunciado = ""
    try:
        enunciado = pagina.locator("#SystemMessage").inner_text()
    except:
        try:
            enunciado = pagina.locator("#LabDirections").inner_text()
        except:
            try:
                enunciado = pagina.locator("#Directions").inner_text()
            except:
                pass

    labels = []
    try:
        for ft in pagina.locator(".FormText").all():
            labels.append(ft.inner_text())
    except:
        pass

    # Count answer fields
    num_campos = 0
    for i in range(1, 10):
        try:
            if pagina.locator(f"#A{i}").count() > 0:
                num_campos = i
        except:
            break

    print(f"[BOT] Enunciado: {enunciado[:200]}")
    print(f"[BOT] Campos ({num_campos}): {labels}")

    # --- PASSO 5: Estrategia de resolucao em camadas ---

    titulo_pagina = pagina.title() if pagina else ""
    calculo_direto = calcular_direto_physics_aviary(variaveis_extraidas, titulo_pagina)

    if calculo_direto["respostas"]:
        print(f"[BOT] Calculo direto disponivel! Respostas: {calculo_direto['respostas']}")
        respostas = calculo_direto["respostas"]
        passos = "\n".join(calculo_direto["passos"])
    else:
        # Camada 2: VLM + IA
        print("[BOT] Calculo direto nao disponivel. Usando VLM + IA...")

        canvas_path = SCREENSHOT_DIR / "_canvas_temp.png"
        pagina.screenshot(path=str(canvas_path), full_page=True)

        vlm_prompt = """Extraia TODOS os dados numericos e informacoes deste simulador de fisica.
Liste cada variavel com seu valor e unidade.
Exemplo: v = 20.0 m/s, mu = 0.39, m = 914 kg
Liste tambem o que esta sendo pedido (tempo, distancia, velocidade, etc)."""

        vlm_resultado = ler_imagem_com_vlm(canvas_path, vlm_prompt)
        print(f"[VLM] Dados lidos: {vlm_resultado[:300]}")

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

    # --- PASSO 6: Mostrar formulario de resposta ---
    form_visivel = False
    try:
        form_visivel = pagina.locator("#A1").is_visible()
    except:
        pass

    if not form_visivel:
        print("[BOT] Formulario oculto, ativando ferramentas...")
        try:
            toggle = pagina.locator("#ToggleTools")
            if toggle.count() > 0:
                toggle.click()
                time.sleep(0.5)
        except:
            pass

        try:
            stop_btn = pagina.locator("#StopTimerButton")
            if stop_btn.count() > 0:
                stop_btn.click()
                time.sleep(1)
                stop_btn.click()
                time.sleep(0.5)
        except:
            pass

        # Try StartTimerButton too
        try:
            start_btn = pagina.locator("#StartTimerButton")
            if start_btn.count() > 0:
                start_btn.click()
                time.sleep(2)
        except:
            pass

        try:
            if not pagina.locator("#A1").is_visible():
                pagina.evaluate('$("#SpaceForAnswer").show()')
                time.sleep(0.3)
        except:
            pass

    # --- PASSO 7: Preencher respostas ---
    # If num_campos is 0, try to detect fields again after showing form
    if num_campos == 0:
        for i in range(1, 10):
            try:
                if pagina.locator(f"#A{i}").count() > 0 and pagina.locator(f"#A{i}").is_visible():
                    num_campos = i
            except:
                break
        if num_campos > 0:
            print(f"[BOT] Campos detectados apos mostrar formulario: {num_campos}")

    for i, resp in enumerate(respostas):
        if num_campos > 0 and i >= num_campos:
            break
        input_id = f"#A{i+1}"
        try:
            locator = pagina.locator(input_id)
            if locator.count() > 0 and locator.is_visible():
                locator.click()
                locator.fill("")
                locator.fill(str(resp))
                print(f"[BOT] Preencheu {input_id} com '{resp}'")
        except Exception as e:
            print(f"[BOT] Erro ao preencher {input_id}: {e}")

    time.sleep(0.5)

    # --- PASSO 8: Screenshot ANTES de submeter ---
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    screenshot_pre = SCREENSHOT_DIR / f"antes_submeter_{timestamp}.png"
    pagina.screenshot(path=str(screenshot_pre), full_page=True)

    # --- PASSO 9: Clicar em Check/Submit ---
    submitted = False
    try:
        submit = pagina.locator("#SubmitButton")
        if submit.count() > 0 and submit.is_visible():
            submit.click()
            submitted = True
            print("[BOT] Clicou em Check! Aguardando animacao...")

            for _ in range(40):
                time.sleep(0.5)
                try:
                    moving = pagina.evaluate("typeof Moving !== 'undefined' ? Moving : 'unknown'")
                    if moving == "done":
                        print("[BOT] Animacao concluida!")
                        break
                except:
                    pass
            time.sleep(1.5)
        else:
            print("[BOT] Botao Check nao encontrado ou nao visivel")
    except Exception as e:
        print(f"[BOT] Erro ao submeter: {e}")

    # --- PASSO 10: Screenshot DEPOIS ---
    screenshot_pos = SCREENSHOT_DIR / f"resultado_{timestamp}.png"
    pagina.screenshot(path=str(screenshot_pos), full_page=True)

    # --- PASSO 11: Verificar resultado ---
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

    # Try alternative result detection
    if resultado == "Ver screenshot":
        try:
            # Check for green/red indicators in the page
            correct = pagina.evaluate("typeof Correct !== 'undefined' ? Correct : null")
            if correct is not None:
                resultado = "CORRETO!" if correct else "INCORRETO"
        except:
            pass

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

    # Check correct answers
    respostas_corretas = {}
    for i in range(1, 6):
        try:
            ans = pagina.evaluate(f"typeof Answer{i} !== 'undefined' ? Answer{i} : null")
            if ans is not None and isinstance(ans, (int, float)):
                respostas_corretas[f"Answer{i}"] = round(ans, 4)
        except:
            pass

    # --- PASSO 12: Salvar ---
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

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    canvas_path = SCREENSHOT_DIR / f"_generico_{timestamp}.png"
    pagina.screenshot(path=str(canvas_path), full_page=True)

    vlm_prompt = """Analise este simulador de fisica. Extraia:
1. Todos os dados numericos (valores e unidades)
2. O que esta sendo pedido (quais respostas)
3. Onde digitar as respostas (campos de input)
Seja especifico com os numeros."""
    vlm_dados = ler_imagem_com_vlm(canvas_path, vlm_prompt)
    print(f"[VLM] Dados: {vlm_dados[:300]}")

    try:
        texto_pagina = pagina.inner_text("body")
    except:
        texto_pagina = ""

    contexto = f"Dados do VLM:\n{vlm_dados}\n\nTexto da pagina:\n{texto_pagina[:1000]}"
    conta, resposta_num, texto_completo = resolver_com_ia(
        "Resolva este problema de fisica do simulador", contexto
    )
    respostas = [r.strip() for r in resposta_num.split(";")]

    inputs = pagina.locator("input[type='text'], input[type='number'], .FormInputs").all()
    for i, (inp, resp) in enumerate(zip(inputs, respostas)):
        try:
            inp.fill(str(resp))
            print(f"[BOT] Preencheu campo {i+1} com '{resp}'")
        except:
            pass

    time.sleep(0.5)

    screenshot_pre = SCREENSHOT_DIR / f"antes_submeter_{timestamp}.png"
    pagina.screenshot(path=str(screenshot_pre), full_page=True)

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

    screenshot_pos = SCREENSHOT_DIR / f"resultado_{timestamp}.png"
    pagina.screenshot(path=str(screenshot_pos), full_page=True)

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

    resolver_physics_aviary.nome_aluno = nome

    print(f"\n{'='*60}")
    print(f"  PHYSICS BOT v3 - Iniciando resolucao")
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
        
        # Navigate with better error handling
        try:
            response = pagina.goto(url, wait_until="domcontentloaded", timeout=30000)
            if response:
                status = response.status
                print(f"[BOT] HTTP Status: {status}")
                if status == 404:
                    print(f"[BOT] ERRO: URL retornou 404. Verifique a URL do simulador.")
                    navegador.close()
                    return {"resultado": "ERRO_URL_404", "respostas_enviadas": [], "calculos": "URL retornou 404. Verifique se a URL esta correta.", "metodo": "erro"}
                if status == 429:
                    print(f"[BOT] ERRO: Rate limited (429). Aguarde um momento e tente novamente.")
                    time.sleep(10)
                    response = pagina.goto(url, wait_until="domcontentloaded", timeout=30000)
                    if response and response.status == 429:
                        navegador.close()
                        return {"resultado": "ERRO_RATE_LIMITED", "respostas_enviadas": [], "calculos": "Site com rate limiting. Tente novamente em alguns segundos.", "metodo": "erro"}
        except Exception as e:
            print(f"[BOT] Erro ao acessar URL: {e}")
            navegador.close()
            return {"resultado": "ERRO_CONEXAO", "respostas_enviadas": [], "calculos": f"Erro ao acessar simulador: {str(e)}", "metodo": "erro"}
        
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
