#!/usr/bin/env python3
"""Reproducible gates; no network, no edits, isolated user:// unless explicitly requested."""
import argparse, os, re, subprocess, tempfile
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('--godot',default=os.environ.get('GODOT_BIN','godot'))
p.add_argument("--only")
p.add_argument("--export", action="store_true")
a=p.parse_args()
project=Path(__file__).resolve().parents[1]
commands=[('import',['--import'])]
for name,path in [('menu','scenes/menu.tscn'),('vertical slice','scenes/main.tscn'),('enemy lab','scenes/labs/enemy_lab.tscn'),('weapon lab','scenes/labs/weapon_lab.tscn'),('material lab','scenes/labs/material_lab.tscn'),('campaign','scenes/campaign.tscn')]:
 commands.append((name,['--scene','res://'+path,'--quit-after','120']))
commands.append(('production tests',['--scene','res://tests/production_tests.tscn']))
commands.append(('gameplay simulation',['--scene','res://tests/simulation_playthrough.tscn']))
if a.only:
 commands = [(title,args) for title,args in commands if title == a.only]
 if not commands: raise SystemExit("Unknown gate " + a.only)
if a.export:
 (project/"export").mkdir(exist_ok=True)
 commands = [("export Linux",["--export-debug","Linux/X11","export/neurodoom-linux.x86_64"]),("export Windows",["--export-debug","Windows Desktop","export/neurodoom-windows.exe"])]
with tempfile.TemporaryDirectory(prefix="neurodoom-tests-") as user_data:
 env={**os.environ,'XDG_DATA_HOME':user_data,'XDG_CONFIG_HOME':user_data} if not a.export else os.environ.copy()
 for title,args in commands:
  result=subprocess.run([a.godot,'--headless','--path',str(project),*args],env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=180)
  failures=re.findall(r'^.*(?:SCRIPT ERROR|ERROR:|WARNING:|TEST FAIL).*$',result.stdout,re.M)
  print(f'{title}: '+('PASS' if not failures and result.returncode==0 else 'FAIL'),flush=True)
  if failures or result.returncode:
   print(result.stdout)
   raise SystemExit(1)
  if title=='gameplay simulation':
   print(result.stdout)
   if 'GAMEPLAY SIMULATION: PASS' not in result.stdout: raise SystemExit('Gameplay simulation did not complete')
  if title=='production tests':
   print(result.stdout)
   if not re.search(r'PRODUCTION TESTS: \d+ checks; 0 failures',result.stdout):
    raise SystemExit('Tests did not complete')
