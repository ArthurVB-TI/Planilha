/* pages/inbox.js — Notificações: uma caixa de entrada do site.
   Junta convites para projetos, pedidos de amizade, avisos dos projetos (alguém entrou, listRat começou,
   você virou dono/ajudante...) e avisos do site. Separado por categoria e por dia, com filtro de não lidas. */
window.Liga = window.Liga || {};
window.Liga.pages = window.Liga.pages || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el, icon } = L.dom;
  const { plural } = L.text;
  const { keyOf, todayKey, addDays, parseKey } = L.dates;

  const go = (v) => L.app.go(v);
  const rerender = () => L.app.render();
  const ok = (m) => L.app.setStatus(m, false, { auto: true });
  const err = (e, f) => L.app.setStatus(L.actions.errMsg(e, f), true);
  const draft = () => (S.draft.inbox = S.draft.inbox || { cat: "tudo", unread: false });

  const CATS = [
    ["tudo", "Tudo", "inbox"],
    ["convites", "Convites", "flag"],
    ["amizades", "Amizades", "heart"],
    ["projetos", "Projetos", "folder"],
    ["site", "Site", "bell"],
  ];
  const CAT_LABEL = { convites: "Convite", amizades: "Amizade", projetos: "Projeto", site: "listRats" };

  function dayLabel(ms) {
    const k = keyOf(new Date(ms)), t = todayKey();
    if (k === t) return "Hoje";
    if (k === addDays(t, -1)) return "Ontem";
    const d = parseKey(k);
    const s = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  const hour = (ms) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  async function markItemsRead(items) {
    const SO = L.social;
    SO.markSiteRead(items.filter((i) => i.local).map((i) => i.id));
    await SO.markRead(items.filter((i) => i.notif && !i.read).map((i) => i.id));
  }

  function itemBody(i) {
    const SO = L.social;
    if (i.kind === "project_invite") {
      const r = i.req;
      return {
        text: [el("b", { text: L.ui.nameOf(r.from) }), " convidou você para o projeto ", el("b", { text: r.projectName }), "."],
        actions: [
          el("button", { class: "btn sm purple", type: "button", onclick: async () => {
            try { const x = await SO.acceptProjectInvite(r); ok("Você entrou no projeto " + x.name + "."); go({ page: "project", pid: x.pid }); }
            catch (e) { err(e, "Não deu para entrar no projeto."); rerender(); }
          } }, "Entrar no projeto"),
          el("button", { class: "btn sm ghost", type: "button", onclick: async () => {
            try { await SO.declineProjectInvite(r); ok("Convite recusado."); } catch (e) { err(e, "Não deu para recusar."); }
            rerender();
          } }, "Recusar"),
        ],
      };
    }
    if (i.kind === "friend_request") {
      const f = i.fr;
      return {
        text: [el("b", { text: L.ui.nameOf(f.from) }), " quer ser seu amigo."],
        actions: [
          el("button", { class: "btn sm purple", type: "button", onclick: async () => {
            try { await SO.acceptFriend(f); ok("Agora você e " + L.ui.nameOf(f.from) + " são amigos."); } catch (e) { err(e, "Não deu para aceitar."); }
            rerender();
          } }, "Aceitar"),
          el("button", { class: "btn sm ghost", type: "button", onclick: async () => {
            try { await SO.removeFriendship(f); } catch (e) { err(e, "Não deu para recusar."); }
            rerender();
          } }, "Recusar"),
        ],
      };
    }
    // avisos (do banco ou do site)
    const actions = [];
    const p = i.projectId && S.projects[i.projectId];
    if (p && L.perms.canSeeProject(p)) {
      actions.push(el("button", { class: "btn sm ghost", type: "button", onclick: async () => {
        await markItemsRead([i]);
        go(i.sid && S.subs[i.sid] ? { page: "sub", pid: p.id, sid: i.sid } : { page: "project", pid: p.id });
      } }, "Abrir"));
    }
    if (i.kind === "email") actions.push(el("button", { class: "btn sm ghost", type: "button", onclick: async () => { await markItemsRead([i]); go({ page: "settings" }); } }, "Configurações"));
    if (i.kind === "friend_accepted") actions.push(el("button", { class: "btn sm ghost", type: "button", onclick: async () => { await markItemsRead([i]); go({ page: "friends" }); } }, "Ver amigos"));
    if (!i.read) actions.push(el("button", { class: "link", type: "button", onclick: async () => { await markItemsRead([i]); rerender(); } }, "Marcar como lida"));
    if (i.notif) actions.push(el("button", { class: "icon-btn sm-ico", type: "button", title: "Apagar", "aria-label": "Apagar notificação", onclick: async () => {
      try { await L.social.deleteNotif(i.id); } catch (e) { err(e, "Não deu para apagar."); }
      rerender();
    } }, icon("trash")));
    return { text: i.text, actions };
  }

  L.pages.inbox = function (v) {
    L.ui.crumbs([{ label: "Notificações" }]);
    const d = draft();
    const all = L.social.inbox();
    const count = (c) => all.filter((i) => (c === "tudo" || i.cat === c) && !i.read).length;

    v.append(L.ui.subHeader({
      kicker: "Caixa de entrada", title: "Notificações",
      sub: "Convites, pedidos de amizade e avisos dos seus projetos. Ninguém coloca você num projeto sem você aceitar aqui.",
      actions: el("div", { class: "row" },
        el("button", { class: "btn ghost", type: "button", "aria-pressed": d.unread ? "true" : "false", onclick: () => { d.unread = !d.unread; rerender(); } },
          d.unread ? "Mostrar todas" : "Só não lidas"),
        count("tudo") ? el("button", { class: "btn purple", type: "button", onclick: async () => {
          await markItemsRead(all.filter((i) => !i.read && (i.notif || i.local)));
          rerender();
        } }, "Marcar tudo como lido") : null),
    }, CATS.map(([key, label, ic]) => ({ key, label, ic, count: count(key), go: () => { d.cat = key; rerender(); } })), d.cat));

    const list = all.filter((i) => (d.cat === "tudo" || i.cat === d.cat) && (!d.unread || !i.read));
    if (!list.length) {
      v.append(L.ui.empty(d.unread ? "Nada sem ler por aqui." : "Nenhuma notificação nesta categoria."));
      return;
    }

    // agrupado por dia
    const days = [];
    for (const i of list) {
      const lab = dayLabel(i.createdAt || Date.now());
      let g = days.find((x) => x.lab === lab);
      if (!g) { g = { lab, items: [] }; days.push(g); }
      g.items.push(i);
    }
    v.append(el("div", { class: "inbox" }, days.map((g) =>
      el("section", { class: "iday" },
        el("h2", { class: "iday-t" }, g.lab, el("span", { class: "muted small" }, " · " + plural(g.items.length, "item", "itens"))),
        el("div", { class: "ilist" }, g.items.map((i) => {
          const b = itemBody(i);
          return el("article", { class: "inote" + (i.read ? "" : " unread") + " c-" + i.cat },
            el("div", { class: "inote-ic", "aria-hidden": "true" }, i.from ? L.ui.avatar(i.from) : el("img", { src: "assets/icon.svg", alt: "", width: "28", height: "28" })),
            el("div", { class: "inote-main" },
              el("div", { class: "inote-meta" }, el("span", { class: "ctag c-" + i.cat }, CAT_LABEL[i.cat] || "Aviso"), el("span", { class: "muted" }, hour(i.createdAt || Date.now())),
                i.read ? null : el("span", { class: "dot", title: "Não lida" })),
              el("p", { class: "inote-text" }, b.text),
              b.actions.length ? el("div", { class: "row inote-actions" }, b.actions) : null));
        }))))));
  };
})(window.Liga);
