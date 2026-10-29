"""Deterministic replay from archived generated inputs; no app build or source edits."""
from pathlib import Path
import subprocess,sys
HERE=Path(__file__).resolve().parent
for file,args in [('prepare.py',[]),('infer.py',['--original']),('cuts.py',[]),('upscale.py',[]),('compose.py',[]),('infer.py',[]),('atlas.py',[]),('encode.py',[]),('validate.py',[]),('previews.py',[]),('write_manifest.py',[])]:
 subprocess.run([sys.executable,str(HERE/file),*args],check=True)
