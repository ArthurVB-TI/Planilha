/* main.js — liga tudo: escolhe o banco, acompanha o login, escuta as coleções e desenha as telas */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el, $ } = L.dom;
  const { store } = L.text;
  const san = L.rules.sanitize;

  const PAGES = ["home", "projects", "mine", "rules", "new", "project", "sub", "settings"];

  /* ---------- navegação e avisos ---------- */

  function setStatus(msg, warn) {
    const s = $("status");
    s.textContent = msg || "";
    s.classList.toggle("warn", !!warn);
    s.hidden = !msg;
  }

  function go(v) {
    S.view = v;
    S.confirm = null;
    S.draft.editProject = null;
    S.draft.editTask = null;
    S.draft.editSub = null;
    S.draft.editHelpers = null;
    store.set("liga.view", v);
    render();
    window.scrollTo({ top: 0 });
  }

  L.pages.notFound = function (v) {
    L.ui.crumbs([{ label: "Início", go: () => go({ page: "home" }) }]);
    const loading = !S.loaded.projects || !S.loaded.subs;
    v.append(el("section", { class: "panel" },
      el("h2", null, loading ? "Carregando…" : "Não encontrado"),
      el("p", { class: "muted" }, loading ? "Buscando os dados da liga." : "Esse projeto ou listRat não existe ou você não faz parte dele."),
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
      ownerId: null, configLoaded: false, isOwner: false, readOnly: false, photoCache: {},
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

  function onListenError(e) {
    if (e && e.code === "denied") setStatus("Sem permissão para ler a liga. Confira as regras do Firestore (arquivo firestore.rules).", true);
    else setStatus("Conexão perdida com a liga. Recarregue a página.", true);
  }

  function checkLoaded() {
    const all = S.loaded.players && S.loaded.projects && S.loaded.subs && S.loaded.tasks;
    if (all && /Conectando/.test($("status").textContent)) setStatus("");
  }

  function listen(coll, key, sanitize) {
    S.unsubs.push(S.backend.watch(coll, (docs) => {
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
          S.mine = { nick: me.nick, done: cp(me.done), proofs: cp(me.proofs), weeks: me.weeks ? cp(me.weeks) : undefined };
        } else if (me && S.mine && !S.pending && !S.writing && !S.uploading) {
          // atualização vinda de outro aparelho
          S.mine.done = cp(me.done);
          S.mine.proofs = cp(me.proofs);
          S.mine.nick = me.nick || S.mine.nick;
        }
        S.myLoaded = true;
        ensurePlayer();
      }
      checkLoaded();
      render();
    }, onListenError));
  }

  function onAuth(user) {
    resetData();
    S.authReady = true;
    S.user = user;
    S.myId = user ? user.id : null;
    if (!user) { setStatus(""); render(); return; }

    S.draft.auth = S.newAuthDraft();
    setStatus("Conectando…");
    S.unsubs.push(S.backend.watchDoc("config/liga", (d) => {
      S.ownerId = d && typeof d.owner === "string" ? d.owner : null;
      S.isOwner = !!S.ownerId && S.ownerId === S.myId;
      S.configLoaded = true;
      render();
    }, onListenError));
    listen("players", "players", san.player);
    listen("projetos", "projects", san.project);
    listen("subprojetos", "subs", san.sub);
    listen("tarefas", "tasks", san.task);
    render();
  }

  /* ---------- início ---------- */

  async function init() {
    L.photos.setup();
    L.shell.setup();

    const cfg = window.LIGA_CONFIG || {};
    const useFirebase = cfg.firebase && typeof cfg.firebase === "object" && cfg.firebase.apiKey;
    S.backend = useFirebase ? L.data.firebase : L.data.local;
    S.mode = S.backend.mode;
    render();

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
