/* rules.js — dificuldades, regras de conta e validação dos dados vindos do banco
   (dados compartilhados nunca são confiáveis: tudo passa por aqui antes de ser usado) */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const { clean, cleanLong } = L.text;
  const { isKey } = L.dates;

  const DIFF = {
    facil:   { label: "Fácil",   pts: 10, pen: 5,  dots: "●○○" },
    media:   { label: "Média",   pts: 25, pen: 10, dots: "●●○" },
    dificil: { label: "Difícil", pts: 50, pen: 20, dots: "●●●" },
  };
  const DIFF_KEYS = Object.keys(DIFF);
  const MAX_MARKS = 800;
  // regras de inscrição padrão de uma listRat (dono e ajudantes mudam)
  // maxTasks 0 = sem máximo. Desvio recomendado: 35 (duas pessoas a 1 tarefa fácil diária de diferença = 70 pts/semana)
  const DEFAULT_REQ = { minObr: 3, minTasks: 1, maxTasks: 0, maxDesvio: 35 };
  const RECOMMENDED_DESVIO = 35;
  const int = (v, lo, hi, def) => (Number.isFinite(+v) && v !== "" && v !== null ? Math.min(hi, Math.max(lo, Math.round(+v))) : def);
  function normReq(r) {
    r = r && typeof r === "object" ? r : {};
    const minObr = int(r.minObr, 0, 30, DEFAULT_REQ.minObr);
    const minTasks = int(r.minTasks, 0, 30, DEFAULT_REQ.minTasks);
    let maxTasks = int(r.maxTasks, 0, 30, DEFAULT_REQ.maxTasks);
    if (maxTasks && maxTasks < minTasks) maxTasks = minTasks;
    const d = Number(r.maxDesvio);
    const maxDesvio = r.maxDesvio !== "" && r.maxDesvio != null && Number.isFinite(d) && d >= 0 ? Math.min(10000, Math.round(d * 100) / 100) : DEFAULT_REQ.maxDesvio;
    return { minObr, minTasks, maxTasks, maxDesvio };
  }
  const NICK_MAX = 20;

  /* ---------- contas ---------- */
  const USER_RE = /^[A-Za-z0-9_.]{3,20}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function checkUsername(u) {
    if (!USER_RE.test(u)) return "O usuário precisa ter de 3 a 20 caracteres: letras, números, ponto ou _.";
    return "";
  }
  function checkEmail(e) { return EMAIL_RE.test(e) ? "" : "E-mail inválido."; }
  function checkPassword(p, confirm) {
    if (!p || p.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
    if (confirm !== undefined && p !== confirm) return "As senhas não são iguais.";
    return "";
  }

  /* ---------- validação ---------- */
  const isId = (v) => typeof v === "string" && v.length > 0 && v.length < 200;
  const isPhotoId = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v);
  const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

  function project(id, d) {
    const name = clean(d.name, 60);
    if (!name) return null;
    const members = Array.isArray(d.members) ? [...new Set(d.members.filter(isId))].slice(0, 50) : [];
    const owner = isId(d.owner) ? d.owner : "";
    // cargo "ajudante do projeto" (só integrantes)
    const helpers = Array.isArray(d.helpers) ? [...new Set(d.helpers.filter((h) => isId(h) && members.includes(h) && h !== owner))].slice(0, 50) : [];
    return { id, name, desc: clean(d.desc, 200), members, owner, helpers, createdAt: Number(d.createdAt) || 0 };
  }

  function sub(id, d) {
    const name = clean(d.name, 60);
    if (!name || !isId(d.projectId)) return null;
    const owner = isId(d.owner) ? d.owner : "";
    const helpers = Array.isArray(d.helpers) ? [...new Set(d.helpers.filter(isId))].filter((h) => h !== owner).slice(0, 20) : [];
    const start = isKey(d.start) ? d.start : "";
    let end = isKey(d.end) ? d.end : "";
    if (start && end && end < start) end = "";
    // inscrições: listRat nova começa em "inscricoes"; antigas (sem status) já estão valendo
    const status = d.status === "inscricoes" ? "inscricoes" : "ativa";
    // quem participou (gravado quando a listRat começa); null = listRat antiga, valem todos os integrantes
    const participants = Array.isArray(d.participants) ? [...new Set(d.participants.filter(isId))].slice(0, 100) : null;
    const startedAt = isKey(d.startedAt) ? d.startedAt : "";
    // dia em que cada participante entrou (quem é incluído depois só conta dali em diante)
    const joined = {};
    for (const k in obj(d.joined)) if (isId(k) && isKey(d.joined[k])) joined[k] = d.joined[k];
    return {
      id, name, projectId: d.projectId, owner, helpers, desc: cleanLong(d.desc, 500), start, end,
      status, req: normReq(d.req), participants: status === "ativa" ? participants : null, startedAt, joined,
      createdAt: Number(d.createdAt) || 0,
    };
  }

  function task(id, d) {
    const title = clean(d.title, 80);
    const kind = d.kind === "weekly" ? "weekly" : d.kind === "daily" ? "daily" : null;
    const type = d.type === "obrigatoria" ? "obrigatoria" : d.type === "normal" ? "normal" : null;
    // "lendaria" não existe mais: tarefas antigas com ela passam a valer como difícil
    const diff = DIFF[d.diff] ? d.diff : d.diff === "lendaria" ? "dificil" : null;
    const startKey = isKey(d.startKey) ? d.startKey : null;
    if (!title || !isId(d.subId) || !isId(d.assignee) || !kind || !type || !diff || !startKey) return null;
    return { id, title, subId: d.subId, assignee: d.assignee, kind, type, diff, startKey, createdAt: Number(d.createdAt) || 0 };
  }

  function invite(id, d) {
    if (!/^[a-f0-9]{32}$/.test(id) || !isId(d.projectId)) return null;
    return { id, projectId: d.projectId, expiresAt: Number(d.expiresAt) || 0, createdAt: Number(d.createdAt) || 0 };
  }

  // amizade entre duas contas: id = "<menor uid>_<maior uid>"
  function friendship(id, d) {
    const users = Array.isArray(d.users) ? d.users.filter(isId) : [];
    if (users.length !== 2 || !isId(d.from) || !isId(d.to)) return null;
    const status = d.status === "accepted" ? "accepted" : "pending";
    return { id, users, from: d.from, to: d.to, status, createdAt: Number(d.createdAt) || 0, acceptedAt: Number(d.acceptedAt) || 0 };
  }
  // convite para entrar num projeto: id = "<projeto>_<pessoa>"
  function request(id, d) {
    if (!isId(d.projectId) || !isId(d.from) || !isId(d.to)) return null;
    return { id, projectId: d.projectId, projectName: clean(d.projectName, 60) || "projeto", from: d.from, to: d.to, createdAt: Number(d.createdAt) || 0 };
  }
  const NOTIF_CATS = ["projetos", "amizades", "site"];
  function notif(id, d) {
    if (!isId(d.to)) return null;
    return {
      id, to: d.to, from: isId(d.from) ? d.from : "", cat: NOTIF_CATS.includes(d.cat) ? d.cat : "site",
      kind: clean(d.kind, 30), text: clean(d.text, 200), projectId: isId(d.projectId) ? d.projectId : "", sid: isId(d.sid) ? d.sid : "",
      createdAt: Number(d.createdAt) || 0, read: d.read === true,
    };
  }

  function player(id, d) {
    return { nick: clean(d.nick, NICK_MAX), done: obj(d.done), proofs: obj(d.proofs), notes: obj(d.notes), avatar: isPhotoId(d.avatar) ? d.avatar : "", weeks: d.weeks };
  }

  // justificativa de um dia/semana não feito: id = "<tarefa>_<dia>"; só vale se o dono/ajudante aceitar
  const J_STATUS = ["pendente", "aceita", "recusada"];
  function justification(id, d) {
    if (!isId(d.taskId) || !isId(d.subId) || !isId(d.uid) || !isKey(d.key)) return null;
    const comment = cleanLong(d.comment, 300);
    if (!comment) return null;
    return {
      id, taskId: d.taskId, subId: d.subId, projectId: isId(d.projectId) ? d.projectId : "", uid: d.uid, key: d.key, comment,
      photo: isPhotoId(d.photo) ? d.photo : "", status: J_STATUS.includes(d.status) ? d.status : "pendente",
      decidedBy: isId(d.decidedBy) ? d.decidedBy : "", createdAt: Number(d.createdAt) || 0, decidedAt: Number(d.decidedAt) || 0,
    };
  }
  // contestação de uma tarefa (no dia seguinte ao fim da listRat): id = id da tarefa (cada tarefa só uma vez)
  const C_STATUS = ["aberta", "provada", "aceita", "recusada"];
  function contest(id, d) {
    if (!isId(d.taskId) || d.taskId !== id || !isId(d.subId) || !isId(d.by) || !isId(d.accused)) return null;
    return {
      id, taskId: d.taskId, subId: d.subId, projectId: isId(d.projectId) ? d.projectId : "", by: d.by, accused: d.accused,
      status: C_STATUS.includes(d.status) ? d.status : "aberta",
      proofPhoto: isPhotoId(d.proofPhoto) ? d.proofPhoto : "", proofComment: cleanLong(d.proofComment, 300),
      proofAt: Number(d.proofAt) || 0, decidedBy: isId(d.decidedBy) ? d.decidedBy : "", createdAt: Number(d.createdAt) || 0,
    };
  }

  L.rules = {
    DIFF, DIFF_KEYS, MAX_MARKS, DEFAULT_REQ, RECOMMENDED_DESVIO, normReq, NICK_MAX, isPhotoId,
    checkUsername, checkEmail, checkPassword,
    sanitize: { project, sub, task, player, invite, friendship, request, notif, justification, contest },
  };
})(window.Liga);
