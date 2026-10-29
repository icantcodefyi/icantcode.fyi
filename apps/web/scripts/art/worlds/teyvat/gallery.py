"""Local, server-free review gallery; image bytes embedded for portable viewing."""
from pathlib import Path
import base64,json
from PIL import Image
ROOT=Path('/tmp/art-teyvat')
files=json.loads((ROOT/'files.json').read_text())
images={}
for kind,src in [('paintings','contact-preview.png'),('mocks','contact-mock.png'),('night-layers','layers-night.png'),('day-layers','layers-day.png')]:
    path=ROOT/(kind+'-gallery.jpg')
    im=Image.open(ROOT/src);im.thumbnail((1440,1440),Image.Resampling.LANCZOS);im.save(path,quality=89)
    images[kind]='data:image/jpeg;base64,'+base64.b64encode(path.read_bytes()).decode()
buttons=''.join(f'<button type="button" data-view="{k}" aria-pressed="{str(i==0).lower()}">{label}</button>' for i,(k,label) in enumerate([('paintings','Paintings'),('mocks','Panel mocks'),('night-layers','Night layers'),('day-layers','Day layers'),('sizes','File sizes')]))
views=''.join(f'<img class="view" id="{kind}" src="{url}" alt="{kind.replace("-"," ")}" {"hidden" if kind!="paintings" else ""}>' for kind,url in images.items())
bars=[]
for region in ['inazuma','liyue','fontaine']:
    for mode in ['night','day']:
        name=f'{region}-{mode}'
        val=sum(f['bytes'] for f in files if f['file'].startswith(name) and f['file'].endswith('.avif') and '-1200' not in f['file'])/1024
        bars.append(f'<div class="barrow"><span>{region.title()} {mode}</span><div class="track"><i style="width:{val/2}%"></i></div><strong>{val:.1f} KB</strong></div>')
html='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
*{box-sizing:border-box}body{margin:0;color:var(--foreground);font-family:var(--font-sans,system-ui)}nav{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 12px}button{padding:8px 12px;border:1px solid var(--border,#61736e);border-radius:var(--radius,8px);background:var(--secondary,transparent);color:var(--foreground,inherit);font:inherit;font-size:13px;cursor:pointer}button[aria-pressed=true]{background:var(--primary,#a9c9b8);color:var(--primary-foreground,#10271f)}button:focus-visible{outline:2px solid var(--ring,#88bbdd);outline-offset:2px}.view{width:100%;display:block;border-radius:var(--radius,8px)}[hidden]{display:none!important}p{font-size:13px;line-height:1.5;margin:10px 0;color:var(--muted-foreground,#84948f)}#sizes{padding:16px;border-radius:var(--radius,8px);background:var(--card,transparent)}.barrow{display:grid;grid-template-columns:135px 1fr 75px;gap:12px;align-items:center;font-size:12px;margin:20px 0}.track{background:var(--secondary,#233d36);height:12px;border-radius:3px;overflow:hidden}.track i{display:block;height:100%;background:var(--chart-1,#94b8a6);border-radius:3px}strong{text-align:right;font-variant-numeric:tabular-nums}@media(max-width:440px){.barrow{grid-template-columns:104px 1fr 65px;gap:7px;font-size:11px}}
</style></head><body><nav aria-label="Preview type">'''+buttons+'</nav>'+views+'<section id="sizes" class="view" hidden><p>Full-resolution AVIF transfer per scene: sky + far + near + depth. Half-size alternatives and WebP fallbacks are listed in the manifest.</p>'+''.join(bars)+'''</section><p>2400 × 1350 plates · 1200 × 675 alternatives · Sky / far / near + aligned depth. Panel mocks use existing character art; delivered paintings contain no characters or UI.</p><script>
const buttons=[...document.querySelectorAll('button[data-view]')];buttons.forEach(b=>b.addEventListener('click',()=>{buttons.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.querySelectorAll('.view').forEach(x=>x.hidden=x.id!==b.dataset.view)}));
</script></body></html>'''
(ROOT/'gallery.html').write_text(html)
print('gallery.html',len(html),'bytes',flush=True)
