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
    invite_invalid: "Esse link de convite não vale mais (venceu ou foi apagado). Peça um novo para o dono da liga.",
    invite_expired: "Esse link de convite venceu. Peça um novo para o dono da liga.",
    cant_start: "Ainda não dá para começar a listRat.",
    too_many_tasks: "Passou do máximo de tarefas normais desta listRat.",
    owner_needed: "Toda listRat precisa de um dono. Para tirar esta pessoa do comando, escolha outra como dona.",
    unknown: "Isso não existe mais. Recarregue a página.",
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
  // info = { name, desc, start, end, req } (datas AAAA-MM-DD; fim vazio = sem data para acabar)
  // toda listRat nova começa em inscrições
  async function createSub(pid, info) {
    const id = db().newId("subprojetos");
    await db().set("subprojetos/" + id, {
      projectId: pid, name: info.name, desc: info.desc || "", start: info.start || "", end: info.end || "",
      status: "inscricoes", req: L.rules.normReq(info.req), participants: [], startedAt: "", joined: {},
      owner: S.myId, helpers: [], createdAt: Date.now(),
    });
    return id;
  }
  const setSubReq = (sid, req) => db().update("subprojetos/" + sid, { req: L.rules.normReq(req) });

  // começa a listRat: grava os participantes (quem completou as tarefas) e o dia do início
  async function startSub(sid) {
    const s = S.subs[sid];
    if (!s || s.status !== "inscricoes") throw fail("unknown");
    const sm = L.enroll.summary(s);
    if (!sm.canStart) throw fail("cant_start");
    const t = todayKey(), joined = {};
    for (const id of sm.ready) joined[id] = t;
    await db().update("subprojetos/" + sid, { status: "ativa", participants: sm.ready, startedAt: t, joined });
    return sm.ready.length;
  }
  // inclui alguém depois que a listRat começou (o desvio padrão não impede a entrada)
  async function addParticipant(sid, uid) {
    const s = S.subs[sid];
    if (!s) throw fail("unknown");
    const list = [...new Set([...(s.participants || []), uid])].slice(0, 100);
    const joined = Object.assign({}, s.joined, { [uid]: todayKey() });
    await db().update("subprojetos/" + sid, { participants: list, joined });
  }
  const saveSub = (sid, info) => db().update("subprojetos/" + sid,
    { name: info.name, desc: info.desc || "", start: info.start || "", end: info.end || "" });
  const renameSub = (sid, name) => db().update("subprojetos/" + sid, { name });
  const setSubHelpers = (sid, helpers) => db().update("subprojetos/" + sid, { helpers });

  async function deleteSub(sid) {
    const paths = Object.values(S.tasks).filter((t) => t.subId === sid).map((t) => "tarefas/" + t.id);
    paths.push("subprojetos/" + sid);
    await db().removeMany(paths);
  }

  // em inscrições, cada pessoa só pode ter até o máximo de tarefas normais
  function checkMax(s, assignee, type, ignoreId) {
    if (!s || s.status !== "inscricoes" || type !== "normal") return;
    const n = Object.values(S.tasks).filter((t) => t.subId === s.id && t.assignee === assignee && t.type === "normal" && t.id !== ignoreId).length;
    if (n >= s.req.maxTasks) throw fail("too_many_tasks");
  }
  async function createTask(p, s, d) {
    checkMax(s, d.assignee, d.type);
    await db().set("tarefas/" + db().newId("tarefas"), {
      subId: s.id, projectId: p.id, title: d.title, assignee: d.assignee,
      kind: d.kind, type: d.type, diff: d.diff, startKey: todayKey(), createdAt: Date.now(),
    });
  }
  async function saveTask(id, d) {
    checkMax(S.tasks[id] && S.subs[S.tasks[id].subId], d.assignee, d.type, id);
    await db().update("tarefas/" + id, { title: d.title, assignee: d.assignee, type: d.type, kind: d.kind, diff: d.diff });
  }
  const deleteTask = (id) => db().remove("tarefas/" + id);

  /* ---------- integrantes (dono da liga) ---------- */

  const fail = (code) => Object.assign(new Error(code), { code });
  const subsOf = (pid) => Object.values(S.subs).filter((s) => s.projectId === pid);

  async function addMembers(pid, ids) {
    const p = S.projects[pid];
    if (!p) throw fail("unknown");
    await db().update("projetos/" + pid, { members: [...new Set([...p.members, ...ids])].slice(0, 50) });
  }

  // papel de alguém numa listRat: "" (nenhum), "ajudante" ou "dono".
  // Quem era dono vira ajudante quando outra pessoa assume.
  async function setSubRole(sid, uid, role) {
    const s = S.subs[sid];
    if (!s) throw fail("unknown");
    const owner = L.perms.subOwner(s);
    let helpers = s.helpers.filter((x) => x !== uid);
    if (role === "dono") {
      if (owner === uid) return;
      if (owner) helpers = [...new Set([...helpers, owner])];
      await db().update("subprojetos/" + sid, { owner: uid, helpers: helpers.slice(0, 20) });
    } else {
      if (owner === uid) throw fail("owner_needed");
      if (role === "ajudante") helpers.push(uid);
      await db().update("subprojetos/" + sid, { helpers: helpers.slice(0, 20) });
    }
  }

  // passa todas as tarefas de alguém neste projeto para outra pessoa
  async function moveTasks(pid, from, to) {
    const list = L.score.tasksOfProject(pid).filter((t) => t.assignee === from);
    for (const t of list) await db().update("tarefas/" + t.id, { assignee: to });
    return list.length;
  }

  // tira do projeto: sai das listRats (as que era dono passam para "heir"),
  // as tarefas vão para "moveTo" ou ficam guardadas sem contar
  async function removeMember(pid, uid, moveTo) {
    const p = S.projects[pid];
    if (!p) throw fail("unknown");
    const heir = moveTo || S.ownerId;
    if (moveTo) await moveTasks(pid, uid, moveTo);
    for (const s of subsOf(pid)) {
      const owner = L.perms.subOwner(s);
      if (owner === uid) {
        await db().update("subprojetos/" + s.id, { owner: heir, helpers: s.helpers.filter((x) => x !== uid && x !== heir) });
      } else if (s.helpers.includes(uid)) {
        await db().update("subprojetos/" + s.id, { helpers: s.helpers.filter((x) => x !== uid) });
      }
    }
    await db().update("projetos/" + pid, { members: p.members.filter((x) => x !== uid) });
  }

  /* ---------- convites (link temporário para entrar no projeto) ---------- */

  function newToken() {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  async function createInvite(pid, ms) {
    const token = newToken();
    await db().set("convites/" + token, { projectId: pid, expiresAt: Date.now() + ms, createdBy: S.myId, createdAt: Date.now() });
    return token;
  }
  const deleteInvite = (token) => db().remove("convites/" + token);
  const inviteUrl = (token) => location.origin + location.pathname + "#convite=" + token;

  // entra no projeto pelo convite; devolve { pid, name, already }
  async function joinByInvite(token) {
    if (!/^[a-f0-9]{32}$/.test(token)) throw fail("invite_invalid");
    const inv = await db().get("convites/" + token);
    if (!inv || typeof inv.projectId !== "string") throw fail("invite_invalid");
    if (!(Number(inv.expiresAt) > Date.now())) throw fail("invite_expired");
    const pid = inv.projectId;
    const p = await db().get("projetos/" + pid);
    if (!p) throw fail("invite_invalid");
    const members = Array.isArray(p.members) ? p.members : [];
    if (members.includes(S.myId)) return { pid, name: p.name, already: true };
    await db().update("projetos/" + pid, { members: members.concat([S.myId]), joinedVia: token });
    return { pid, name: p.name, already: false };
  }

  L.actions = {
    createInvite, deleteInvite, inviteUrl, joinByInvite, setSubReq, startSub, addParticipant,
    addMembers, setSubRole, moveTasks, removeMember,
    errMsg, flush, scheduleSave, canMark, toggleMark, attachProof, join, setNick,
    claimOwner, createProject, saveProject, deleteProject, createSub, saveSub, renameSub, setSubHelpers, deleteSub,
    createTask, saveTask, deleteTask,
  };
})(window.Liga);
