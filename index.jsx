import React, { useRef, useState } from "react";
import html2pdf from "html2pdf.js";
import seedrandom from "seedrandom";

// Default export a React component
export default function CadernoGenerator() {
  const [operations, setOperations] = useState({ add: true, sub: true, mul: true, div: true });
  const [questionsPerCaderno, setQuestionsPerCaderno] = useState(20);
  const [numCadernos, setNumCadernos] = useState(1);
  const [difficulty, setDifficulty] = useState("medio"); // facil, medio, dificil
  const [divExact, setDivExact] = useState(true);
  const [title, setTitle] = useState("Caderno de Operações");
  const previewRef = useRef(null);

  // Difficulty parameterization
  const difficultyConfig = {
    facil: { min: 0, max: 12, terms: 2 },
    medio: { min: 0, max: 50, terms: 2 },
    dificil: { min: 0, max: 200, terms: 2 }
  };

  function rng(seed) {
    return seedrandom(seed);
  }

  function pickNumber(rand, min, max) {
    return Math.floor(rand() * (max - min + 1)) + min;
  }

  function generateOneProblem(rand, ops) {
    // pick operation
    const avail = [];
    if (ops.add) avail.push("+");
    if (ops.sub) avail.push("-");
    if (ops.mul) avail.push("×");
    if (ops.div) avail.push("÷");
    const op = avail[Math.floor(rand() * avail.length)];
    const cfg = difficultyConfig[difficulty];

    let a, b, answer;
    if (op === "+") {
      a = pickNumber(rand, cfg.min, cfg.max);
      b = pickNumber(rand, cfg.min, cfg.max);
      answer = a + b;
    } else if (op === "-") {
      a = pickNumber(rand, cfg.min, cfg.max);
      b = pickNumber(rand, cfg.min, a); // avoid negative results for basic students
      answer = a - b;
    } else if (op === "×") {
      // For multiplication keep numbers smaller depending on difficulty
      const mulMax = difficulty === "dificil" ? Math.min(cfg.max, 50) : Math.min(cfg.max, 20);
      a = pickNumber(rand, 0, mulMax);
      b = pickNumber(rand, 0, mulMax);
      answer = a * b;
    } else if (op === "÷") {
      // handle exact or inexact
      const divisorMax = difficulty === "dificil" ? Math.min(cfg.max, 20) : Math.min(cfg.max, 12);
      b = pickNumber(rand, 1, Math.max(2, divisorMax));
      if (divExact) {
        // pick quotient then compute dividend
        const qMax = difficulty === "dificil" ? Math.min(cfg.max, 30) : Math.min(cfg.max, 12);
        const q = pickNumber(rand, 0, qMax);
        a = b * q;
        answer = q; // integer quotient
      } else {
        // non-exact: random dividend
        a = pickNumber(rand, 0, difficultyConfig[difficulty].max);
        answer = (b === 0) ? 0 : +(a / b).toFixed(2);
      }
    }

    return { text: `${a} ${op} ${b} =`, op, a, b, answer };
  }

  function generateCaderno(seedBase, idx) {
    const seed = seedBase + "-" + idx;
    const rand = rng(seed);
    const problems = new Set();
    const arr = [];
    let attempts = 0;
    while (arr.length < questionsPerCaderno && attempts < questionsPerCaderno * 10) {
      const p = generateOneProblem(rand, operations);
      const key = `${p.a}_${p.op}_${p.b}`;
      if (!problems.has(key)) {
        problems.add(key);
        arr.push(p);
      }
      attempts++;
    }
    return arr;
  }

  function generateExamples() {
    // Create 1 example for each chosen operation
    const cfg = difficultyConfig[difficulty];
    const seed = "example-seed";
    const rand = rng(seed);
    const examples = [];
    if (operations.add) examples.push(generateOneProblem(rand, { add: true }));
    if (operations.sub) examples.push(generateOneProblem(rand, { sub: true }));
    if (operations.mul) examples.push(generateOneProblem(rand, { mul: true }));
    if (operations.div) examples.push(generateOneProblem(rand, { div: true }));
    return examples;
  }

  async function handleGeneratePDF() {
    // Create a container element with all cadernos
    const container = document.createElement("div");
    container.style.width = "210mm"; // A4 width

    const seedBase = Date.now().toString();
    for (let c = 0; c < numCadernos; c++) {
      const problems = generateCaderno(seedBase, c);

      // Cover page
      const cover = document.createElement("div");
      cover.className = "page cover";
      cover.style.minHeight = "297mm";
      cover.style.padding = "24mm";
      cover.style.boxSizing = "border-box";
      cover.innerHTML = `
        <div style='font-family: sans-serif; display:flex; flex-direction:column; justify-content:center; height:100%'>
          <h1 style='font-size:28pt; margin-bottom:8pt'>${title} - Caderno ${c + 1}</h1>
          <div style='margin-top:18pt; font-size:12pt'>Nome completo: _________________________________</div>
          <div style='margin-top:8pt; font-size:12pt'>Turma: _______________________</div>
          <div style='margin-top:18pt; font-size:10pt'>Gerado em: ${new Date().toLocaleString()}</div>
        </div>
      `;
      container.appendChild(cover);

      // Instruction page
      const inst = document.createElement("div");
      inst.className = "page inst";
      inst.style.minHeight = "297mm";
      inst.style.padding = "16mm";
      inst.style.boxSizing = "border-box";
      const examples = generateExamples();
      inst.innerHTML = `<h2 style='font-family:sans-serif'>Como fazer as operações</h2>`;
      const list = document.createElement("div");
      list.style.fontFamily = 'sans-serif';
      list.style.fontSize = '11pt';
      list.style.marginTop = '8pt';

      examples.forEach((ex) => {
        const el = document.createElement("div");
        el.style.marginBottom = '8pt';
        let explanation = '';
        if (ex.op === '+') explanation = `Some steps: alinhar colunas, somar unidades, levar o que for necessário.`;
        if (ex.op === '-') explanation = `Some steps: alinhar colunas, subtrair da direita para a esquerda, pedir emprestado quando necessário.`;
        if (ex.op === '×') explanation = `Some steps: multiplicar cada algarismo e somar linhas parciais.`;
        if (ex.op === '÷') explanation = `Some steps: dividir por tentativas, multiplicar e subtrair, trazer próximo algarismo. Se for exato, o resto será zero.`;
        el.innerHTML = `<strong>Exemplo:</strong> ${ex.text} <br/><em>Resposta:</em> ${ex.answer} <br/><span style='color:#333'>${explanation}</span>`;
        list.appendChild(el);
      });
      inst.appendChild(list);
      container.appendChild(inst);

      // Exercises pages: render questions in a simple grid, 2 columns
      const page = document.createElement("div");
      page.className = "page exercises";
      page.style.minHeight = "297mm";
      page.style.padding = "12mm";
      page.style.boxSizing = "border-box";
      page.style.fontFamily = 'sans-serif';

      const header = document.createElement("div");
      header.innerHTML = `<h3>${title} - Atividades</h3>`;
      page.appendChild(header);

      const table = document.createElement("div");
      table.style.display = 'grid';
      table.style.gridTemplateColumns = '1fr 1fr';
      table.style.gridGap = '12px';

      problems.forEach((p, i) => {
        const cell = document.createElement("div");
        cell.style.border = '1px solid #444';
        cell.style.padding = '8px';
        cell.style.minHeight = '40mm';
        cell.style.boxSizing = 'border-box';
        // quadriculado using background SVG inline
        cell.style.backgroundImage = `repeating-linear-gradient(0deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 1px, transparent 1px, transparent 24px), repeating-linear-gradient(90deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 1px, transparent 1px, transparent 24px)`;
        cell.style.backgroundSize = '24px 24px, 24px 24px';

        const qEl = document.createElement("div");
        qEl.style.fontSize = '14pt';
        qEl.style.marginBottom = '6px';
        qEl.textContent = `${i + 1}. ${p.text}`;

        cell.appendChild(qEl);
        // add space for the student to write the procedure: we'll leave the quadriculated background visible
        table.appendChild(cell);
      });

      page.appendChild(table);
      container.appendChild(page);

      // a page break element
      const pageBreak = document.createElement("div");
      pageBreak.style.pageBreakAfter = 'always';
      container.appendChild(pageBreak);
    }

    // convert the full container to PDF using html2pdf
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `${title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // append to body temporarily
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    try {
      await html2pdf().set(opt).from(container).save();
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar PDF: ' + err.message);
    } finally {
      document.body.removeChild(container);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Gerador de Cadernos de Operações</h1>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block font-semibold">Operações</label>
          <div className="flex gap-2 mt-2">
            <label className="inline-flex items-center"><input type="checkbox" checked={operations.add} onChange={() => setOperations(o => ({ ...o, add: !o.add }))} /> <span className="ml-2">Adição</span></label>
            <label className="inline-flex items-center"><input type="checkbox" checked={operations.sub} onChange={() => setOperations(o => ({ ...o, sub: !o.sub }))} /> <span className="ml-2">Subtração</span></label>
            <label className="inline-flex items-center"><input type="checkbox" checked={operations.mul} onChange={() => setOperations(o => ({ ...o, mul: !o.mul }))} /> <span className="ml-2">Multiplicação</span></label>
            <label className="inline-flex items-center"><input type="checkbox" checked={operations.div} onChange={() => setOperations(o => ({ ...o, div: !o.div }))} /> <span className="ml-2">Divisão</span></label>
          </div>
        </div>

        <div>
          <label className="block font-semibold">Configurações</label>
          <div className="mt-2">
            <label className="block">Título do caderno</label>
            <input className="border p-1 w-full" value={title} onChange={e => setTitle(e.target.value)} />

            <label className="block mt-2">Questões por caderno</label>
            <input type="number" className="border p-1 w-24" value={questionsPerCaderno} min={1} max={200} onChange={e => setQuestionsPerCaderno(Number(e.target.value))} />

            <label className="block mt-2">Quantidade de cadernos</label>
            <input type="number" className="border p-1 w-24" value={numCadernos} min={1} max={50} onChange={e => setNumCadernos(Number(e.target.value))} />

            <label className="block mt-2">Dificuldade</label>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="border p-1">
              <option value="facil">Fácil</option>
              <option value="medio">Médio</option>
              <option value="dificil">Difícil</option>
            </select>

            <label className="block mt-2 inline-flex items-center"><input type="checkbox" checked={divExact} onChange={() => setDivExact(v => !v)} /> <span className="ml-2">Divisões exatas (se ativado, resultados inteiros)</span></label>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={handleGeneratePDF}>Gerar PDF</button>
        <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => { setOperations({ add: true, sub: true, mul: true, div: true }); setQuestionsPerCaderno(20); setNumCadernos(1); setDifficulty('medio'); setDivExact(true); }}>Reset</button>
      </div>

      <p className="mt-4 text-sm text-gray-600">Dica: gere 1 caderno com 1 ou 2 questões para testar antes de gerar vários.</p>
    </div>
  );
}
