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

  // só valem datas entre a criação da tarefa e hoje (ou segundas-feiras, nas semanais)
  function validMarks(task, raw) {
    const set = new Set();
    if (task.kind === "daily") {
      const t = todayKey();
      for (const k of raw) if (isKey(k) && k >= task.startKey && k <= t) set.add(k);
    } else {
      const sw = weekOf(task.startKey), cw = curWeek();
      for (const k of raw) if (isKey(k) && k === weekOf(k) && k >= sw && k <= cw) set.add(k);
    }
    return set;
  }

  // resultado de uma tarefa para quem é responsável por ela
  function taskResult(task) {
    const done = validMarks(task, marksOf(task.assignee, task.id));
    const D = DIFF[task.diff];
    if (task.type === "normal") return { done, plus: D.pts * done.size, minus: 0, missed: 0 };

    let missed = 0;
    if (task.kind === "daily") {
      const end = addDays(todayKey(), -1);
      for (let k = task.startKey, i = 0; k <= end && i < 4000; k = addDays(k, 1), i++) if (!done.has(k)) missed++;
    } else {
      const end = addDays(curWeek(), -7);
      for (let k = weekOf(task.startKey), i = 0; k <= end && i < 600; k = addDays(k, 7), i++) if (!done.has(k)) missed++;
    }
    return { done, plus: 0, minus: D.pen * missed, missed };
  }

  const periodKey = (task) => (task.kind === "daily" ? todayKey() : curWeek());
  const doneNow = (task) => taskResult(task).done.has(periodKey(task));

  function tasksOfProject(pid) {
    return Object.values(S.tasks).filter((t) => S.subs[t.subId] && S.subs[t.subId].projectId === pid);
  }

  // a tarefa só conta se o responsável ainda é integrante do projeto
  function counts(task) {
    const sub = S.subs[task.subId];
    const p = sub && S.projects[sub.projectId];
    return !!p && p.members.includes(task.assignee);
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
  const pendingMandatory = () => myTasks().filter((t) => t.type === "obrigatoria" && !doneNow(t)).length;

  L.score = { playerDoc, marksOf, validMarks, taskResult, periodKey, doneNow, tasksOfProject, counts, scoreFor, myTasks, pendingMandatory };
})(window.Liga);
