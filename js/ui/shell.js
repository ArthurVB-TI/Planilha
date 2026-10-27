/* ui/shell.js — moldura do site: menu lateral (abre e fecha), projetos dentro de "Projetos",
   gaveta no celular, usuário no rodapé do menu e tema */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el, icon, $ } = L.dom;
  const { store } = L.text;

  const root = document.documentElement;
  const isMobile = () => window.matchMedia("(max-width: 760px)").matches;

  /* ---------- abrir e fechar o menu ---------- */
  function toggleNav() {
    if (isMobile()) {
      S.navOpen = !S.navOpen;
      root.classList.toggle("nav-open", S.navOpen);
      renderTabbar();
      L.app.syncHistory();   // "voltar" fecha o menu
    } else {
      const closed = !root.classList.contains("nav-closed");
      root.classList.toggle("nav-closed", closed);
      store.set("liga.navClosed", closed);
    }
  }
  function closeDrawer() {
    if (!S.navOpen) return;
    S.navOpen = false;
    root.classList.remove("nav-open");
    renderTabbar();
    L.app.syncHistory();
  }

  function go(v) {
    if (isMobile()) closeDrawer();
    L.app.go(v);
  }

  let navAnim = false; // anima a lista de projetos só quando ela acabou de abrir

  /* ---------- itens ---------- */
  function item(opts) {
    const on = !!opts.on;
    return el("button", {
      type: "button", class: "nav-item" + (on ? " on" : "") + (opts.cls ? " " + opts.cls : ""),
      "aria-current": on ? "page" : null, onclick: opts.onclick, title: opts.title || null,
    }, opts.ic ? icon(opts.ic) : null, el("span", { class: "lbl-t", text: opts.label }), opts.extra || null);
  }

  function renderMenu() {
    const nav = $("menu");
    nav.replaceChildren();
    if (!S.myId) return;
    const v = S.view || {};
    const pg = v.page;
    const pend = L.score.pendingMandatory();

    nav.append(
      item({ ic: "home", label: "Início", on: pg === "home", onclick: () => go({ page: "home" }) }),
      item({ ic: "list", label: "Minhas tarefas", on: pg === "mine", onclick: () => go({ page: "mine" }),
        extra: pend ? el("span", { class: "count", title: pend + " obrigatória(s) pendente(s)" }, String(pend)) : null }));

    const nUnread = L.social ? L.social.unread() : 0;
    nav.append(
      item({ ic: "bell", label: "Notificações", on: pg === "inbox", onclick: () => go({ page: "inbox" }),
        extra: nUnread ? el("span", { class: "count purple", title: nUnread + " não lida(s)" }, String(nUnread)) : null }),
      item({ ic: "heart", label: "Amigos", on: pg === "friends", onclick: () => go({ page: "friends" }) }),
      item({ ic: "chart", label: "Gráficos", on: pg === "charts", onclick: () => go({ page: "charts" }) }));

    // Projetos, com os projetos (e as listRats do projeto aberto) por dentro
    const open = S.projectsOpen;
    const caret = el("button", {
      type: "button", class: "icon-btn caret", "aria-expanded": open ? "true" : "false",
      "aria-label": open ? "Esconder projetos" : "Mostrar projetos",
      onclick: () => { S.projectsOpen = !S.projectsOpen; store.set("liga.projectsOpen", S.projectsOpen); navAnim = S.projectsOpen; renderMenu(); },
    }, icon("chevron"));
    nav.append(el("div", { class: "nav-group" + (open ? " open" : "") },
      item({ ic: "folder", label: "Projetos", on: pg === "projects" || pg === "new",
        onclick: () => { if (!S.projectsOpen) { S.projectsOpen = true; store.set("liga.projectsOpen", true); } go({ page: "projects" }); } }),
      caret));

    if (open) {
      const sub = el("div", { class: "nav-sub" + (navAnim ? " opening" : "") });
      navAnim = false;
      const list = L.ui.visibleProjects();
      for (const p of list) {
        const here = (pg === "project" || pg === "sub" || pg === "members") && v.pid === p.id;
        sub.append(item({ label: p.name, on: pg === "project" && here, title: p.name, onclick: () => go({ page: "project", pid: p.id }) }));
        if (here) {
          const subs = Object.values(S.subs).filter((s) => s.projectId === p.id).sort((a, b) => a.createdAt - b.createdAt);
          sub.append(el("div", { class: "nav-sub" },
            item({ ic: "users", label: "Integrantes", cls: "people-i", on: pg === "members", onclick: () => go({ page: "members", pid: p.id }) }),
            subs.map((s) =>
              item({ label: s.name, title: s.name, on: pg === "sub" && v.sid === s.id, onclick: () => go({ page: "sub", pid: p.id, sid: s.id }) }))));
        }
      }
      sub.append(item({ label: "+ Novo projeto", cls: "add", on: pg === "new", onclick: () => go({ page: "new" }) }));
      nav.append(sub);
    }

    nav.append(item({ ic: "book", label: "Regras", on: pg === "rules", onclick: () => go({ page: "rules" }) }));
  }

  /* ---------- celular: barra fixa embaixo ---------- */
  const MORE = ["friends", "charts", "rules", "settings", "user"];
  function renderTabbar() {
    const bar = $("tabbar");
    if (!bar) return;
    bar.replaceChildren();
    if (!S.myId) return;
    const pg = (S.view || {}).page;
    const pend = L.score.pendingMandatory();
    const nUnread = L.social ? L.social.unread() : 0;
    const tab = (ic, label, on, onclick, n) => el("button", {
      type: "button", class: "tb" + (on ? " on" : ""), "aria-current": on ? "page" : null, onclick,
    }, el("span", { class: "tb-ic" }, icon(ic), n ? el("span", { class: "tb-n" }, n > 99 ? "99+" : String(n)) : null), el("span", { class: "tb-l" }, label));
    bar.append(
      tab("home", "Início", pg === "home", () => go({ page: "home" })),
      tab("list", "Tarefas", pg === "mine", () => go({ page: "mine" }), pend),
      tab("folder", "Projetos", ["projects", "project", "sub", "members", "new", "subform"].includes(pg), () => go({ page: "projects" })),
      tab("bell", "Avisos", pg === "inbox", () => go({ page: "inbox" }), nUnread),
      tab("menu", "Mais", S.navOpen || MORE.includes(pg), toggleNav));
  }

  // depois de desenhar: deixa a aba aberta (Visão geral, Tarefas…) visível na faixa de abas
  function afterRender() {
    const bar = document.querySelector(".tabsbar");
    const on = bar && bar.querySelector(".tabbtn.on");
    if (on && bar.scrollWidth > bar.clientWidth) {
      bar.scrollLeft = Math.max(0, on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2);
    }
    if (bar) bar.classList.toggle("scrolls", bar.scrollWidth > bar.clientWidth + 2);
  }

  function renderUserBox() {
    const box = $("userBox");
    box.replaceChildren();
    if (!S.myId) return;
    box.append(
      item({ ic: "gear", label: "Configurações", on: S.view.page === "settings", onclick: () => go({ page: "settings" }) }),
      el("div", { class: "me-line" },
        L.ui.avatar(S.myId),
        el("div", null,
          el("div", { class: "n", text: L.ui.nameOf(S.myId) }),
          el("div", { class: "s", text: (() => { const n = L.ui.visibleProjects().length; return n ? n + (n === 1 ? " projeto" : " projetos") : "sem projetos"; })() }))));
  }

  /* ---------- tema (padrão: escuro) ---------- */
  const theme = () => (store.get("liga.theme") === "light" ? "light" : "dark");
  function setTheme(t) {
    store.set("liga.theme", t);
    root.dataset.theme = t;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = t === "light" ? "#f3f2ee" : "#0f1012";
  }

  function setup() {
    $("brandBtn").addEventListener("click", () => go({ page: "home" }));
    $("navToggle").append(icon("menu"));
    $("navToggle").addEventListener("click", toggleNav);
    $("navClose").append(icon("close"));
    $("navClose").addEventListener("click", closeDrawer);
    $("backdrop").addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.navOpen) closeDrawer(); });
    setTheme(theme());
  }

  L.shell = { renderMenu, renderUserBox, renderTabbar, afterRender, setup, theme, setTheme, closeDrawer };
})(window.Liga);
