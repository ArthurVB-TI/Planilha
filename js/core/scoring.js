/* scoring.js — cálculo dos pontos. Nada de pontos é gravado no banco:
   tudo é recalculado aqui a partir das tarefas e das marcações válidas. */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { DIFF } = L.rules;
  const { isKey, addDays, weekOf, todayKey, curWeek } = L.dates;

  function playerDoc(pid) {
    return S.mine && pid === S.myId ? S.mine : S.players[pid];
  }

  function marksOf(pid, taskId) {
    const p = playerDoc(pid);
    const arr = p && p.done && typeof p.done === "object" ? p.done[taskId] : null;
    return Array.isArray(arr) ? arr : [];
  }

  /* ---------- prova (foto ou comentário) ---------- */
  // último dia do período marcado (diária: o próprio dia; semanal: o domingo) e o último dia para pôr a prova
  const dueKey = (task, k) => (task.kind === "daily" ? k : addDays(k, 6));
  // prazo para pôr a prova (e mexer no dia): até o dia seguinte ao fim da listRat, para qualquer dia dela.
  // ListRat sem fim: até 7 dias depois do prazo do dia.
  function proofLimit(task, k) {
    const sp = span(task);
    const base = addDays(dueKey(task, k), L.rules.PROOF_GRACE);
    const lim = sp.end ? addDays(sp.end, L.rules.PROOF_GRACE) : addDays(dueKey(task, k), 7);
    return lim > base ? lim : base;
  }
  const needsProof = (task, k) => dueKey(task, k) >= L.rules.PROOF_FROM;
  function proofOf(pid, taskId, k) {
    const p = playerDoc(pid);
    const ph = p && p.proofs && p.proofs[taskId] && p.proofs[taskId][k];
    const nt = p && p.notes && p.notes[taskId] && p.notes[taskId][k];
    const at = p && p.proofAt && p.proofAt[taskId] && p.proofAt[taskId][k];
    const photos = L.rules.photoList(ph);
    return { photos, photo: photos[0] || "", note: typeof nt === "string" && nt.trim() ? nt : "", at: Number(at) || 0 };
  }
  const hasProof = (pid, taskId, k) => { const x = proofOf(pid, taskId, k); return !!(x.photo || x.note); };

  /* Período em que a tarefa vale: do dia em que foi criada (ou do início da listRat,
     o que vier depois) até o fim da listRat (se tiver). Fora dele não ganha nem perde ponto. */
  const NEVER = "9999-12-31";
  function span(task) {
    const s = S.subs[task.subId];
    // em inscrições nada vale ainda
    if (s && s.status === "inscricoes") return { from: NEVER, end: null, prep: true };
    let from = task.startKey;
    if (s && s.start && s.start > from) from = s.start;
    if (s && s.startedAt && s.startedAt > from) from = s.startedAt;
    const j = s && s.joined && s.joined[task.assignee];
    if (j && j > from) from = j;
    return { from, end: (s && s.end) || null, prep: false };
  }
  const minKey = (a, b) => (b && b < a ? b : a);

  // a tarefa está valendo hoje (diárias) / nesta semana (semanais)?
  function activeNow(task) {
    const { from, end } = span(task);
    if (task.kind === "daily") { const t = todayKey(); return t >= from && (!end || t <= end); }
    const cw = curWeek();
    return cw >= weekOf(from) && (!end || cw <= weekOf(end));
  }

  // só valem datas dentro do período (e até hoje); nas semanais, segundas-feiras
  function validMarks(task, raw) {
    const set = new Set();
    const { from, end } = span(task);
    if (task.kind === "daily") {
      const last = minKey(todayKey(), end);
      for (const k of raw) if (isKey(k) && k >= from && k <= last) set.add(k);
    } else {
      const sw = weekOf(from), last = minKey(curWeek(), end && weekOf(end));
      for (const k of raw) if (isKey(k) && k === weekOf(k) && k >= sw && k <= last) set.add(k);
    }
    return set;
  }

  // resultado de uma tarefa para quem é responsável por ela.
  // Conta como feito: o que a pessoa marcou + justificativas aceitas pelo dono/ajudante.
  // Tarefa que perdeu a contestação fica sem nenhum dia feito (opts.raw ignora a contestação).
  // pend = marcados sem foto nem comentário, ainda no prazo da prova (não valem pontos ainda, mas não são "faltou");
  // unproven = marcados sem prova e o prazo da prova já passou (não contam)
  function taskResult(task, opts) {
    const R = L.review;
    const today = todayKey();
    const pend = new Set(), unproven = new Set();
    const marks = validMarks(task, marksOf(task.assignee, task.id));
    const proved = [];
    for (const k of marks) {
      if (!needsProof(task, k) || hasProof(task.assignee, task.id, k)) proved.push(k);
      else if (today <= proofLimit(task, k)) pend.add(k);
      else unproven.add(k);
    }
    // justificativa aceita conta como feita (já foi julgada, não precisa de prova)
    let done = validMarks(task, R ? proved.concat(R.acceptedKeys(task)) : proved);
    for (const k of done) pend.delete(k);
    const voided = !(opts && opts.raw) && !!R && R.taskLost(task);
    if (voided) done = new Set();
    const D = DIFF[task.diff];
    if (task.type === "normal") return { done, pend, unproven, plus: D.pts * done.size, minus: 0, missed: 0, voided };

    let missed = 0;
    const sp = span(task);
    if (task.kind === "daily") {
      const end = minKey(addDays(todayKey(), -1), sp.end);
      for (let k = sp.from, i = 0; k <= end && i < 4000; k = addDays(k, 1), i++) if (!done.has(k) && !pend.has(k)) missed++;
    } else {
      const end = minKey(addDays(curWeek(), -7), sp.end && weekOf(sp.end));
      for (let k = weekOf(sp.from), i = 0; k <= end && i < 600; k = addDays(k, 7), i++) if (!done.has(k) && !pend.has(k)) missed++;
    }
    return { done, pend, unproven, plus: 0, minus: L.rules.OBR_PENALTY ? D.pen * missed : 0, missed, voided };
  }

  const periodKey = (task) => (task.kind === "daily" ? todayKey() : curWeek());
  const doneNow = (task) => taskResult(task).done.has(periodKey(task));

  function tasksOfProject(pid) {
    return Object.values(S.tasks).filter((t) => S.subs[t.subId] && S.subs[t.subId].projectId === pid);
  }

  // a tarefa só conta se o responsável ainda é integrante do projeto
  // e, nas listRats com inscrição, se ele entrou como participante
  function counts(task) {
    const sub = S.subs[task.subId];
    const p = sub && S.projects[sub.projectId];
    if (!p || !p.members.includes(task.assignee)) return false;
    return isParticipant(sub, task.assignee);
  }
  // participantes: os gravados quando a listRat começou (listRat antiga = todos os integrantes)
  function isParticipant(sub, uid) {
    if (!sub) return false;
    if (sub.kicked && sub.kicked.includes(uid)) return false;   // tirado pelo dono
    if (sub.status === "inscricoes") return true;
    return !sub.participants || sub.participants.includes(uid);
  }

  function scoreFor(pid, tasks) {
    let plus = 0, minus = 0;
    for (const t of tasks) {
      if (t.assignee !== pid || !counts(t)) continue;
      const r = taskResult(t);
      plus += r.plus;
      minus += r.minus;
    }
    return { plus, minus, total: plus - minus };
  }

  /* ---------- porcentagem ---------- */
  // dias (ou semanas) que já "valeram" numa tarefa: os que já acabaram dentro do período
  // + o de agora, se já foi feito (assim a porcentagem não cai só porque o dia ainda não terminou)
  function possibleKeys(task, r) {
    const sp = span(task);
    if (sp.prep) return [];
    r = r || taskResult(task);
    const t = todayKey(), ended = !!sp.end && t > sp.end, out = [];
    if (task.kind === "daily") {
      const last = ended ? sp.end : addDays(t, -1);
      for (let k = sp.from, i = 0; k <= last && i < 4000; k = addDays(k, 1), i++) out.push(k);
      if (!ended && t >= sp.from && r.done.has(t)) out.push(t);
    } else {
      const cw = curWeek();
      const last = ended ? weekOf(sp.end) : addDays(cw, -7);
      for (let k = weekOf(sp.from), i = 0; k <= last && i < 600; k = addDays(k, 7), i++) out.push(k);
      if (!ended && cw >= weekOf(sp.from) && r.done.has(cw)) out.push(cw);
    }
    return out;
  }
  // porcentagem de uma pessoa: pontos feitos ÷ pontos que dava para ter feito (só tarefas normais;
  // obrigatórias não valem pontos). pct = null quando ainda não dava para ter feito nada.
  function percentFor(pid, tasks) {
    let earned = 0, possible = 0;
    for (const t of tasks) {
      if (t.assignee !== pid || t.type !== "normal" || !counts(t)) continue;
      const r = taskResult(t), pts = DIFF[t.diff].pts;
      earned += r.done.size * pts;
      possible += possibleKeys(t, r).length * pts;
    }
    return { earned, possible, pct: possible ? Math.min(100, (earned / possible) * 100) : null };
  }
  const isPercent = (s) => !!s && s.scoring === "porcentagem";
  const fmtPct = (n) => (n == null ? "—" : (Math.round(n * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%");
  // posição no placar: em porcentagem ou em pontos, conforme a listRat
  function standing(pid, tasks, pct) {
    if (pct) {
      const x = percentFor(pid, tasks);
      return { value: x.pct == null ? -1 : x.pct, text: fmtPct(x.pct), detail: x.earned.toLocaleString("pt-BR") + " de " + x.possible.toLocaleString("pt-BR") + " pts", neg: false, pct: x };
    }
    const sc = scoreFor(pid, tasks);
    return { value: sc.total, text: L.text.fmtTotal(sc.total), detail: "", neg: sc.total < 0, sc };
  }

  /* ---------- dinheiro do top 3 e dos 3 piores ---------- */
  // rows = [{ id, value }] já em ordem (melhor primeiro). Empate divide a posição (os dois levam o valor dela).
  // Quem está no top 3 não paga; os 3 piores são contados de baixo para cima entre os outros.
  const hasMoney = (s) => !!s && !!s.money && (s.money.win.some((x) => x > 0) || s.money.pay.some((x) => x > 0));
  function moneyFor(s, rows) {
    const out = {};
    if (!hasMoney(s) || !rows.length) return out;
    const rankOf = (list) => { const r = {}; let last = null, rank = 0; list.forEach((x, i) => { if (x.value !== last) { rank = i + 1; last = x.value; } r[x.id] = rank; }); return r; };
    const top = rankOf(rows);
    for (const x of rows) if (top[x.id] <= 3 && s.money.win[top[x.id] - 1] > 0) out[x.id] = { win: s.money.win[top[x.id] - 1], place: top[x.id] };
    const rest = rows.filter((x) => top[x.id] > 3).reverse();
    const bottom = rankOf(rest.map((x) => ({ id: x.id, value: -x.value })));
    for (const x of rest) if (bottom[x.id] <= 3 && s.money.pay[bottom[x.id] - 1] > 0) out[x.id] = { pay: s.money.pay[bottom[x.id] - 1], place: bottom[x.id] };
    return out;
  }
  const fmtBRL = (n) => (+n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const myTasks = () => Object.values(S.tasks).filter((t) => t.assignee === S.myId && counts(t));
  const pendingMandatory = () => myTasks().filter((t) => t.type === "obrigatoria" && activeNow(t) && !doneNow(t)).length;

  L.score = { hasMoney, moneyFor, fmtBRL, possibleKeys, percentFor, isPercent, fmtPct, standing, dueKey, proofLimit, needsProof, proofOf, hasProof, span, activeNow, isParticipant, playerDoc, marksOf, validMarks, taskResult, periodKey, doneNow, tasksOfProject, counts, scoreFor, myTasks, pendingMandatory };
})(window.Liga);
