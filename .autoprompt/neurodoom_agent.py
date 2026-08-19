#!/usr/bin/env python3
"""
AutoPrompt Neurodoom — agente que se dá prompts sozinho para manter o jogo.
============================================================================
Usa a arquitetura autoprompt-self-prompting (ver skill), mas PLUGADO no
projeto Neurodoom:
  - workdir = projeto neurodoom
  - motor   = pi (GLM 5.2 via NVIDIA NIM/Alvus)
  - verificador próprio: typecheck + vitest precisam estar VERDES.
O sistema escreve seu próprio briefing (estado+histórico+lições), o agente
age, e só declara COMPLETO quando a verificação do mundo real passa.
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

# ─────────────── PATH DO PROJETO NEURODOOM ───────────────
NEURODOOM = Path("/home/eduardodlima/projetos/neurodoom")
WORKDIR = NEURODOOM / ".autoprompt"
WORKDIR.mkdir(parents=True, exist_ok=True)
MEM_FILE = WORKDIR / "memoria.json"
STATE_FILE = WORKDIR / "estado.json"
LOGS = WORKDIR / "logs.jsonl"

# Motor (agente que executa). "-p" = modo não-interativo (senão fica preso esperando input)
MOTOR_ARGS = [os.path.expanduser("~/.hermes/node/bin/pi"), "-p"]
MAX_TURNS = int(os.environ.get("AUTOPROMPT_MAX_TURNS", "12"))

OBJETIVO_PADRAO = (
    "No projeto Neurodoom (TypeScript + Vitest, em " + str(NEURODOOM) + "): "
    "garanta que `npm run typecheck` passe sem erros e que `npx vitest run` tenha "
    "todos os testes verdes. Se tudo já estiver verde, busque e implemente UMA "
    "melhoria pequena e segura no jogo (sem quebrar testes). Depois rode o lint "
    "e repita até tudo passar."
)


def carregar(path, default):
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            return default
    return default


def salvar(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))


def registrar(entrada):
    with LOGS.open("a") as f:
        f.write(json.dumps(entrada, ensure_ascii=False) + "\n")


class Memoria:
    def __init__(self):
        self.dados = carregar(MEM_FILE, {"licoes": [], "total_execucoes": 0})

    def aprender(self, licao, tipo="sucesso"):
        self.dados.setdefault("licoes", []).append({"tipo": tipo, "texto": licao, "quando": time.time()})
        self.dados["licoes"] = self.dados["licoes"][-40:]
        self.dados["total_execucoes"] = self.dados.get("total_execucoes", 0) + 1
        salvar(MEM_FILE, self.dados)
        registrar({"evento": f"aprendeu-{tipo}", "texto": licao})

    def resumo(self):
        if not self.dados.get("licoes"):
            return "  (nenhuma lição ainda)"
        return "\n".join(
            f"  {'✔' if l['tipo']=='sucesso' else '✘'} {l['texto'][:140]}"
            for l in self.dados["licoes"][-6:]
        )


def gerar_prompt(estado, memoria):
    hist = estado.get("historico", [])[-5:]
    ctx = "Ainda não começou." if not hist else "\n".join(
        f"  - exec {n}: {n.get('nota','')[:160]}"
        for n in hist
    )
    return f"""[SISTEMA — agente autônomo de manutenção do Neurodoom]
Você é um agente que mantém o jogo Neurodoom (TypeScript + Vitest) de forma
autônoma e auto-corretiva, sem pedir permissão. Use suas ferramentas e execute.

PROJETO: {NEURODOOM}

OBJETIVO:
{estado['objetivo']}

O QUE JÁ FOI FEITO (não repita):
{ctx}

LIÇÕES DE EXECUÇÕES ANTERIORES (honre):
{memoria.resumo()}

REGRAS DO JOGO:
- Rode `npm run typecheck` e `npx vitest run` para saber o estado real.
- Use suas habilidades de agente: edit files, run commands, inspecione.
- Se houver erro/falha, CORRIJA e re-teste até passar.
- Só declare conclusão quando typecheck+testes estiverem verdes.
- Ao terminar diga EXATAMENTE na última linha: AUTOPROMPT_COMPLETO"""


def verificar_mundo():
    """O 'mundo real' do Neurodoom: typecheck e testes verdes."""
    try:
        r1 = subprocess.run(["npm", "run", "typecheck"], cwd=NEURODOOM,
                            capture_output=True, text=True, timeout=180)
        tc_ok = r1.returncode == 0
    except Exception:
        tc_ok = False
    try:
        r2 = subprocess.run(["npx", "vitest", "run"], cwd=NEURODOOM,
                            capture_output=True, text=True, timeout=180)
        t_ok = r2.returncode == 0
    except Exception:
        t_ok = False
    return tc_ok, t_ok


def rodar(objetivo=None, max_turns=None):
    max_turns = max_turns or MAX_TURNS
    objetivo = objetivo or OBJETIVO_PADRAO
    memoria = Memoria()
    estado = carregar(STATE_FILE, {"objetivo": objetivo, "historico": []})

    # Se o objetivo mudou, resetar histórico — senão o sistema "comprova" com
    # resultado de uma tarefa anterior e não faz nada. Cada objetivo = novo trabalho.
    if estado.get("objetivo") != objetivo:
        print("🔄 Objetivo novo detectado — reiniciando estado (histórico vazio).")
        estado = {"objetivo": objetivo, "historico": [], "progresso": "iniciando"}
        salvar(STATE_FILE, estado)

    print(f"🎯 OBJETIVO: {objetivo}")
    print(f"⚙  motor: {' '.join(MOTOR_ARGS)}")
    print("=" * 60)

    for turno in range(1, max_turns + 1):
        # baseline antes de agir
        tc_ok0, t_ok0 = verificar_mundo()
        print(f"\n🧠 [exec {turno}/{max_turns}] estado atual: typecheck={'OK' if tc_ok0 else 'FALHA'} testes={'OK' if t_ok0 else 'FALHA'}")

        if tc_ok0 and t_ok0 and estado.get("historico"):
            # já verde e já agiu antes → objetivo comprovado
            print("✅ Já comprovado: typecheck e testes verdes. Parando.")
            estado["progresso"] = "COMPLETO"
            salvar(STATE_FILE, estado)
            return True

        # 1) GERAR briefing autônomo
        prompt = gerar_prompt(estado, memoria)

        # 2) AGENTE executa sozinho (timeout generoso: tarefa de conteúdo demora >290s)
        try:
            r = subprocess.run(MOTOR_ARGS + [prompt], capture_output=True, text=True, timeout=850)
            plano = (r.stdout or "").strip()
        except Exception as e:
            plano = f"ERRO_MOTOR: {e}"
        print(f"   ~ agente: {plano[:180]}")

        # 3) VERIFICAR o mundo real (não acredito na palavra do agente)
        tc_ok, t_ok = verificar_mundo()
        nota = f"typecheck={'OK' if tc_ok else 'FALHA'} testes={'OK' if t_ok else 'FALHA'}"
        if tc_ok and t_ok:
            print(f"🎉 VERIFICADO no mundo real: {nota}")
            estado.setdefault("historico", []).append({"tipo": "sucesso", "nota": nota})
            salvar(STATE_FILE, estado)
            memoria.aprender(f"Exec {turno}: mundo ficou verde. {nota}", "sucesso")
            return True
        else:
            print(f"⚠ não comprovado: {nota}")
            estado.setdefault("historico", []).append({"tipo": "erro", "nota": nota})
            estado["historico"] = estado["historico"][-12:]
            salvar(STATE_FILE, estado)
            memoria.aprender(f"Exec {turno}: objetivo não comprovado ({nota}). Continuar.", "erro")
            time.sleep(3)

    print(f"\n⛔ Esgotou {max_turns} execuções sem comprovar.")
    return False


if __name__ == "__main__":
    obj = sys.argv[1] if len(sys.argv) > 1 else None
    ok = rodar(obj)
    sys.exit(0 if ok else 2)
