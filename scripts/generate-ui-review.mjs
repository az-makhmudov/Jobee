/* global console */
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
const pages = [
  'home',
  'profile-overview',
  'profile',
  'career-intelligence',
  'documents',
  'answers',
  'preferences',
  'jobs',
  'job-detail',
  'applications-board',
  'applications-list',
  'application-detail',
  'prepared-materials',
  'studio',
  'approvals',
  'interviews',
  'messages',
  'settings',
  'activity',
  'home-progress',
];
const available = pages.filter((name) =>
  existsSync('output/playwright/screens/' + name + '-light.png'),
);
if (available.length !== pages.length)
  throw new Error('Run the complete desktop render inventory first.');
const references = available.filter((name) =>
  existsSync('output/playwright/figma-reference/' + name + '.png'),
);
mkdirSync('output/playwright', { recursive: true });
writeFileSync(
  'output/playwright/design-review.html',
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jobee migration review</title><style>body{margin:0;font:15px/1.5 system-ui;background:#f5f5f5;color:#171717}header{padding:20px 24px;background:white;border-bottom:1px solid #ddd;position:sticky;top:0;z-index:2}h1{font-size:22px;margin:0 0 8px}p{margin:0 0 12px;color:#555}label{margin-right:16px}select,button{font:inherit;padding:8px 12px;border:1px solid #aaa;border-radius:12px;background:white}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px}figure{margin:0;min-width:0}figcaption{padding:8px 0;font-weight:600}img{display:block;width:100%;height:auto;border:1px solid #ddd}a{color:inherit}@media(max-width:900px){.comparison{grid-template-columns:1fr}}</style><header><h1>Jobee · migration preview</h1><p>Compare the approved Figma layout with the working desktop UI. Preview records are synthetic; names, counts and states can differ from the design examples. Dark mode uses the shared Figma semantic colors.</p><label>Screen <select id="screen">${available.map((name) => '<option value="' + name + '">' + name.replaceAll('-', ' ') + '</option>').join('')}</select></label><label>Preview theme <select id="theme"><option>light</option><option>dark</option></select></label><button id="open">Open application</button></header><div class="comparison"><figure><figcaption>Figma layout reference · Light</figcaption><img id="figma" alt="Approved Figma layout"><p id="missing" hidden>This additional application view shares its workspace design language.</p></figure><figure><figcaption>Working application · 1440px</figcaption><a id="image-link" target="_blank"><img id="live" alt="Working application render"></a></figure></div><script>const refs=${JSON.stringify(references)};function update(){const name=document.getElementById('screen').value,theme=document.getElementById('theme').value;document.getElementById('live').src='screens/'+name+'-'+theme+'.png';document.getElementById('image-link').href=document.getElementById('live').src;document.getElementById('figma').hidden=!refs.includes(name);document.getElementById('missing').hidden=refs.includes(name);if(refs.includes(name))document.getElementById('figma').src='figma-reference/'+name+'.png';}document.getElementById('screen').onchange=update;document.getElementById('theme').onchange=update;document.getElementById('open').onclick=()=>window.open('http://127.0.0.1:5179','_blank','noopener');update();</script></html>`,
);
console.log(
  'Wrote output/playwright/design-review.html with 20 screens, both themes and 18 cached Figma references.',
);
