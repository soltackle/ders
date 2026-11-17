"""Build the offline HTML from local sources; no network access required."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
html = (SRC / 'shell.html').read_text(encoding='utf-8')
code = '\n'.join((SRC / name).read_text(encoding='utf-8') for name in (
    'templates.js', 'defense.js', 'model.js', 'technique.js', 'empty.js', 'field.js', 'app.js'))
html = html.replace('__LEGACY_CATALOG__', (SRC / 'legacy-catalog.json').read_text(encoding='utf-8').replace('<', '\\u003c'))
html = html.replace('__SCRIPTS__', code)
core = ROOT / '.test-output'
core.mkdir(exist_ok=True)
(core / 'core.html').write_text(html.replace('__SUPPLIED_PLAYS__', '[]'), encoding='utf-8')
seed_script = r"""
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
for(const f of ['templates','defense','model','technique','empty'])
  vm.runInThisContext(fs.readFileSync(path.join(process.argv[1],f+'.js'),'utf8'));
const p=OLEmpty.newPlay();
p.id='supplied-empty';
p.seedKey='user-empty-field-man-v1';
for(const a of p.players)a.id='empty-'+a.label.toLowerCase();
process.stdout.write(JSON.stringify([p]));
"""
seed = subprocess.check_output(['node', '-e', seed_script, str(SRC)], text=True)
html = html.replace('__SUPPLIED_PLAYS__', seed.replace('<', '\\u003c'))
for name in ('index.html', 'OL_Atolye_Editor.html'):
    (ROOT / name).write_text(html, encoding='utf-8')
print('Built index.html and OL_Atolye_Editor.html with the supplied Empty play.')
