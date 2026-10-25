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
  function taskResult(task, opts) {
    const R = L.review;
    const raw = R ? marksOf(task.assignee, task.id).concat(R.acceptedKeys(task)) : marksOf(task.assignee, task.id);
    let done = validMarks(task, raw);
    const voided = !(opts && opts.raw) && !!R && R.taskLost(task);
    if (voided) done = new Set();
    const D = DIFF[task.diff];
    if (task.type === "normal") return { done, plus: D.pts * done.size, minus: 0, missed: 0, voided };

    let missed = 0;
    const sp = span(task);
    if (task.kind === "daily") {
      const end = minKey(addDays(todayKey(), -1), sp.end);
      for (let k = sp.from, i = 0; k <= end && i < 4000; k = addDays(k, 1), i++) if (!done.has(k)) missed++;
    } else {
      const end = minKey(addDays(curWeek(), -7), sp.end && weekOf(sp.end));
      for (let k = weekOf(sp.from), i = 0; k <= end && i < 600; k = addDays(k, 7), i++) if (!done.has(k)) missed++;
    }
    return { done, plus: 0, minus: L.rules.OBR_PENALTY ? D.pen * missed : 0, missed, voided };
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

  const myTasks = () => Object.values(S.tasks).filter((t) => t.assignee === S.myId && counts(t));
  const pendingMandatory = () => myTasks().filter((t) => t.type === "obrigatoria" && activeNow(t) && !doneNow(t)).length;

  L.score = { span, activeNow, isParticipant, playerDoc, marksOf, validMarks, taskResult, periodKey, doneNow, tasksOfProject, counts, scoreFor, myTasks, pendingMandatory };
})(window.Liga);
