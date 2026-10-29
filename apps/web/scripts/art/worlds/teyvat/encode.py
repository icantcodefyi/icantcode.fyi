"""AVIF primary plus exact requested cwebp fallback, with true 1200px variants."""
from pathlib import Path
import json, subprocess, sys
from PIL import Image
ROOT=Path('/tmp/art-teyvat')
HERE=Path(__file__).resolve().parent
OUT=HERE.parents[3]/'public/lobby/gi/vista'
OUT.mkdir(parents=True,exist_ok=True)
record_path=ROOT/'files.json'
records=json.loads(record_path.read_text()) if record_path.exists() else []
by_name={r['file']:r for r in records}
names=sys.argv[1:] or [p.name.removesuffix('-composite.png') for p in sorted(ROOT.glob('*-composite.png'))]
for name in names:
    for suffix,size in [('',(2400,1350)),('-1200',(1200,675))]:
        images={kind:Image.open(ROOT/f'{name}-{kind}.png') for kind in ['sky','far','near','depth']}
        if suffix:images={k:v.resize(size,Image.Resampling.LANCZOS) for k,v in images.items()}
        quality=54 if suffix else 50
        limit=(85 if suffix else 148)*1024
        while True:
            for kind,im in images.items():
                im.save(OUT/f'{name}-{kind}{suffix}.avif',quality=82 if kind=='depth' else quality,speed=6,subsampling='4:4:4' if kind=='depth' else '4:2:0',max_threads=4)
            total=sum((OUT/f'{name}-{kind}{suffix}.avif').stat().st_size for kind in images)
            if total<=limit or quality<=32:break
            quality-=3
        for kind,im in images.items():
            temp=ROOT/f'{name}-{kind}{suffix}-encode.png'
            im.save(temp)
            dst=OUT/f'{name}-{kind}{suffix}.webp'
            subprocess.run(['cwebp','-quiet','-q','82','-alpha_q','90','-m','6','-sharp_yuv',str(temp),'-o',str(dst)],check=True)
            for ext in ['avif','webp']:
                path=OUT/f'{name}-{kind}{suffix}.{ext}'
                by_name[path.name]={'file':path.name,'px':list(size),'bytes':path.stat().st_size,'KB':round(path.stat().st_size/1024,2),'encoding':f'AVIF q{82 if kind=="depth" else quality} / speed6' if ext=='avif' else 'cwebp -q 82 -alpha_q 90 -m 6 -sharp_yuv'}
        print(name,suffix or 'full','AVIF total KB',round(total/1024,2),'color q',quality,flush=True)
        record_path.write_text(json.dumps(sorted(by_name.values(),key=lambda r:r['file']),indent=2)+'\n')
