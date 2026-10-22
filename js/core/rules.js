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
  const DEFAULT_REQ = { minObr: 3, minTasks: 1, maxTasks: 10, maxDesvio: 2 };
  const int = (v, lo, hi, def) => (Number.isFinite(+v) && v !== "" && v !== null ? Math.min(hi, Math.max(lo, Math.round(+v))) : def);
  function normReq(r) {
    r = r && typeof r === "object" ? r : {};
    const minObr = int(r.minObr, 0, 30, DEFAULT_REQ.minObr);
    const minTasks = int(r.minTasks, 0, 30, DEFAULT_REQ.minTasks);
    const maxTasks = Math.max(minTasks, int(r.maxTasks, 1, 30, DEFAULT_REQ.maxTasks));
    const d = Number(r.maxDesvio);
    const maxDesvio = Number.isFinite(d) && d >= 0 ? Math.min(10000, Math.round(d * 100) / 100) : DEFAULT_REQ.maxDesvio;
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
    return { id, name, desc: clean(d.desc, 200), members, owner, createdAt: Number(d.createdAt) || 0 };
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

  function player(id, d) {
    return { nick: clean(d.nick, NICK_MAX), done: obj(d.done), proofs: obj(d.proofs), weeks: d.weeks };
  }

  L.rules = {
    DIFF, DIFF_KEYS, MAX_MARKS, DEFAULT_REQ, normReq, NICK_MAX, isPhotoId,
    checkUsername, checkEmail, checkPassword,
    sanitize: { project, sub, task, player, invite },
  };
})(window.Liga);
