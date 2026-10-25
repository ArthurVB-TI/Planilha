/* pages/charts.js — Gráficos: escolhe o projeto (e a listRat) e vê as tarefas de todos os integrantes.
   Tipos: Pontuação (linha do total acumulado), Calendário (dias com tarefas feitas),
   Ações (tarefas feitas por dia/semana, empilhadas por pessoa) e Por tarefa (quanto de cada tarefa foi feito).
   Tudo em SVG desenhado aqui, sem biblioteca. Cada gráfico tem dica ao passar o mouse e uma tabela.
   Só entra no gráfico o que conta no placar (participantes, dentro do período da listRat). */
window.Liga = window.Liga || {};
window.Liga.pages = window.Liga.pages || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el, $ } = L.dom;
  const { store, plural, fmtTotal } = L.text;
  const { addDays, todayKey, weekOf, curWeek, parseKey, shortDate, WD, isKey } = L.dates;
  const { DIFF } = L.rules;

  const rerender = () => L.app.render();
  const NS = "http://www.w3.org/2000/svg";
  const MAX_SERIES = 8;

  const TYPES = [
    ["pontos", "Pontuação"],
    ["calendario", "Calendário"],
    ["acoes", "Ações"],
    ["tarefas", "Por tarefa"],
  ];
  const RANGES = [["7", "7 dias"], ["30", "30 dias"], ["90", "90 dias"], ["tudo", "Tudo"]];

  function st() {
    if (!S.draft.charts) {
      const saved = store.get("liga.charts") || {};
      S.draft.charts = {
        pid: saved.pid || "", sid: "", range: saved.range || "30",
        type: TYPES.some((t) => t[0] === saved.type) ? saved.type : "pontos", table: false,
      };
    }
    return S.draft.charts;
  }
  const save = (c) => store.set("liga.charts", { pid: c.pid, range: c.range, type: c.type });

  /* ---------- svg ---------- */
  function svg(tag, attrs, ...kids) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs || {}) if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) n.append(c instanceof Node ? c : String(c));
    return n;
  }
  // coluna com a ponta de cima arredondada (base reta)
  function colPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    if (h <= 0) return "";
    return "M" + x + "," + (y + h) + "V" + (y + r) + "Q" + x + "," + y + " " + (x + r) + "," + y +
      "H" + (x + w - r) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) + "V" + (y + h) + "Z";
  }
  // barra deitada com a ponta direita arredondada
  function barPath(x, y, w, h, r) {
    r = Math.min(r, h / 2, w);
    if (w <= 0) return "";
    return "M" + x + "," + y + "H" + (x + w - r) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) +
      "V" + (y + h - r) + "Q" + (x + w) + "," + (y + h) + " " + (x + w - r) + "," + (y + h) + "H" + x + "Z";
  }
  // marcas "redondas" para os eixos: 0, 5, 10, 25, 50, 100…
  function niceTicks(lo, hi, n) {
    if (hi === lo) { hi = lo + 1; }
    const span = hi - lo, raw = span / Math.max(1, n);
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) || 10 * p;
    const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step;
    const out = [];
    for (let v = a; v <= b + step / 2; v += step) out.push(Math.round(v * 100) / 100);
    return out;
  }
  const compact = (n) => (Math.abs(n) >= 1000 ? (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil" : n.toLocaleString("pt-BR"));
  const dayLabel = (k) => WD[parseKey(k).getDay()].toLowerCase() + " " + shortDate(k);

  /* ---------- dica (tooltip) ---------- */
  function tipLayer(wrap) {
    const tip = el("div", { class: "ctip", role: "status", hidden: true });
    wrap.append(tip);
    return {
      show(x, y, title, rows) {
        tip.replaceChildren(el("div", { class: "ct-t", text: title }),
          ...rows.map((r) => el("div", { class: "ct-r" },
            r.color ? el("span", { class: "ct-k", style: "background:" + r.color }) : el("span"),
            el("span", { class: "ct-n", text: r.label }), el("b", { text: r.value }))));
        tip.hidden = false;
        const W = wrap.clientWidth, tw = tip.offsetWidth, th = tip.offsetHeight;
        let left = x + 14, top = y - th - 10;
        if (left + tw > W) left = Math.max(0, x - tw - 14);
        if (top < 0) top = y + 16;
        tip.style.left = left + "px";
        tip.style.top = top + "px";
      },
      hide() { tip.hidden = true; },
    };
  }
  const local = (wrap, ev) => { const r = wrap.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };

  /* ---------- dados ---------- */

  // cor fixa por pessoa: pela ordem no projeto (a cor segue a pessoa, nunca a posição no placar)
  function colorOf(p, uid) {
    const i = p.members.indexOf(uid);
    return i >= 0 && i < MAX_SERIES ? "var(--s" + (i + 1) + ")" : "var(--s-other)";
  }

  // dias em que uma obrigatória ficou sem fazer (dentro do período em que vale)
  function missedKeys(task, done) {
    const sp = L.score.span(task), out = [];
    if (sp.prep) return out;
    if (task.kind === "daily") {
      let end = addDays(todayKey(), -1);
      if (sp.end && sp.end < end) end = sp.end;
      for (let k = sp.from, i = 0; k <= end && i < 4000; k = addDays(k, 1), i++) if (!done.has(k)) out.push(k);
    } else {
      let end = addDays(curWeek(), -7);
      if (sp.end && weekOf(sp.end) < end) end = weekOf(sp.end);
      for (let k = weekOf(sp.from), i = 0; k <= end && i < 600; k = addDays(k, 7), i++) if (!done.has(k)) out.push(k);
    }
    return out;
  }

  // tudo o que aconteceu, por pessoa e por dia: { uid: { dia: { done, miss, plus, minus } } }
  function events(tasks) {
    const by = {};
    const cell = (uid, k) => ((by[uid] = by[uid] || {})[k] = by[uid][k] || { done: 0, miss: 0, plus: 0, minus: 0 });
    for (const t of tasks) {
      const r = L.score.taskResult(t), D = DIFF[t.diff];
      for (const k of r.done) { const c = cell(t.assignee, k); c.done++; if (t.type === "normal") c.plus += D.pts; }
      if (t.type === "obrigatoria") for (const k of missedKeys(t, r.done)) { const c = cell(t.assignee, k); c.miss++; if (L.rules.OBR_PENALTY) c.minus += D.pen; }
    }
    return by;
  }

  function rangeKeys(c, tasks) {
    const to = todayKey();
    let from;
    if (c.range === "tudo") {
      from = tasks.reduce((m, t) => { const f = L.score.span(t).from; return f < m ? f : m; }, to);
      if (from < addDays(to, -364)) from = addDays(to, -364);
    } else from = addDays(to, -(+c.range - 1));
    const keys = [];
    for (let k = from, i = 0; k <= to && i < 400; k = addDays(k, 1), i++) keys.push(k);
    return keys;
  }

  /* ---------- 1. Pontuação: total acumulado por pessoa ---------- */
  function scoreChart(ctx) {
    const { p, people, ev, keys, W } = ctx;
    const series = people.map((uid) => {
      const e = ev[uid] || {};
      let acc = 0;
      for (const k in e) if (k < keys[0]) acc += e[k].plus - e[k].minus;
      const base = acc;
      const vals = keys.map((k) => { const c = e[k]; if (c) acc += c.plus - c.minus; return acc; });
      return { uid, vals, base, color: colorOf(p, uid), name: L.ui.nameOf(uid) };
    });
    const all = series.flatMap((s) => s.vals);
    const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all), 4);
    const lo = ticks[0], hi = ticks[ticks.length - 1];
    const labelW = series.length <= 4 ? Math.min(130, Math.max(70, W * 0.16)) : 12;
    const m = { l: 46, r: labelW, t: 14, b: 28 };
    const H = 300, iw = W - m.l - m.r, ih = H - m.t - m.b;
    const X = (i) => m.l + (keys.length === 1 ? iw / 2 : (i / (keys.length - 1)) * iw);
    const Y = (v) => m.t + ih - ((v - lo) / (hi - lo || 1)) * ih;

    const g = svg("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, class: "chart", role: "img",
      "aria-label": "Pontuação acumulada por pessoa de " + shortDate(keys[0]) + " a " + shortDate(keys[keys.length - 1]) });
    for (const v of ticks) {
      g.append(svg("line", { x1: m.l, x2: m.l + iw, y1: Y(v), y2: Y(v), class: v === 0 ? "zero" : "grid" }),
        svg("text", { x: m.l - 8, y: Y(v) + 4, class: "tick", "text-anchor": "end" }, compact(v)));
    }
    // datas no eixo x (umas 5)
    // quantas datas cabem sem encostar (uma a cada ~60px)
    const fit = Math.max(2, Math.floor(iw / 60));
    const every = Math.max(1, Math.ceil(keys.length / fit));
    keys.forEach((k, i) => { if ((i % every === 0 && keys.length - 1 - i >= every / 2) || i === keys.length - 1) g.append(svg("text", { x: X(i), y: H - 8, class: "tick", "text-anchor": i === 0 ? "start" : i === keys.length - 1 ? "end" : "middle" }, shortDate(k))); });

    for (const s of series) {
      const d = s.vals.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1)).join("");
      g.append(svg("path", { d, class: "line", style: "stroke:" + s.color }));
      const li = s.vals.length - 1;
      g.append(svg("circle", { cx: X(li), cy: Y(s.vals[li]), r: 4.5, class: "dot", style: "fill:" + s.color }));
    }
    // nomes no fim das linhas (até 4 pessoas e sem encostar uma na outra)
    if (series.length <= 4) {
      const ends = series.map((s) => ({ s, y: Y(s.vals[s.vals.length - 1]) })).sort((a, b) => a.y - b.y);
      const clash = ends.some((e, i) => i && e.y - ends[i - 1].y < 14);
      if (!clash) for (const e of ends) g.append(svg("text", { x: m.l + iw + 10, y: e.y + 4, class: "end-l" }, e.s.name + " " + fmtTotal(e.s.vals[e.s.vals.length - 1])));
    }

    // linha que acompanha o mouse + dica
    const cross = svg("line", { y1: m.t, y2: m.t + ih, class: "cross", visibility: "hidden" });
    const hit = svg("rect", { x: m.l, y: m.t, width: iw, height: ih, class: "hit" });
    g.append(cross, hit);
    ctx.after = (wrap) => {
      const tip = tipLayer(wrap);
      const move = (ev) => {
        const [x, y] = local(wrap, ev);
        const sx = x - (wrap.clientWidth - W) / 2;
        const i = Math.max(0, Math.min(keys.length - 1, Math.round(((sx - m.l) / iw) * (keys.length - 1))));
        cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i)); cross.setAttribute("visibility", "visible");
        tip.show(x, y, dayLabel(keys[i]), series.slice().sort((a, b) => b.vals[i] - a.vals[i])
          .map((s) => ({ color: s.color, label: s.name, value: fmtTotal(s.vals[i]) })));
      };
      hit.addEventListener("pointermove", move);
      hit.addEventListener("pointerdown", move);
      hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); tip.hide(); });
    };
    ctx.table = () => table(["Pessoa", "Início do período", "Agora", "Variação"],
      series.map((s) => {
        const z = s.vals[s.vals.length - 1];
        return [s.name, fmtTotal(s.base), fmtTotal(z), L.text.fmtPts(z - s.base)];
      }));
    ctx.legend = series.length >= 2;
    return g;
  }

  /* ---------- 2. Calendário: um quadradinho por dia, mais escuro/claro = mais tarefas feitas ---------- */
  function calendarChart(ctx) {
    const { p, people, ev, keys } = ctx;
    const w0 = weekOf(keys[0]), w1 = weekOf(keys[keys.length - 1]);
    const weeks = [];
    for (let k = w0; k <= w1; k = addDays(k, 7)) weeks.push(k);
    const inRange = (k) => k >= keys[0] && k <= keys[keys.length - 1];
    let max = 0;
    for (const uid of people) for (const k in ev[uid] || {}) if (inRange(k)) max = Math.max(max, ev[uid][k].done);
    const level = (n) => (n <= 0 ? 0 : max <= 4 ? Math.min(4, n) : Math.min(4, Math.ceil((n / max) * 4)));

    // poucos dias: quadrados maiores e um calendário ao lado do outro
    const cs = weeks.length <= 6 ? 22 : Math.max(11, Math.min(18, Math.floor((ctx.W - 40) / Math.max(weeks.length, 1)) - 3));
    const gap = 3, left = 30, top = 18;
    const gw = left + weeks.length * (cs + gap), gh = top + 7 * (cs + gap);
    const blocks = el("div", { class: "cal-grid", style: "grid-template-columns:repeat(auto-fill,minmax(" + Math.min(gw + 8, ctx.W) + "px,1fr))" });
    const cells = [];

    for (const uid of people) {
      const e = ev[uid] || {};
      let doneN = 0, missN = 0;
      const g = svg("svg", { width: gw, height: gh, viewBox: "0 0 " + gw + " " + gh, class: "chart cal", role: "img",
        "aria-label": "Calendário de " + L.ui.nameOf(uid) });
      // meses no topo
      let lastM = -1;
      weeks.forEach((wk, i) => {
        const d = parseKey(wk), mth = d.getMonth();
        if (mth !== lastM) { lastM = mth; g.append(svg("text", { x: left + i * (cs + gap), y: 11, class: "tick" }, d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""))); }
      });
      ["seg", "", "qua", "", "sex", "", "dom"].forEach((t, r) => { if (t) g.append(svg("text", { x: 0, y: top + r * (cs + gap) + cs - 2, class: "tick" }, t)); });
      weeks.forEach((wk, i) => {
        for (let r = 0; r < 7; r++) {
          const k = addDays(wk, r);
          if (!inRange(k)) continue;
          const c = e[k] || { done: 0, miss: 0 };
          doneN += c.done; missN += c.miss;
          const rect = svg("rect", { x: left + i * (cs + gap), y: top + r * (cs + gap), width: cs, height: cs, rx: 3,
            class: "cell l" + level(c.done) + (c.miss ? " miss" : "") });
          cells.push({ rect, uid, k, c });
          g.append(rect);
          if (c.miss) g.append(svg("circle", { cx: left + i * (cs + gap) + cs - 3, cy: top + r * (cs + gap) + 3, r: 2, class: "miss-dot" }));
        }
      });
      blocks.append(el("div", { class: "cal-one" },
        el("div", { class: "cal-h" }, el("span", { class: "ct-k", style: "background:" + colorOf(p, uid) }),
          el("b", { text: L.ui.nameOf(uid) }), el("span", { class: "small muted" }, plural(doneN, "feita", "feitas") + (missN ? " · " + plural(missN, "obrigatória perdida", "obrigatórias perdidas") : ""))),
        el("div", { class: "cal-scroll" }, g)));
    }
    blocks.append(el("div", { class: "cal-legend small muted", style: "grid-column:1/-1" }, "menos",
      [0, 1, 2, 3, 4].map((l) => el("span", { class: "sw l" + l })), "mais",
      el("span", { class: "sw-miss" }), "obrigatória perdida"));

    ctx.after = (wrap) => {
      const tip = tipLayer(wrap);
      for (const { rect, uid, k, c } of cells) {
        const show = (ev) => {
          const [x, y] = local(wrap, ev);
          const rows = [{ label: "Feitas", value: String(c.done) }];
          if (c.miss) rows.push({ label: "Obrigatórias perdidas", value: String(c.miss) });
          if (c.plus || c.minus) rows.push({ label: "Pontos do dia", value: L.text.fmtPts(c.plus - c.minus) });
          tip.show(x, y, L.ui.nameOf(uid) + " · " + dayLabel(k), rows);
        };
        rect.addEventListener("pointerenter", show);
        rect.addEventListener("pointerdown", show);
        rect.addEventListener("pointerleave", () => tip.hide());
      }
    };
    ctx.table = () => table(["Dia"].concat(people.map((u) => L.ui.nameOf(u))),
      keys.slice().reverse().map((k) => [dayLabel(k)].concat(people.map((u) => {
        const c = (ev[u] || {})[k];
        return c ? c.done + (c.miss ? " (−" + c.miss + ")" : "") : "0";
      }))));
    ctx.legend = false;   // cada calendário já tem o nome
    return blocks;
  }

  /* ---------- 3. Ações: tarefas feitas por dia (ou semana), empilhadas por pessoa ---------- */
  function actionsChart(ctx) {
    const { p, people, ev, keys, W } = ctx;
    const weekly = keys.length > 31;
    const buckets = [];
    if (weekly) { for (let k = weekOf(keys[0]); k <= keys[keys.length - 1]; k = addDays(k, 7)) buckets.push(k); }
    else buckets.push(...keys);
    const inB = (k, b) => (weekly ? weekOf(k) === b : k === b) && k >= keys[0];
    const data = buckets.map((b) => {
      const parts = people.map((uid) => {
        let n = 0;
        for (const k in ev[uid] || {}) if (inB(k, b)) n += ev[uid][k].done;
        return { uid, n };
      });
      return { b, parts, total: parts.reduce((a, x) => a + x.n, 0) };
    });
    const ticks = niceTicks(0, Math.max(1, ...data.map((d) => d.total)), 4);
    const hi = ticks[ticks.length - 1];
    const m = { l: 40, r: 10, t: 14, b: 28 }, H = 280, iw = W - m.l - m.r, ih = H - m.t - m.b;
    const band = iw / buckets.length, bw = Math.max(3, Math.min(24, band * 0.62));
    const Y = (v) => (v / hi) * ih;

    const g = svg("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, class: "chart", role: "img",
      "aria-label": "Tarefas feitas por " + (weekly ? "semana" : "dia") });
    for (const v of ticks) g.append(svg("line", { x1: m.l, x2: m.l + iw, y1: m.t + ih - Y(v), y2: m.t + ih - Y(v), class: v === 0 ? "zero" : "grid" }),
      svg("text", { x: m.l - 8, y: m.t + ih - Y(v) + 4, class: "tick", "text-anchor": "end" }, compact(v)));
    const every = Math.max(1, Math.ceil(buckets.length / Math.max(2, Math.floor(iw / 56))));
    const hits = [];
    data.forEach((d, i) => {
      const x = m.l + i * band + (band - bw) / 2;
      let base = m.t + ih;
      const shown = d.parts.filter((x2) => x2.n > 0);
      shown.forEach((part, j) => {
        const h = Y(part.n);
        const top = j === shown.length - 1;
        const gapH = j ? 2 : 0;   // 2px de fundo entre as partes empilhadas
        const y = base - h;
        g.append(top
          ? svg("path", { d: colPath(x, y, bw, h - gapH, 4), style: "fill:" + colorOf(p, part.uid) })
          : svg("rect", { x, y, width: bw, height: Math.max(0, h - gapH), style: "fill:" + colorOf(p, part.uid) }));
        base = y;
      });
      if (i % every === 0) g.append(svg("text", { x: m.l + i * band + band / 2, y: H - 8, class: "tick", "text-anchor": "middle" }, shortDate(d.b)));
      const hit = svg("rect", { x: m.l + i * band, y: m.t, width: band, height: ih, class: "hit" });
      hits.push({ hit, d });
      g.append(hit);
    });
    // valor no topo da maior coluna
    const best = data.reduce((a, d) => (d.total > (a ? a.total : 0) ? d : a), null);
    if (best) { const i = data.indexOf(best); g.append(svg("text", { x: m.l + i * band + band / 2, y: m.t + ih - Y(best.total) - 6, class: "val", "text-anchor": "middle" }, String(best.total))); }

    ctx.after = (wrap) => {
      const tip = tipLayer(wrap);
      for (const { hit, d } of hits) {
        const show = (ev) => {
          const [x, y] = local(wrap, ev);
          tip.show(x, y, (weekly ? "Semana de " + shortDate(d.b) : dayLabel(d.b)) + " · " + plural(d.total, "feita", "feitas"),
            d.parts.filter((q) => q.n).map((q) => ({ color: colorOf(p, q.uid), label: L.ui.nameOf(q.uid), value: String(q.n) })));
        };
        hit.addEventListener("pointerenter", show);
        hit.addEventListener("pointermove", show);
        hit.addEventListener("pointerdown", show);
        hit.addEventListener("pointerleave", () => tip.hide());
      }
    };
    ctx.table = () => table([weekly ? "Semana" : "Dia"].concat(people.map((u) => L.ui.nameOf(u)), ["Total"]),
      data.slice().reverse().map((d) => [weekly ? "Semana de " + shortDate(d.b) : dayLabel(d.b)].concat(d.parts.map((q) => String(q.n)), [String(d.total)])));
    ctx.legend = people.length >= 2;
    ctx.note = weekly ? "Somado por semana (começando na segunda)." : "Somado por dia.";
    return g;
  }

  /* ---------- 4. Por tarefa: quanto de cada tarefa foi feito no período ---------- */
  function tasksChart(ctx) {
    const { p, tasks, keys, W } = ctx;
    const a = keys[0], z = keys[keys.length - 1];
    const rows = [];
    for (const t of tasks) {
      const sp = L.score.span(t);
      if (sp.prep) continue;
      const r = L.score.taskResult(t);
      let possible = 0, done = 0;
      if (t.kind === "daily") {
        let from = sp.from > a ? sp.from : a, to = z;
        if (sp.end && sp.end < to) to = sp.end;
        for (let k = from, i = 0; k <= to && i < 400; k = addDays(k, 1), i++) { possible++; if (r.done.has(k)) done++; }
      } else {
        let from = weekOf(sp.from > a ? sp.from : a), to = weekOf(z);
        if (sp.end && weekOf(sp.end) < to) to = weekOf(sp.end);
        for (let k = from, i = 0; k <= to && i < 60; k = addDays(k, 7), i++) { possible++; if (r.done.has(k)) done++; }
      }
      if (!possible) continue;
      rows.push({ t, possible, done, rate: done / possible });
    }
    if (!rows.length) return L.ui.empty("Nenhuma tarefa valendo nesse período.");
    rows.sort((x, y) => p.members.indexOf(x.t.assignee) - p.members.indexOf(y.t.assignee) || y.rate - x.rate);

    const labelW = Math.min(220, Math.max(120, W * 0.32)), valW = 64;
    const rowH = 34, H = rows.length * rowH + 8, iw = W - labelW - valW;
    const g = svg("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, class: "chart", role: "img", "aria-label": "Quanto de cada tarefa foi feito" });
    const hits = [];
    rows.forEach((row, i) => {
      const y = 4 + i * rowH, sub = S.subs[row.t.subId];
      g.append(
        svg("text", { x: 0, y: y + 13, class: "rl" }, row.t.title.length > 26 ? row.t.title.slice(0, 25) + "…" : row.t.title),
        svg("text", { x: 0, y: y + 27, class: "tick" }, L.ui.nameOf(row.t.assignee) + (sub ? " · " + sub.name : "") + (row.t.type === "obrigatoria" ? " · obrig." : "")),
        svg("rect", { x: labelW, y: y + 9, width: iw, height: 12, rx: 2, class: "track" }),
        row.rate > 0 ? svg("path", { d: barPath(labelW, y + 9, Math.max(4, row.rate * iw), 12, 4), style: "fill:" + colorOf(p, row.t.assignee) }) : null,
        svg("text", { x: labelW + iw + 8, y: y + 19, class: "val" }, Math.round(row.rate * 100) + "%"));
      const hit = svg("rect", { x: 0, y, width: W, height: rowH, class: "hit" });
      hits.push({ hit, row });
      g.append(hit);
    });
    ctx.after = (wrap) => {
      const tip = tipLayer(wrap);
      for (const { hit, row } of hits) {
        const show = (ev) => {
          const [x, y] = local(wrap, ev);
          const unit = row.t.kind === "daily" ? ["dia", "dias"] : ["semana", "semanas"];
          tip.show(x, y, row.t.title, [
            { color: colorOf(p, row.t.assignee), label: L.ui.nameOf(row.t.assignee), value: Math.round(row.rate * 100) + "%" },
            { label: "Feita", value: row.done + " de " + plural(row.possible, unit[0], unit[1]) },
            { label: "Tipo", value: (row.t.type === "obrigatoria" ? "Obrigatória" : "Normal") + " · " + DIFF[row.t.diff].label },
          ]);
        };
        hit.addEventListener("pointerenter", show);
        hit.addEventListener("pointermove", show);
        hit.addEventListener("pointerdown", show);
        hit.addEventListener("pointerleave", () => tip.hide());
      }
    };
    ctx.table = () => table(["Tarefa", "Pessoa", "Feita", "Possível", "%"],
      rows.map((r) => [r.t.title, L.ui.nameOf(r.t.assignee), String(r.done), String(r.possible), Math.round(r.rate * 100) + "%"]));
    ctx.legend = new Set(rows.map((r) => r.t.assignee)).size >= 2;
    ctx.note = "Dias (ou semanas) feitos dentro do período em que a tarefa vale.";
    return g;
  }

  function table(head, rows) {
    return el("div", { class: "ctable-wrap" }, el("table", { class: "legend ctable" },
      el("thead", null, el("tr", null, head.map((h, i) => el("th", { class: i ? "r" : "" }, h)))),
      el("tbody", null, rows.map((r) => el("tr", null, r.map((c, i) => el("td", { class: i ? "r num" : "" }, c)))))));
  }

  /* ---------- página ---------- */
  L.pages.charts = function (v) {
    L.ui.crumbs([{ label: "Gráficos" }]);
    const c = st();
    const projects = L.ui.visibleProjects();
    v.append(L.ui.pageHead("Gráficos", "As tarefas de todos os integrantes de um projeto"));
    if (!projects.length) { v.append(L.ui.empty("Você ainda não está em nenhum projeto.")); return; }
    if (!projects.some((p) => p.id === c.pid)) c.pid = projects[0].id;
    const p = S.projects[c.pid];
    const subs = Object.values(S.subs).filter((s) => s.projectId === p.id).sort((a, b) => a.createdAt - b.createdAt);
    if (c.sid && !subs.some((s) => s.id === c.sid)) c.sid = "";

    const set = (k, val) => { c[k] = val; if (k === "pid") c.sid = ""; save(c); rerender(); };
    const segOf = (k, opts, label) => el("div", { class: "seg", role: "group", "aria-label": label }, opts.map(([val, lab]) =>
      el("button", { type: "button", class: c[k] === val ? "on" : "", "aria-pressed": c[k] === val ? "true" : "false", onclick: () => set(k, val) }, lab)));

    // filtros numa linha só
    v.append(el("div", { class: "cfilters" },
      el("div", { class: "field" }, el("label", { for: "cProj" }, "Projeto"),
        el("select", { id: "cProj", value: c.pid, onchange: (e) => set("pid", e.target.value) },
          projects.map((x) => el("option", { value: x.id }, x.name)))),
      el("div", { class: "field" }, el("label", { for: "cSub" }, "ListRat"),
        el("select", { id: "cSub", value: c.sid, onchange: (e) => set("sid", e.target.value) },
          el("option", { value: "" }, "Todas"), subs.map((s) => el("option", { value: s.id }, s.name)))),
      el("div", { class: "field" }, el("span", { class: "lbl" }, "Período"), segOf("range", RANGES, "Período"))));

    // tipo de gráfico
    v.append(el("div", { class: "ctabs", role: "tablist", "aria-label": "Tipo de gráfico" }, TYPES.map(([k, label]) =>
      el("button", { type: "button", role: "tab", class: c.type === k ? "on" : "", "aria-selected": c.type === k ? "true" : "false",
        onclick: () => { c.table = false; set("type", k); } }, label))));

    const tasks = L.score.tasksOfProject(p.id)
      .filter((t) => (!c.sid || t.subId === c.sid) && L.score.counts(t) && !L.score.span(t).prep);
    const people = p.members.filter((uid) => tasks.some((t) => t.assignee === uid));
    const panel = el("section", { class: "panel cpanel" });
    v.append(panel);

    if (!tasks.length) {
      const prep = L.score.tasksOfProject(p.id).some((t) => (!c.sid || t.subId === c.sid) && L.score.span(t).prep);
      panel.append(L.ui.empty(prep ? "As listRats escolhidas ainda estão em inscrições. Os gráficos aparecem quando elas começarem." : "Ainda não tem tarefas valendo aqui."));
      return;
    }

    const keys = rangeKeys(c, tasks);
    const W = Math.max(300, Math.min(1080, ($("view").clientWidth || 900) - 40));
    const ctx = { p, tasks, people, keys, ev: events(tasks), W };
    const titles = { pontos: "Pontuação acumulada", calendario: "Calendário de tarefas feitas", acoes: "Tarefas feitas", tarefas: "Por tarefa" };
    const chart = c.type === "calendario" ? calendarChart(ctx) : c.type === "acoes" ? actionsChart(ctx) : c.type === "tarefas" ? tasksChart(ctx) : scoreChart(ctx);

    panel.append(el("div", { class: "panel-head" },
      el("h2", null, titles[c.type]),
      el("span", { class: "muted" }, shortDate(keys[0]) + " a " + shortDate(keys[keys.length - 1]) + " · " + plural(people.length, "pessoa", "pessoas"))));
    if (ctx.legend) {
      panel.append(el("div", { class: "clegend" }, people.map((uid) =>
        el("span", { class: "cl" }, el("span", { class: "ct-k", style: "background:" + colorOf(p, uid) }), L.ui.nameOf(uid)))));
    }
    const wrap = el("div", { class: "cwrap" }, chart);
    panel.append(wrap);
    if (ctx.after) ctx.after(wrap);
    panel.append(el("div", { class: "cfoot" },
      el("span", { class: "hint" }, ctx.note || "Só conta o que vale no placar: participantes, dentro do período de cada listRat."),
      ctx.table ? el("button", { class: "link", type: "button", "aria-expanded": c.table ? "true" : "false", onclick: () => { c.table = !c.table; rerender(); } },
        c.table ? "esconder tabela" : "ver como tabela") : null));
    if (c.table && ctx.table) panel.append(ctx.table());
  };

  // redesenha ao mudar o tamanho da tela (os gráficos usam a largura disponível)
  let rt = 0, lastW = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      const w = ($("view") && $("view").clientWidth) || 0;
      if (S.view && S.view.page === "charts" && Math.abs(w - lastW) > 30) { lastW = w; rerender(); }
    }, 150);
  });
})(window.Liga);
