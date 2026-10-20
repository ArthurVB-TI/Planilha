/* rules.js — dificuldades, regras de conta e validação dos dados vindos do banco
   (dados compartilhados nunca são confiáveis: tudo passa por aqui antes de ser usado) */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const { clean } = L.text;
  const { isKey } = L.dates;

  const DIFF = {
    facil:   { label: "Fácil",   pts: 10, pen: 5,  dots: "●○○" },
    media:   { label: "Média",   pts: 25, pen: 10, dots: "●●○" },
    dificil: { label: "Difícil", pts: 50, pen: 20, dots: "●●●" },
  };
  const DIFF_KEYS = Object.keys(DIFF);
  const MAX_MARKS = 800;
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
    return { id, name, desc: clean(d.desc, 200), members, createdAt: Number(d.createdAt) || 0 };
  }

  function sub(id, d) {
    const name = clean(d.name, 60);
    if (!name || !isId(d.projectId)) return null;
    const owner = isId(d.owner) ? d.owner : "";
    const helpers = Array.isArray(d.helpers) ? [...new Set(d.helpers.filter(isId))].filter((h) => h !== owner).slice(0, 20) : [];
    return { id, name, projectId: d.projectId, owner, helpers, createdAt: Number(d.createdAt) || 0 };
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

  function player(id, d) {
    return { nick: clean(d.nick, NICK_MAX), done: obj(d.done), proofs: obj(d.proofs), weeks: d.weeks };
  }

  L.rules = {
    DIFF, DIFF_KEYS, MAX_MARKS, NICK_MAX, isPhotoId,
    checkUsername, checkEmail, checkPassword,
    sanitize: { project, sub, task, player },
  };
})(window.Liga);
