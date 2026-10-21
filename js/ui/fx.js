/* ui/fx.js — animações: entrada das telas, "+pontos" ao marcar, contadores,
   barra de progresso e comemoração quando o dia fecha.
   Os efeitos que precisam sobreviver ao redesenho da tela ficam numa camada própria (#fx). */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el, $ } = L.dom;

  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const layer = () => $("fx");

  /* ---------- entrada da tela ---------- */
  let enterUntil = 0;
  let lastPageKey = "";
  // chamado pelo render: anima só quando a tela muda (não a cada atualização do banco)
  function enter(view, pageKey) {
    if (pageKey !== lastPageKey) { lastPageKey = pageKey; enterUntil = Date.now() + 1100; }
    const on = Date.now() < enterUntil && !reduced();
    view.classList.toggle("enter", on);
    if (!on) return;
    [...view.children].forEach((c, i) => c.style.setProperty("--i", Math.min(i, 8)));
    view.querySelectorAll(".tlist, .plist, ol.board, .subs, .members, .settings, .mlist, .cands").forEach((list) =>
      [...list.children].forEach((c, j) => c.style.setProperty("--j", Math.min(j, 10))));
  }

  /* ---------- marcar tarefa ---------- */
  let flash = null;
  function markDone(task, key) {
    const D = L.rules.DIFF[task.diff];
    flash = { id: task.id + "|" + key, text: task.type === "normal" ? "+" + D.pts : "feita", taskId: task.id };
  }
  const isFlashing = (taskId, key) => !!flash && flash.id === taskId + "|" + key;
  const isFlashTask = (taskId) => !!flash && flash.taskId === taskId;

  function floatText(target, text) {
    if (reduced() || !target) return;
    const r = target.getBoundingClientRect();
    const n = el("span", { class: "float-pts" }, text);
    n.style.left = r.left + r.width / 2 + "px";
    n.style.top = r.top + "px";
    layer().append(n);
    setTimeout(() => n.remove(), 1000);
  }

  /* ---------- confete ---------- */
  function confetti(target) {
    if (reduced()) return;
    const r = target ? target.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 3, width: 0 };
    const colors = ["var(--accent)", "var(--gold)", "var(--fg)", "var(--neg)"];
    for (let i = 0; i < 28; i++) {
      const p = el("span", { class: "confetti" });
      const ang = (Math.PI * (i / 27)) + Math.PI; // leque para cima
      const dist = 70 + Math.random() * 110;
      p.style.left = r.left + r.width * Math.random() + "px";
      p.style.top = r.top + "px";
      p.style.background = colors[i % colors.length];
      p.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      p.style.setProperty("--dy", Math.sin(ang) * dist - 30 + "px");
      p.style.setProperty("--rot", (Math.random() * 720 - 360) + "deg");
      p.style.animationDelay = Math.random() * 80 + "ms";
      layer().append(p);
      setTimeout(() => p.remove(), 1400);
    }
  }

  /* ---------- números que contam ---------- */
  const shown = {};      // último valor mostrado por chave
  const running = {};
  function count(key, to, fmt) {
    const from = key in shown ? shown[key] : 0;
    shown[key] = to;
    if (from === to || reduced()) return fmt(to);
    if (running[key]) cancelAnimationFrame(running[key]);
    const t0 = performance.now(), dur = 650;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      const node = document.querySelector('[data-count="' + key + '"]');
      if (node) node.textContent = fmt(Math.round(from + (to - from) * e));
      running[key] = k < 1 ? requestAnimationFrame(step) : 0;
    };
    running[key] = requestAnimationFrame(step);
    return fmt(from);
  }

  /* ---------- barra de progresso ---------- */
  const bars = {};
  function bar(key, pct) {
    const fill = el("div", { class: "fill" });
    const from = key in bars ? bars[key] : 0;
    bars[key] = pct;
    fill.style.width = (reduced() ? pct : from) + "%";
    if (from !== pct && !reduced()) requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = pct + "%"; }));
    return fill;
  }

  /* ---------- depois de cada desenho ---------- */
  let lastDone = null;
  function afterRender() {
    if (flash) {
      const btn = document.querySelector('[data-mark="' + flash.id + '"]');
      floatText(btn, flash.text);
      flash = null;
    }
  }
  // comemora quando a última tarefa do dia é marcada
  function progress(done, total, meterEl) {
    if (lastDone !== null && total > 0 && done === total && lastDone < total) {
      requestAnimationFrame(() => confetti(meterEl));
    }
    lastDone = done;
  }

  L.fx = { enter, markDone, isFlashing, isFlashTask, afterRender, count, bar, progress, confetti };
})(window.Liga);
