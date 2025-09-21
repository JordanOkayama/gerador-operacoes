// server.js
// Node.js + Express + Puppeteer example for server-side PDF generation
// Install: npm i express body-parser puppeteer

const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

// Simple HTML builder (mirrors the frontend layout minimally)
function buildHtml(config, problemsByCaderno){
  let html = `<!doctype html><html><head><meta charset='utf8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>${config.title}</title><style>
    body{font-family:Arial;margin:0;padding:12mm}
    .page{width:210mm;height:297mm;box-sizing:border-box;padding:12mm;border:0}
    .cell{border:1px solid #444;padding:8px;min-height:60px;margin-bottom:6px}
    h2{margin:0 0 8px 0}
  </style></head><body>`;

  problemsByCaderno.forEach((problems, idx)=>{
    html += `<div class='page'><h2>${config.title} - Caderno ${idx+1}</h2><div>Nome: ______________________ Turma: ________</div><div style='height:8px'></div>`;
    problems.forEach((p,i)=>{
      html += `<div class='cell'>${i+1}. ${p.text}</div>`;
    });
    html += `</div><div style='page-break-after:always'></div>`;
  });

  // gabaritos
  html += `<div class='page'><h2>Gabaritos</h2>`;
  problemsByCaderno.forEach((problems, idx)=>{
    html += `<h3>Caderno ${idx+1}</h3>`;
    problems.forEach((p,i)=>{ html += `<div>${i+1}. ${p.text} → ${p.answer}</div>`; });
    html += '<div style="height:6px"></div>';
  });
  html += `</div>`;

  html += '</body></html>';
  return html;
}

// Na rota /generate espere um JSON { config: { ... } }
app.post('/generate', async (req,res)=>{
  try{
    const config = req.body.config;
    const seedBase = Date.now().toString();

    // PRNG simples baseado em seed (determinístico)
    function PRNG(seed){ let h=2166136261; for(let i=0;i<seed.length;i++){ h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); } return function(){ h += 0x6D2B79F5; let t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } }
    function pick(rand,min,max){ return Math.floor(rand() * (max-min+1))+min }

    const difficultyRanges = { facil:{min:0,max:12}, medio:{min:0,max:50}, dificil:{min:0,max:200} };

    function genOne(rand, ops, difficulty, divExact, allowNegative){
      const avail = [];
      if(ops.add) avail.push('+'); if(ops.sub) avail.push('-'); if(ops.mul) avail.push('×'); if(ops.div) avail.push('÷');
      const op = avail[Math.floor(rand()*avail.length)];
      const cfg = difficultyRanges[difficulty] || difficultyRanges.medio;
      let a=0,b=0,answer=0,text='';
      if(op === '+'){ a=pick(rand,cfg.min,cfg.max); b=pick(rand,cfg.min,cfg.max); answer=a+b; }
      else if(op === '-'){ if(allowNegative){ a=pick(rand,cfg.min,cfg.max); b=pick(rand,cfg.min,cfg.max); } else { a=pick(rand,cfg.min,cfg.max); b=pick(rand,cfg.min,a); } answer=a-b; }
      else if(op === '×'){ const mulMax = difficulty==='dificil'?Math.min(cfg.max,50):Math.min(cfg.max,20); a=pick(rand,0,mulMax); b=pick(rand,0,mulMax); answer=a*b; }
      else { b=pick(rand,1,Math.max(2, (difficulty==='dificil'?Math.min(cfg.max,20):Math.min(cfg.max,12)))); if(divExact){ const q=pick(rand,0,(difficulty==='dificil'?Math.min(cfg.max,30):Math.min(cfg.max,12))); a=b*q; answer=q } else { a=pick(rand,0,cfg.max); answer=Math.round((a/b)*100)/100 } }
      text = `${a} ${op} ${b} =`;
      return {a,b,op,answer,text};
    }

    // gerar cadernos
    const all = [];
    for(let c=0;c<config.cCount;c++){
      const rand = PRNG(seedBase + '-' + c);
      const arr = [];
      while(arr.length < config.qCount){ arr.push(genOne(rand, config.ops, config.difficulty, config.divExact, config.allowNegative)); }
      all.push(arr);
    }

    const html = buildHtml(config, all);

    // gerar PDF com puppeteer
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=' + `${config.title.replace(/\s+/g,'_')}.pdf`);
    res.send(pdf);
  } catch(err){ console.error(err); res.status(500).json({ error: err.message }); }
});

app.listen(3030, ()=>console.log('Servidor rodando na porta 3030'));
