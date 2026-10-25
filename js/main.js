/* main.js — liga tudo: escolhe o banco, acompanha o login, escuta as coleções e desenha as telas */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el, $ } = L.dom;
  const { store } = L.text;
  const san = L.rules.sanitize;

  const PAGES = ["home", "projects", "mine", "rules", "new", "project", "members", "subform", "sub", "charts", "friends", "inbox", "user", "settings"];

  /* ---------- navegação e avisos ---------- */

  let statusTimer = 0;
  // msg com { auto: true } some sozinha depois de alguns segundos
  function setStatus(msg, warn, opts) {
    const s = $("status");
    clearTimeout(statusTimer);
    if (opts && opts.auto) statusTimer = setTimeout(() => { if (s.textContent === msg) setStatus(""); }, 7000);
    s.textContent = msg || "";
    s.classList.toggle("warn", !!warn);
    s.hidden = !msg;
  }

  function go(v) {
    S.view = v;
    S.confirm = null;
    S.sheet = null;
    S.draft.editProject = null;
    S.draft.editTask = null;
    S.draft.editSub = null;
    S.draft.editHelpers = null;
    S.draft.mem = null;
    S.draft.subForm = null;
    S.draft.req = null;
    store.set("liga.view", v);
    render();
    window.scrollTo({ top: 0 });
  }

  L.pages.notFound = function (v) {
    L.ui.crumbs([{ label: "Início", go: () => go({ page: "home" }) }]);
    const loading = !S.loaded.projects || !S.loaded.subs;
    v.append(el("section", { class: "panel" },
      el("h2", null, loading ? "Carregando…" : "Não encontrado"),
      el("p", { class: "muted" }, loading ? "Buscando os dados." : "Esse projeto, listRat ou integrante não existe ou você não faz parte dele."),
      loading ? null : el("div", null, el("button", { class: "btn ghost", type: "button", onclick: () => go({ page: "projects" }) }, "Ver projetos"))));
  };

  /* ---------- desenho ---------- */

  function render() {
    // guarda o foco e a posição do cursor para não atrapalhar quem está digitando
    const ae = document.activeElement;
    const aid = ae && ae !== document.body ? ae.id : "";
    let selStart = null, selEnd = null;
    try { if (aid && typeof ae.selectionStart === "number") { selStart = ae.selectionStart; selEnd = ae.selectionEnd; } } catch (e) { /* ignora */ }

    document.documentElement.classList.toggle("signed-out", !S.myId);
    const v = $("view");
    v.replaceChildren();
    if (!S.authReady) {
      v.append(el("div", { class: "loading-line" }));
    } else if (!S.myId) {
      L.pages.login(v);
    } else {
      const page = PAGES.includes(S.view && S.view.page) ? S.view.page : "home";
      L.pages[page](v);
    }
    if (S.myId && S.sheet) { const sh = L.tasksUI.sheet(); if (sh) v.append(sh); }
    if (S.myId && S.invitePrompt) v.append(invitePromptBox());
    if (S.backend && S.backend.isTest) v.prepend(testBar());
    L.shell.renderMenu();
    L.shell.renderUserBox();
    L.fx.enter(v, S.myId ? JSON.stringify(S.view) : "login");
    L.fx.afterRender();

    if (aid) {
      const n = $(aid);
      if (n && n !== document.activeElement) {
        try {
          n.focus({ preventScroll: true });
          if (selStart != null && typeof n.setSelectionRange === "function") n.setSelectionRange(selStart, selEnd);
        } catch (e) { /* ignora */ }
      }
    }
  }

  // relê os dados da conta (depois de trocar usuário, e-mail, duas etapas…)
  function refreshUser() {
    const u = S.backend.auth.current();
    if (u && S.myId === u.id) {
      S.user = u;
      ensurePlayer();
      render();
    }
  }

  L.app = { render, go, setStatus, refreshUser };

  /* ---------- dados ---------- */

  function stopListening() {
    for (const u of S.unsubs) { try { u(); } catch (e) { /* ignora */ } }
    S.unsubs = [];
  }

  function resetData() {
    stopListening();
    Object.assign(S, {
      players: {}, projects: {}, subs: {}, tasks: {},
      loaded: { players: false, projects: false, subs: false, tasks: false },
      mine: null, myLoaded: false, pending: false, writing: false,
      ownerId: null, configLoaded: false, readOnly: false, photoCache: {},
      invites: {}, invitesOn: false, friendships: {}, reqs: {}, sentReqs: {}, notifs: {}, invitePrompt: null,
      justs: {}, contests: {}, sheet: null,
    });
    S.draft.settings = {};
    S.draft.newProject = null;
  }

  // todo usuário logado tem um documento de jogador com o nome de usuário como apelido
  function ensurePlayer() {
    if (!S.myLoaded || !S.user || !S.user.name) return;
    if (!S.mine) L.actions.join(S.user.name);
    else if (S.mine.nick !== S.user.name && !S.pending && !S.writing) L.actions.setNick(S.user.name);
  }

  function onListenError(e, coll) {
    if (e && e.code === "denied" && (coll === "justificativas" || coll === "contestacoes")) {
      setStatus("As regras novas do Firestore ainda não foram publicadas: justificativas e contestações não funcionam até colar o firestore.rules no Firebase e publicar.", true);
    } else if (e && e.code === "denied") setStatus("Sem permissão para ler os dados. Confira as regras do Firestore (arquivo firestore.rules).", true);
    else setStatus("Conexão perdida. Recarregue a página.", true);
  }

  function checkLoaded() {
    const all = S.loaded.players && S.loaded.projects && S.loaded.subs && S.loaded.tasks;
    if (all && /Conectando/.test($("status").textContent)) setStatus("");
    if (all && S.invite && S.myLoaded && !S.joining) useInvite();
  }

  /* ---------- convite: #convite=<código> no endereço ---------- */

  // guarda o código (mesmo antes de entrar na conta) e limpa o endereço
  function readInvite() {
    const m = /(?:^#|&)convite=([a-f0-9]{32})/.exec(location.hash || "");
    if (m) {
      try { sessionStorage.setItem("liga.invite", m[1]); } catch (e) { /* ignora */ }
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignora */ }
    }
    let t = m ? m[1] : null;
    if (!t) { try { t = sessionStorage.getItem("liga.invite"); } catch (e) { /* ignora */ } }
    S.invite = t && /^[a-f0-9]{32}$/.test(t) ? t : null;
  }
  function dropInvite() {
    S.invite = null;
    try { sessionStorage.removeItem("liga.invite"); } catch (e) { /* ignora */ }
  }
  // antes de entrar, pergunta: "Você quer entrar no projeto X?"
  async function useInvite() {
    S.joining = true;
    const token = S.invite;
    try {
      const r = await L.actions.peekInvite(token);
      if (r.already) {
        dropInvite();
        go({ page: "project", pid: r.pid });
        setStatus("Você já está no projeto " + r.name + ".", false, { auto: true });
      } else {
        S.invitePrompt = Object.assign({ token, busy: false }, r);
        // atrás da caixa, mostra o Início (e não uma página de projeto que a pessoa não vê)
        const vp = S.view && S.view.pid && S.projects[S.view.pid];
        if (S.view && S.view.pid && !(vp && L.perms.canSeeProject(vp))) S.view = { page: "home" };
        render();
      }
    } catch (e) {
      dropInvite();
      setStatus(L.actions.errMsg(e, "Não deu para usar o convite."), true);
      render();
    }
    S.joining = false;
  }

  function invitePromptBox() {
    const ip = S.invitePrompt;
    if (!ip) return null;
    const close = () => { S.invitePrompt = null; dropInvite(); render(); };
    return L.ui.modal("Entrar no projeto?",
      el("div", { class: "f" },
        el("p", null, "Você quer entrar no projeto ", el("b", { text: ip.name }), "?"),
        el("p", { class: "muted small" }, (ip.owner ? "Dono: " + L.ui.nameOf(ip.owner) + " · " : "") + ip.members + (ip.members === 1 ? " integrante" : " integrantes") + ". Você pode sair quando quiser.")),
      [
        el("button", { class: "btn ghost", type: "button", disabled: ip.busy, onclick: close }, "Agora não"),
        el("button", { class: "btn purple", type: "button", disabled: ip.busy, onclick: async () => {
          ip.busy = true; render();
          try {
            const r = await L.actions.joinByInvite(ip.token);
            S.invitePrompt = null; dropInvite();
            go({ page: "project", pid: r.pid });
            setStatus("Você entrou no projeto " + r.name + ".", false, { auto: true });
          } catch (e) {
            S.invitePrompt = null; dropInvite();
            setStatus(L.actions.errMsg(e, "Não deu para entrar no projeto."), true);
            render();
          }
        } }, ip.busy ? "Entrando…" : "Entrar no projeto"),
      ]);
  }
  /* ---------- modo de teste (?teste no endereço): dados de exemplo só neste navegador ---------- */
  function testBar() {
    return el("div", { class: "testbar" },
      el("b", null, "Modo de teste"),
      el("span", null, "Dados de exemplo só neste navegador. Entre como voce, ana, bruno ou carla (senha teste1234)."),
      el("div", { class: "row", style: "gap:6px" },
        el("button", { class: "btn ghost sm", type: "button", onclick: async () => { await L.demo.reset(); location.reload(); } }, "Recriar dados"),
        el("button", { class: "btn ghost sm", type: "button", onclick: () => { location.href = location.pathname; } }, "Sair do teste")));
  }

  window.addEventListener("hashchange", () => { readInvite(); if (S.invite && S.myId) checkLoaded(); render(); });

  function listen(coll, key, sanitize, where) {
    const watch = where
      ? (cb, err) => S.backend.watchWhere(coll, where[0], where[1], cb, err, where[2])
      : (cb, err) => S.backend.watch(coll, cb, err);
    S.unsubs.push(watch((docs) => {
      const out = {};
      for (const id in docs) {
        const v = sanitize(id, docs[id] || {});
        if (v) out[id] = v;
      }
      S[key] = out;
      S.loaded[key] = true;

      if (key === "players" && S.myId) {
        const me = out[S.myId];
        const cp = (o) => JSON.parse(JSON.stringify(o || {}));
        if (me && !S.mine) {
          S.mine = { nick: me.nick, done: cp(me.done), proofs: cp(me.proofs), notes: cp(me.notes), avatar: me.avatar || "", weeks: me.weeks ? cp(me.weeks) : undefined };
        } else if (me && S.mine && !S.pending && !S.writing && !S.uploading) {
          // atualização vinda de outro aparelho
          S.mine.done = cp(me.done);
          S.mine.proofs = cp(me.proofs);
          S.mine.notes = cp(me.notes);
          S.mine.avatar = me.avatar || "";
          S.mine.nick = me.nick || S.mine.nick;
        }
        S.myLoaded = true;
        ensurePlayer();
      }
      checkLoaded();
      render();
    }, (e) => onListenError(e, coll)));
  }

  function onAuth(user) {
    resetData();
    S.authReady = true;
    S.user = user;
    S.myId = user ? user.id : null;
    if (!user) { setStatus(""); render(); return; }

    S.draft.auth = S.newAuthDraft();
    setStatus("Conectando…");
    // "dono da liga" não existe mais; config/liga só serve de dono para projetos antigos sem dono gravado
    S.unsubs.push(S.backend.watchDoc("config/liga", (d) => {
      S.ownerId = d && typeof d.owner === "string" ? d.owner : null;
      S.configLoaded = true;
      render();
    }, () => { S.configLoaded = true; }));
    listen("convites", "invites", san.invite, ["createdBy", user.id]);   // só os links que eu criei
    listen("amizades", "friendships", san.friendship, ["users", user.id, "array-contains"]);
    listen("pedidos", "reqs", san.request, ["to", user.id]);            // convites para projetos que eu recebi
    listen("pedidos", "sentReqs", san.request, ["from", user.id]);      // convites que eu mandei
    listen("notificacoes", "notifs", san.notif, ["to", user.id]);
    listen("players", "players", san.player);
    listen("projetos", "projects", san.project);
    listen("subprojetos", "subs", san.sub);
    listen("tarefas", "tasks", san.task);
    listen("justificativas", "justs", san.justification);
    listen("contestacoes", "contests", san.contest);
    render();
  }

  /* ---------- início ---------- */

  async function init() {
    L.photos.setup();
    L.shell.setup();
    readInvite();

    const cfg = window.LIGA_CONFIG || {};
    const testing = L.data.local.isTest;
    const useFirebase = !testing && cfg.firebase && typeof cfg.firebase === "object" && cfg.firebase.apiKey;
    S.backend = useFirebase ? L.data.firebase : L.data.local;
    S.mode = S.backend.mode;
    render();
    if (testing) {
      try { await L.demo.ensure(); } catch (e) { console.error(e); setStatus("Não deu para criar os dados de teste.", true); }
    }

    try {
      await S.backend.start(onAuth);
    } catch (e) {
      console.error(e);
      S.authReady = true;
      render();
      setStatus(useFirebase
        ? "Não deu para conectar ao Firebase. Confira a internet e a configuração em js/config.js."
        : "Não deu para abrir o modo local neste navegador.", true);
    }

    // quando o dia vira, recalcula tudo (obrigatórias passam a contar como perdidas)
    let lastDay = L.dates.todayKey();
    setInterval(() => {
      if (L.dates.todayKey() !== lastDay) { lastDay = L.dates.todayKey(); render(); }
    }, 60000);

    window.addEventListener("pagehide", () => { if (S.pending) L.actions.flush(); });
  }

  init();
})(window.Liga);
