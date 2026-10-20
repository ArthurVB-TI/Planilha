/* actions.js — tudo que grava no banco: marcar tarefas, apelido e o CRUD do dono */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { clean } = L.text;
  const { isKey, todayKey } = L.dates;
  const { MAX_MARKS, NICK_MAX, isPhotoId } = L.rules;

  const render = () => L.app.render();
  const setStatus = (m, w) => L.app.setStatus(m, w);
  const db = () => S.backend;

  const MESSAGES = {
    quota_exceeded: "A liga atingiu o limite de armazenamento.",
    denied: "Você não tem permissão para fazer isso.",
    unavailable: "Sem conexão agora. Tente de novo em instantes.",
    bad_login: "Usuário ou senha incorretos.",
    bad_password: "Senha incorreta.",
    bad_code: "Código errado ou expirado.",
    need_code: "Digite também o código do aplicativo autenticador.",
    username_taken: "Esse nome de usuário já existe.",
    email_taken: "Esse e-mail já tem conta.",
    invalid_email: "E-mail inválido.",
    weak_password: "Senha fraca demais.",
    too_many: "Muitas tentativas. Espere alguns minutos.",
    recent_login: "Por segurança, saia e entre de novo antes de fazer isso.",
    email_not_verified: "Confirme seu e-mail antes de ativar a verificação em duas etapas.",
    not_enabled: "Isso não está ativado no Firebase deste site (veja o README).",
    no_crypto: "Este navegador não tem suporte à criptografia necessária. Abra pelo localhost ou https.",
  };

  function errMsg(e, fallback) {
    const c = e && e.code;
    if (MESSAGES[c]) return MESSAGES[c];
    if (e) console.error(e.original || e);
    return fallback;
  }

  /* ---------- meu documento (players/<meu id>) ---------- */

  function buildMyDoc() {
    const done = {};
    const src = S.mine.done || {};
    for (const id in src) {
      if (S.loaded.tasks && !S.tasks[id]) continue;          // tarefa apagada
      if (!Array.isArray(src[id])) continue;
      const arr = [...new Set(src[id].filter(isKey))].sort().slice(-MAX_MARKS);
      if (arr.length) done[id] = arr;
    }
    const proofs = {};
    const psrc = S.mine.proofs || {};
    for (const id in psrc) {
      if (S.loaded.tasks && !S.tasks[id]) continue;
      const m = psrc[id];
      if (!m || typeof m !== "object") continue;
      const o = {};
      for (const k in m) if (isKey(k) && isPhotoId(m[k])) o[k] = m[k];
      if (Object.keys(o).length) proofs[id] = o;
    }
    const out = { nick: clean(S.mine.nick, NICK_MAX), done, proofs, updatedAt: Date.now() };
    if (S.mine.weeks && typeof S.mine.weeks === "object") out.weeks = S.mine.weeks; // dados da versão 1
    return out;
  }

  function scheduleSave() {
    S.pending = true;
    clearTimeout(S.saveTimer);
    S.saveTimer = setTimeout(flush, 400);
  }

  async function flush() {
    if (S.writing || !S.pending || !db() || !S.myId || !S.mine) return;
    S.pending = false;
    S.writing = true;
    try {
      await db().set("players/" + S.myId, buildMyDoc());
    } catch (e) {
      if (e.code === "denied") {
        S.readOnly = true;
        setStatus("Você está só assistindo: sua conta não tem permissão para gravar.", true);
      } else if (e.code === "unavailable") {
        S.pending = true;
        setTimeout(flush, 1500 + Math.random() * 1500);
      } else {
        setStatus(errMsg(e, "Não deu para salvar agora. Marque de novo em instantes."), true);
      }
    }
    S.writing = false;
    render();
    if (S.pending) flush();
  }

  function ensureMine() {
    if (!S.mine.done || typeof S.mine.done !== "object") S.mine.done = {};
    if (!S.mine.proofs || typeof S.mine.proofs !== "object") S.mine.proofs = {};
  }

  function canMark(task) {
    return !S.readOnly && !!S.mine && task.assignee === S.myId;
  }

  function toggleMark(task, key) {
    if (!canMark(task)) return;
    ensureMine();
    const arr = Array.isArray(S.mine.done[task.id]) ? [...S.mine.done[task.id]] : [];
    const i = arr.indexOf(key);
    if (i >= 0) {
      arr.splice(i, 1);
      const old = S.mine.proofs[task.id] && S.mine.proofs[task.id][key];
      if (old) { delete S.mine.proofs[task.id][key]; removePhoto(old); }
    } else {
      arr.push(key);
      L.fx.markDone(task, key);
    }
    S.mine.done[task.id] = arr;
    render();
    scheduleSave();
  }

  // grava a foto já enviada como prova do dia/semana e marca a tarefa
  function attachProof(task, key, photoId) {
    ensureMine();
    if (!S.mine.proofs[task.id]) S.mine.proofs[task.id] = {};
    const old = S.mine.proofs[task.id][key];
    S.mine.proofs[task.id][key] = photoId;
    if (!Array.isArray(S.mine.done[task.id])) S.mine.done[task.id] = [];
    if (!S.mine.done[task.id].includes(key)) { S.mine.done[task.id].push(key); L.fx.markDone(task, key); }
    if (old && old !== photoId) removePhoto(old);
    scheduleSave();
  }

  function removePhoto(id) {
    delete S.photoCache[id];
    db().photos.remove(id).catch(() => {});
  }

  function join(nick) {
    S.mine = { nick, done: {}, proofs: {} };
    S.pending = true;
    render();
    flush();
  }

  function setNick(nick) {
    if (!S.mine) return;
    S.mine.nick = nick;
    render();
    scheduleSave();
  }

  /* ---------- projetos (dono da liga), listRats (integrantes) e tarefas ---------- */

  const claimOwner = () => db().claimOwner(S.myId);

  async function createProject({ name, desc, members }) {
    const id = db().newId("projetos");
    await db().set("projetos/" + id, { name, desc, members, createdAt: Date.now() });
    return id;
  }
  const saveProject = (pid, data) => db().update("projetos/" + pid, data);

  async function deleteProject(pid) {
    const subs = Object.values(S.subs).filter((s) => s.projectId === pid).map((s) => s.id);
    const paths = [];
    for (const t of Object.values(S.tasks)) if (subs.includes(t.subId)) paths.push("tarefas/" + t.id);
    for (const sid of subs) paths.push("subprojetos/" + sid);
    paths.push("projetos/" + pid);
    await db().removeMany(paths);
  }

  // quem cria a listRat vira o dono dela
  const createSub = (pid, name) => db().set("subprojetos/" + db().newId("subprojetos"),
    { projectId: pid, name, owner: S.myId, helpers: [], createdAt: Date.now() });
  const renameSub = (sid, name) => db().update("subprojetos/" + sid, { name });
  const setSubHelpers = (sid, helpers) => db().update("subprojetos/" + sid, { helpers });

  async function deleteSub(sid) {
    const paths = Object.values(S.tasks).filter((t) => t.subId === sid).map((t) => "tarefas/" + t.id);
    paths.push("subprojetos/" + sid);
    await db().removeMany(paths);
  }

  const createTask = (p, s, d) => db().set("tarefas/" + db().newId("tarefas"), {
    subId: s.id, projectId: p.id, title: d.title, assignee: d.assignee,
    kind: d.kind, type: d.type, diff: d.diff, startKey: todayKey(), createdAt: Date.now(),
  });
  const saveTask = (id, d) => db().update("tarefas/" + id, { title: d.title, assignee: d.assignee, type: d.type, kind: d.kind, diff: d.diff });
  const deleteTask = (id) => db().remove("tarefas/" + id);

  L.actions = {
    errMsg, flush, scheduleSave, canMark, toggleMark, attachProof, join, setNick,
    claimOwner, createProject, saveProject, deleteProject, createSub, renameSub, setSubHelpers, deleteSub,
    createTask, saveTask, deleteTask,
  };
})(window.Liga);
