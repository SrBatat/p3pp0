---
Task ID: 1
Agent: Main Agent
Task: Criar Physics Bot - resolvedor automático de simuladores de física

Work Log:
- Inspecionou o simulador Physics Aviary Car Stopping Problem
- Analisou o JavaScript fonte para entender como o simulador funciona
- Descobriu que as variáveis do problema (StartingSpeed, MassOfCar, CoefficientOfFriction) podem ser extraídas via JavaScript
- Descobriu as fórmulas exatas usadas pelo simulador para calcular as respostas
- Criou o Physics Bot v2 com 3 camadas de resolução:
  1. Cálculo direto (extrai variáveis JS e calcula matematicamente)
  2. VLM + IA (lê o canvas com visão e manda para a IA calcular)
  3. Genérico (para outros sites)
- Testou 3 vezes com o simulador CarStoppingProblem - todas CORRETAS
- O bot usa z-ai CLI (gratuito) em vez de ZhipuAI (precisa de API key)

Stage Summary:
- Projeto funcional em /home/z/my-project/scripts/physics_bot.py
- Screenshots em /home/z/my-project/download/physics-bot/screenshots/
- Log de cálculos em /home/z/my-project/download/physics-bot/log_calculos.txt
- 3/3 testes corretos no simulador Car Stopping Problem
- 2/2 testes corretos no simulador Jolly Gas Giant Problem (nome: Helio)
- Suporte a nome customizável (2o argumento)
- Suporte a simuladores com timer/hidden form (Gas Giant style)
- Zero configuração necessária (não precisa de API key)
