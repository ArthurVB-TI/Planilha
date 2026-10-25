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
    email_not_verified: "Adicione e confirme um e-mail (em Configurações) antes de ativar a verificação em duas etapas.",
    no_email: "Sua conta ainda não tem e-mail.",
    not_enabled: "Isso não está ativado no Firebase deste site (veja o README).",
    invite_invalid: "Esse link de convite não vale mais (venceu ou foi apagado). Peça um novo para o dono do projeto.",
    invite_expired: "Esse link de convite venceu. Peça um novo para o dono do projeto.",
    cant_start: "Ainda não dá para começar a listRat.",
    too_many_tasks: "Passou do máximo de tarefas normais desta listRat.",
    already_member: "Essa pessoa já está no projeto.",
    project_gone: "Esse projeto não existe mais.",
    dup_task: "Você já tem uma tarefa com esse nome nesta listRat.",
    need_comment: "Escreva o motivo: o comentário é obrigatório na justificativa.",
    need_proof: "Mande uma foto ou escreva um comentário como prova.",
    cant_contest: "Não dá para contestar esta tarefa agora.",
    task_locked: "Depois que a listRat começa, só dá para mudar o nome da tarefa.",
    day_locked: "Esse dia não pode mais ser mudado.",
    owner_stays: "O dono do projeto não pode sair. Passe o projeto para outra pessoa antes.",
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
    // comentário de cada dia/semana feito: notes[tarefa][dia] = texto
    const notes = {};
    const nsrc = S.mine.notes || {};
    for (const id in nsrc) {
      if (S.loaded.tasks && !S.tasks[id]) continue;
      const m = nsrc[id];
      if (!m || typeof m !== "object") continue;
      const o = {};
      for (const k in m) { const t = L.text.cleanLong(m[k], 300); if (isKey(k) && t) o[k] = t; }
      if (Object.keys(o).length) notes[id] = o;
    }
    const out = { nick: clean(S.mine.nick, NICK_MAX), done, proofs, notes, updatedAt: Date.now() };
    if (isPhotoId(S.mine.avatar)) out.avatar = S.mine.avatar;               // foto de perfil
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
    if (!S.mine.notes || typeof S.mine.notes !== "object") S.mine.notes = {};
  }

  function canMark(task) {
    return !S.readOnly && !!S.mine && task.assignee === S.myId;
  }
  // dá para marcar/desmarcar, mandar foto ou justificar este dia (ou semana)?
  // Só dentro do período da listRat, até hoje, e só enquanto a listRat não terminou.
  function canChangeDay(task, key) {
    if (!canMark(task) || !L.score.counts(task)) return false;
    const sp = L.score.span(task);
    if (sp.prep) return false;
    const t = todayKey();
    if (sp.end && t > sp.end) return false;
    if (task.kind === "daily") return key >= sp.from && key <= t && (!sp.end || key <= sp.end);
    const W = L.dates.weekOf;
    return key === W(key) && key >= W(sp.from) && key <= W(t);
  }
  const noteOf = (task, key) => {
    const p = L.score.playerDoc(task.assignee);
    const m = p && p.notes && p.notes[task.id];
    return m && typeof m[key] === "string" ? m[key] : "";
  };
  function setNote(task, key, text) {
    if (!canChangeDay(task, key)) throw fail("day_locked");
    ensureMine();
    const t = L.text.cleanLong(text, 300);
    if (!S.mine.notes[task.id]) S.mine.notes[task.id] = {};
    if (t) S.mine.notes[task.id][key] = t; else delete S.mine.notes[task.id][key];
    render();
    scheduleSave();
  }

  function toggleMark(task, key) {
    if (!canChangeDay(task, key)) return;
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
    if (!canChangeDay(task, key)) { removePhoto(photoId); return; }
    ensureMine();
    if (!S.mine.proofs[task.id]) S.mine.proofs[task.id] = {};
    const old = S.mine.proofs[task.id][key];
    S.mine.proofs[task.id][key] = photoId;
    if (!Array.isArray(S.mine.done[task.id])) S.mine.done[task.id] = [];
    if (!S.mine.done[task.id].includes(key)) { S.mine.done[task.id].push(key); L.fx.markDone(task, key); }
    if (old && old !== photoId) removePhoto(old);
    scheduleSave();
  }

  // foto de perfil (fica na coleção de fotos; o id vai no meu documento de jogador)
  function setAvatar(photoId) {
    if (!S.mine) return;
    const old = S.mine.avatar;
    S.mine.avatar = photoId || "";
    if (old && old !== photoId) removePhoto(old);
    render();
    scheduleSave();
  }

  function removePhoto(id) {
    delete S.photoCache[id];
    db().photos.remove(id).catch(() => {});
  }

  function join(nick) {
    S.mine = { nick, done: {}, proofs: {}, notes: {} };
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

  /* ---------- projetos (qualquer um cria e vira dono), listRats (integrantes) e tarefas ---------- */

  // qualquer pessoa cria projeto e vira o dono dele
  async function createProject({ name, desc }) {
    const id = db().newId("projetos");
    await db().set("projetos/" + id, { name, desc, members: [S.myId], owner: S.myId, helpers: [], createdAt: Date.now() });
    return id;
  }
  // cargo "ajudante do projeto"
  async function setProjectHelper(pid, uid, on) {
    const p = S.projects[pid];
    if (!p || !p.members.includes(uid)) throw fail("unknown");
    const helpers = p.helpers.filter((x) => x !== uid);
    if (on) helpers.push(uid);
    await db().update("projetos/" + pid, { helpers });
    if (on) notify(uid, "projetos", "helper", myName() + " deu para você o cargo de ajudante no projeto " + p.name + ".", { projectId: pid });
  }
  // passa o projeto para outro integrante (quem passa continua como integrante)
  async function transferProject(pid, uid) {
    const p = S.projects[pid];
    if (!p || !p.members.includes(uid)) throw fail("unknown");
    await db().update("projetos/" + pid, { owner: uid });
    notify(uid, "projetos", "owner", myName() + " passou o projeto " + p.name + " para você. Agora você é o dono.", { projectId: pid });
  }
  const saveProject = (pid, data) => db().update("projetos/" + pid, data);

  async function deleteProject(pid) {
    const subs = Object.values(S.subs).filter((s) => s.projectId === pid).map((s) => s.id);
    // em etapas: tarefas, depois listRats, depois o projeto (as regras conferem a listRat/projeto de cada tarefa)
    await db().removeMany(Object.values(S.tasks).filter((t) => subs.includes(t.subId)).map((t) => "tarefas/" + t.id));
    await db().removeMany(subs.map((sid) => "subprojetos/" + sid));
    await db().removeMany(["projetos/" + pid]);
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
    const pn = (S.projects[s.projectId] || {}).name || "";
    for (const id of sm.ready) notify(id, "projetos", "started", "A listRat " + s.name + (pn ? " (" + pn + ")" : "") + " começou. Suas tarefas já valem pontos.", { projectId: s.projectId, sid });
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
    await db().removeMany(Object.values(S.tasks).filter((t) => t.subId === sid).map((t) => "tarefas/" + t.id));
    await db().removeMany(["subprojetos/" + sid]);
  }

  // em inscrições, cada pessoa só pode ter até o máximo de tarefas normais
  function checkMax(s, assignee, type, ignoreId) {
    if (!s || s.status !== "inscricoes" || type !== "normal" || !s.req.maxTasks) return;
    const n = Object.values(S.tasks).filter((t) => t.subId === s.id && t.assignee === assignee && t.type === "normal" && t.id !== ignoreId).length;
    if (n >= s.req.maxTasks) throw fail("too_many_tasks");
  }
  // a mesma pessoa não pode ter duas tarefas com o mesmo nome na mesma listRat
  const norm = (t) => String(t || "").trim().toLowerCase().replace(/\s+/g, " ");
  function checkDup(subId, assignee, title, ignoreId) {
    if (Object.values(S.tasks).some((t) => t.subId === subId && t.assignee === assignee && t.id !== ignoreId && norm(t.title) === norm(title))) throw fail("dup_task");
  }
  // cada pessoa só cria tarefas para si mesma, e só nas inscrições
  async function createTask(p, s, d) {
    if (!L.perms.canFillOwn(s)) throw fail("task_locked");
    checkDup(s.id, S.myId, d.title);
    checkMax(s, S.myId, d.type);
    await db().set("tarefas/" + db().newId("tarefas"), {
      subId: s.id, projectId: p.id, title: d.title, assignee: S.myId,
      kind: d.kind, type: d.type, diff: d.diff, startKey: todayKey(), createdAt: Date.now(),
    });
  }
  // só a própria pessoa edita; depois que a listRat começa, só o nome
  async function saveTask(id, d) {
    const t = S.tasks[id];
    const lvl = L.perms.editLevel(t);
    if (!lvl) throw fail("denied");
    checkDup(t.subId, t.assignee, d.title, id);
    if (lvl === "name") return db().update("tarefas/" + id, { title: d.title });
    checkMax(S.subs[t.subId], t.assignee, d.type, id);
    await db().update("tarefas/" + id, { title: d.title, type: d.type, kind: d.kind, diff: d.diff });
  }
  async function deleteTask(id) {
    if (!L.perms.canDeleteTask(S.tasks[id])) throw fail("task_locked");
    await db().remove("tarefas/" + id);
  }

  /* ---------- integrantes (dono do projeto) ---------- */

  const fail = (code) => Object.assign(new Error(code), { code });
  const notify = (...a) => (L.social ? L.social.notify(...a) : Promise.resolve());
  const myName = () => L.ui.nameOf(S.myId);
  const subsOf = (pid) => Object.values(S.subs).filter((s) => s.projectId === pid);

  // ninguém é colocado direto num projeto: veja L.social.sendProjectInvite

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

  // tira do projeto: sai das listRats (as que era dono passam para o dono do projeto);
  // as tarefas da pessoa ficam guardadas e param de contar (ninguém mexe nas tarefas dos outros)
  async function removeMember(pid, uid) {
    const p = S.projects[pid];
    if (!p) throw fail("unknown");
    if (L.perms.projOwner(p) === uid) throw fail("owner_stays");
    const heir = L.perms.projOwner(p);
    for (const s of subsOf(pid)) {
      const owner = L.perms.subOwner(s);
      if (owner === uid) {
        await db().update("subprojetos/" + s.id, { owner: heir, helpers: s.helpers.filter((x) => x !== uid && x !== heir) });
      } else if (s.helpers.includes(uid)) {
        await db().update("subprojetos/" + s.id, { helpers: s.helpers.filter((x) => x !== uid) });
      }
    }
    await db().update("projetos/" + pid, { members: p.members.filter((x) => x !== uid), helpers: p.helpers.filter((x) => x !== uid) });
    notify(uid, "projetos", "removed", myName() + " tirou você do projeto " + p.name + ".", { projectId: pid });
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
  // olha o convite sem entrar (para perguntar antes): { pid, name, owner, members, already }
  async function peekInvite(token) {
    if (!/^[a-f0-9]{32}$/.test(token)) throw fail("invite_invalid");
    const inv = await db().get("convites/" + token);
    if (!inv || typeof inv.projectId !== "string") throw fail("invite_invalid");
    if (!(Number(inv.expiresAt) > Date.now())) throw fail("invite_expired");
    const p = await db().get("projetos/" + inv.projectId);
    if (!p) throw fail("invite_invalid");
    const members = Array.isArray(p.members) ? p.members : [];
    return { pid: inv.projectId, name: p.name, owner: p.owner || "", members: members.length, already: members.includes(S.myId) };
  }

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
    notify(typeof p.owner === "string" ? p.owner : "", "projetos", "joined", myName() + " entrou em " + p.name + " pelo link de convite.", { projectId: pid });
    return { pid, name: p.name, already: false };
  }

  L.actions = {
    createInvite, deleteInvite, inviteUrl, peekInvite, joinByInvite, setSubReq, startSub, addParticipant,
    setSubRole, removeMember,
    errMsg, flush, scheduleSave, canMark, canChangeDay, noteOf, setNote, toggleMark, attachProof, removePhoto, setAvatar, join, setNick,
    createProject, transferProject, setProjectHelper, saveProject, deleteProject, createSub, saveSub, renameSub, setSubHelpers, deleteSub,
    createTask, saveTask, deleteTask,
  };
})(window.Liga);
