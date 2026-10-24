/* pages/friends.js — Amigos: procurar pessoas, mandar e responder pedidos de amizade, lista de amigos.
   O placar geral do Início mostra só você e seus amigos. */
window.Liga = window.Liga || {};
window.Liga.pages = window.Liga.pages || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el, icon, $ } = L.dom;
  const { clean, fmtTotal, plural } = L.text;
  const { NICK_MAX } = L.rules;

  const rerender = () => L.app.render();
  const ok = (m) => L.app.setStatus(m, false, { auto: true });
  const err = (e, f) => L.app.setStatus(L.actions.errMsg(e, f), true);
  const draft = () => (S.draft.friends = S.draft.friends || { q: "", confirm: "" });
  const total = (uid) => L.score.scoreFor(uid, Object.values(S.tasks)).total;

  // mesmo jeito da busca de integrantes: nada aparece antes de digitar 2 letras; quem não existe não aparece
  function search(q) {
    if (q.length < 2) return [];
    return Object.keys(S.players)
      .filter((id) => id !== S.myId && clean(S.players[id].nick, NICK_MAX))
      .map((id) => ({ id, n: L.ui.nameOf(id).toLowerCase() }))
      .filter((h) => h.n.includes(q))
      .sort((a, b) => (a.n.startsWith(q) ? 0 : 1) - (b.n.startsWith(q) ? 0 : 1) || a.n.localeCompare(b.n))
      .slice(0, 6).map((h) => h.id);
  }

  function personLine(id, right, sub) {
    return el("div", { class: "cand" },
      L.ui.avatar(id),
      el("div", { class: "pname", style: "display:grid;gap:0" }, el("span", { text: L.ui.nameOf(id) }), sub ? el("span", { class: "small muted" }, sub) : null),
      el("div", { class: "row", style: "gap:6px;justify-content:flex-end" }, right));
  }

  L.pages.friends = function (v) {
    L.ui.crumbs([{ label: "Amigos" }]);
    const d = draft();
    const SO = L.social;
    const friends = SO.friends().sort((a, b) => total(b) - total(a));
    const inc = SO.incoming(), out = SO.outgoing();

    v.append(L.ui.subHeader({
      kicker: "Social", title: "Amigos",
      sub: "Seus amigos aparecem no placar geral do Início. Pedidos de amizade chegam nas notificações.",
      stats: [L.ui.stat("Amigos", String(friends.length)), L.ui.stat("Pedidos", String(inc.length))],
    }, [], ""));

    const grid = el("div", { class: "grid" });
    const left = el("div", { class: "stack" }), right = el("div", { class: "stack" });
    grid.append(left, right);
    v.append(grid);

    // pedidos recebidos
    if (inc.length) {
      left.append(L.ui.block("Pedidos de amizade", null,
        el("div", { class: "cands" }, inc.map((f) => personLine(f.from, [
          el("button", { class: "btn sm purple", type: "button", onclick: async () => {
            try { await SO.acceptFriend(f); ok("Agora você e " + L.ui.nameOf(f.from) + " são amigos."); } catch (e) { err(e, "Não deu para aceitar."); }
            rerender();
          } }, "Aceitar"),
          el("button", { class: "btn sm ghost", type: "button", onclick: async () => {
            try { await SO.removeFriendship(f); } catch (e) { err(e, "Não deu para recusar."); }
            rerender();
          } }, "Recusar"),
        ], L.ui.ago(f.createdAt))))));
    }

    // amigos
    left.append(L.ui.block("Seus amigos", friends.length ? plural(friends.length, "amigo", "amigos") + " · ordenados pelos pontos" : null,
      friends.length
        ? el("div", { class: "cands" }, friends.map((id) => {
            const f = SO.friendshipWith(id);
            const asking = d.confirm === id;
            return personLine(id, asking
              ? [el("span", { class: "small muted" }, "Desfazer amizade?"),
                 el("button", { class: "btn sm danger", type: "button", onclick: async () => {
                   d.confirm = "";
                   try { await SO.removeFriendship(f); ok("Amizade desfeita."); } catch (e) { err(e, "Não deu para desfazer."); }
                   rerender();
                 } }, "Sim"),
                 el("button", { class: "btn sm ghost", type: "button", onclick: () => { d.confirm = ""; rerender(); } }, "Não")]
              : [el("span", { class: "pts" + (total(id) < 0 ? " neg" : "") }, fmtTotal(total(id))),
                 el("button", { class: "link", type: "button", title: "Desfazer amizade", onclick: () => { d.confirm = id; rerender(); } }, "Remover")],
              f && f.acceptedAt ? "amigos desde " + L.ui.fmtDate(L.dates.keyOf(new Date(f.acceptedAt))) : "");
          }))
        : L.ui.empty("Você ainda não tem amigos aqui. Procure pelo nome de usuário ao lado.")));

    // procurar e adicionar
    const q = clean(d.q, 20).toLowerCase();
    const found = search(q);
    right.append(L.ui.block("Adicionar amigo", "Procure pelo nome de usuário. A pessoa precisa aceitar.",
      el("form", { class: "field", role: "search", onsubmit: (ev) => ev.preventDefault() },
        el("label", { for: "fSearch" }, "Nome de usuário"),
        el("input", { id: "fSearch", type: "search", autocomplete: "off", autocapitalize: "none", spellcheck: "false", maxlength: "20",
          value: d.q, placeholder: "digite o usuário…", oninput: (e) => { d.q = e.target.value; rerender(); } })),
      found.length
        ? el("div", { class: "cands" }, found.map((id) => {
            const f = SO.friendshipWith(id);
            let right;
            if (f && f.status === "accepted") right = el("span", { class: "small muted" }, "já é seu amigo");
            else if (f && f.from === S.myId) right = el("span", { class: "small muted" }, "pedido enviado");
            else right = el("button", { class: "btn sm", type: "button", onclick: async () => {
              try {
                const r = await SO.sendFriendRequest(id);
                ok(r === "accepted" ? "Agora você e " + L.ui.nameOf(id) + " são amigos." : "Pedido de amizade enviado para " + L.ui.nameOf(id) + ".");
                d.q = "";
              } catch (e) { err(e, "Não deu para mandar o pedido."); }
              rerender();
            } }, icon("plus"), f && f.to === S.myId ? "Aceitar pedido" : "Adicionar");
            return personLine(id, right);
          }))
        : null,
      el("p", { class: "hint" }, q.length < 2 ? "Digite pelo menos 2 letras." : found.length ? "" : "Ninguém com esse nome.")));

    if (out.length) {
      right.append(L.ui.block("Pedidos enviados", "Esperando a outra pessoa aceitar.",
        el("div", { class: "cands" }, out.map((f) => personLine(f.to,
          el("button", { class: "link danger", type: "button", onclick: async () => {
            try { await SO.removeFriendship(f); } catch (e) { err(e, "Não deu para cancelar."); }
            rerender();
          } }, "Cancelar"), L.ui.ago(f.createdAt))))));
    }
  };
})(window.Liga);
