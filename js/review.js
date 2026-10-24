/* review.js — justificativas e contestações.

   Justificativa: quem não conseguiu fazer a tarefa num dia (ou semana) escreve o porquê (obrigatório)
   e pode mandar uma foto. Ela só vale como "feita" se o dono ou um ajudante da listRat aceitar.
     justificativas/<tarefa>_<dia> { taskId, subId, projectId, uid, key, comment, photo, status: pendente|aceita|recusada, decidedBy }

   Contestação: no dia seguinte ao fim da listRat, cada participante pode duvidar de até 3 tarefas
   de outras pessoas (cada tarefa só pode ser contestada uma vez). A pessoa contestada tem até o fim
   desse dia para mandar uma prova (foto e/ou comentário). Sem prova, a tarefa perde os pontos
   (e, se for obrigatória, passa a contar como não feita). O dono ou um ajudante pode recusar a prova.
     contestacoes/<tarefa> { taskId, subId, projectId, by, accused, status: aberta|provada|aceita|recusada, proofPhoto, proofComment }

   Fases de uma listRat com data de fim:
     andamento (até o fim) -> contestacao (o dia seguinte ao fim) -> final (resultado fechado). */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { todayKey, addDays } = L.dates;
  const { cleanLong } = L.text;

  const MAX_CONTESTS = 3;
  const db = () => S.backend;
  const fail = (code) => Object.assign(new Error(code), { code });
  const name = (id) => L.ui.nameOf(id);
  const notify = (...a) => (L.social ? L.social.notify(...a) : Promise.resolve());

  /* ---------- fases ---------- */
  const contestDay = (s) => (s && s.end ? addDays(s.end, 1) : "");
  function phase(s) {
    if (!s) return "";
    if (s.status === "inscricoes") return "inscricoes";
    if (!s.end) return "andamento";
    const t = todayKey();
    if (t <= s.end) return "andamento";
    return t === contestDay(s) ? "contestacao" : "final";
  }
  // quem julga justificativas e provas: dono da listRat, ajudantes e dono do projeto
  const isJudge = (s) => L.perms.canRunSub(s);
  const judgesOf = (s) => {
    const p = S.projects[s.projectId];
    return [...new Set([L.perms.subOwner(s), ...s.helpers, p ? L.perms.projOwner(p) : ""].filter(Boolean))];
  };

  /* ---------- justificativas ---------- */
  const justId = (taskId, key) => taskId + "_" + key;
  const justOf = (taskId, key) => S.justs[justId(taskId, key)] || null;
  const justsOfTask = (taskId) => Object.values(S.justs).filter((j) => j.taskId === taskId);
  // dias justificados e aceitos (contam como feitos)
  const acceptedKeys = (task) => justsOfTask(task.id).filter((j) => j.status === "aceita" && j.uid === task.assignee).map((j) => j.key);
  const pendingFor = (s) => Object.values(S.justs).filter((j) => j.subId === s.id && j.status === "pendente");

  async function sendJustification(task, key, comment, photo) {
    const text = cleanLong(comment, 300);
    if (!text) throw fail("need_comment");
    if (task.assignee !== S.myId || !L.actions.canChangeDay(task, key)) throw fail("denied");
    const s = S.subs[task.subId];
    await db().set("justificativas/" + justId(task.id, key), {
      taskId: task.id, subId: task.subId, projectId: s ? s.projectId : "", uid: S.myId, key, comment: text,
      photo: photo || "", status: "pendente", decidedBy: "", createdAt: Date.now(), decidedAt: 0,
    });
    if (s) for (const j of judgesOf(s)) notify(j, "projetos", "justify", name(S.myId) + " justificou \"" + task.title + "\" (" + L.dates.shortDate(key) + ") em " + s.name + ". Aceite ou recuse na tarefa.", { projectId: s.projectId, sid: s.id });
  }
  async function removeJustification(j) {
    await db().remove("justificativas/" + j.id);
    if (j.photo) S.backend.photos.remove(j.photo).catch(() => {});
  }
  async function judgeJustification(j, ok) {
    const s = S.subs[j.subId];
    if (!isJudge(s)) throw fail("denied");
    await db().update("justificativas/" + j.id, { status: ok ? "aceita" : "recusada", decidedBy: S.myId, decidedAt: Date.now() });
    const t = S.tasks[j.taskId];
    notify(j.uid, "projetos", "justify_done", name(S.myId) + (ok ? " aceitou" : " recusou") + " sua justificativa de \"" + (t ? t.title : "tarefa") + "\" (" + L.dates.shortDate(j.key) + ").", { projectId: s.projectId, sid: s.id });
  }

  /* ---------- contestações ---------- */
  const contestOf = (taskId) => S.contests[taskId] || null;
  const contestsOf = (s) => Object.values(S.contests).filter((c) => c.subId === s.id).sort((a, b) => a.createdAt - b.createdAt);
  const myContests = (s) => contestsOf(s).filter((c) => c.by === S.myId);
  const left = (s) => Math.max(0, MAX_CONTESTS - myContests(s).length);

  // a tarefa perdeu a contestação? (sem prova até o fim do dia, ou prova recusada)
  function lost(c) {
    if (!c) return false;
    if (c.status === "recusada") return true;
    if (c.status === "aberta") return phase(S.subs[c.subId]) === "final";
    return false;
  }
  const taskLost = (task) => lost(contestOf(task.id));

  // posso contestar esta tarefa? { ok, why }
  function canContest(task) {
    const s = S.subs[task.subId], p = s && S.projects[s.projectId];
    if (!s || !p || phase(s) !== "contestacao") return { ok: false, why: "" };
    if (task.assignee === S.myId) return { ok: false, why: "" };
    if (!p.members.includes(S.myId) || !L.score.isParticipant(s, S.myId)) return { ok: false, why: "Só quem participou da listRat contesta." };
    if (!L.score.counts(task)) return { ok: false, why: "" };
    if (contestOf(task.id)) return { ok: false, why: "Esta tarefa já foi contestada." };
    if (!left(s)) return { ok: false, why: "Você já usou as " + MAX_CONTESTS + " contestações desta listRat." };
    if (!L.score.taskResult(task, { raw: true }).done.size) return { ok: false, why: "Não tem nada marcado como feito para contestar." };
    return { ok: true, why: "" };
  }

  async function openContest(task) {
    const c = canContest(task);
    if (!c.ok) throw fail("cant_contest");
    const s = S.subs[task.subId];
    await db().set("contestacoes/" + task.id, {
      taskId: task.id, subId: s.id, projectId: s.projectId, by: S.myId, accused: task.assignee, status: "aberta",
      proofPhoto: "", proofComment: "", proofAt: 0, decidedBy: "", createdAt: Date.now(),
    });
    notify(task.assignee, "projetos", "contest", name(S.myId) + " contestou sua tarefa \"" + task.title + "\" em " + s.name + ". Mande uma prova até o fim do dia ou ela perde os pontos.", { projectId: s.projectId, sid: s.id });
  }
  // a pessoa contestada manda a prova (foto e/ou comentário) até o fim do dia de contestação
  async function sendProof(c, photo, comment) {
    const s = S.subs[c.subId];
    if (c.accused !== S.myId || phase(s) !== "contestacao") throw fail("denied");
    const text = cleanLong(comment, 300);
    if (!photo && !text) throw fail("need_proof");
    const old = c.proofPhoto;
    await db().update("contestacoes/" + c.id, { status: "provada", proofPhoto: photo || "", proofComment: text, proofAt: Date.now() });
    if (old && old !== photo) S.backend.photos.remove(old).catch(() => {});
    const t = S.tasks[c.taskId];
    notify(c.by, "projetos", "proof", name(S.myId) + " mandou a prova de \"" + (t ? t.title : "tarefa") + "\" em " + s.name + ".", { projectId: s.projectId, sid: s.id });
  }
  async function judgeContest(c, ok) {
    const s = S.subs[c.subId];
    if (!isJudge(s)) throw fail("denied");
    await db().update("contestacoes/" + c.id, { status: ok ? "aceita" : "recusada", decidedBy: S.myId });
    const t = S.tasks[c.taskId];
    notify(c.accused, "projetos", "proof_done", name(S.myId) + (ok ? " aceitou" : " recusou") + " sua prova de \"" + (t ? t.title : "tarefa") + "\".", { projectId: s.projectId, sid: s.id });
  }
  async function cancelContest(c) {
    if (c.by !== S.myId || c.status !== "aberta") throw fail("denied");
    await db().remove("contestacoes/" + c.id);
  }

  const STATUS_TEXT = {
    aberta: "esperando a prova",
    provada: "prova enviada",
    aceita: "prova aceita",
    recusada: "prova recusada: perdeu os pontos",
  };
  const contestText = (c) => (lost(c) && c.status === "aberta" ? "sem prova: perdeu os pontos" : STATUS_TEXT[c.status]);

  L.review = {
    MAX_CONTESTS, phase, contestDay, isJudge,
    justOf, justsOfTask, acceptedKeys, pendingFor, sendJustification, removeJustification, judgeJustification,
    contestOf, contestsOf, myContests, left, lost, taskLost, canContest, openContest, sendProof, judgeContest, cancelContest, contestText,
  };
})(window.Liga);
