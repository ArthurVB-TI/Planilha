/* social.js — amizades, convites para projetos (pedidos) e notificações.
   - Amizade: amizades/<menor uid>_<maior uid> { users, from, to, status: pending|accepted }.
   - Convite para projeto: pedidos/<projeto>_<pessoa>. Ninguém é colocado num projeto sem aceitar.
   - Notificação: notificacoes/<id> { to, from, cat: projetos|amizades|site, kind, text, projectId, sid, read }.
   As notificações "do site" (boas-vindas, lembrete de e-mail) são montadas aqui mesmo, sem ir para o banco. */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { store } = L.text;

  const db = () => S.backend;
  const fail = (code) => Object.assign(new Error(code), { code });
  const me = () => S.myId;
  const name = (id) => L.ui.nameOf(id);
  const pairId = (a, b) => (a < b ? a + "_" + b : b + "_" + a);

  /* ---------- amizades ---------- */
  const all = () => Object.values(S.friendships);
  const friends = () => all().filter((f) => f.status === "accepted").map((f) => (f.users[0] === me() ? f.users[1] : f.users[0]));
  const incoming = () => all().filter((f) => f.status === "pending" && f.to === me());
  const outgoing = () => all().filter((f) => f.status === "pending" && f.from === me());
  const friendshipWith = (uid) => S.friendships[pairId(me(), uid)] || null;
  const isFriend = (uid) => { const f = friendshipWith(uid); return !!f && f.status === "accepted"; };

  // quanto você interage com alguém: projetos em comum (3), listRats em que os dois participam (2),
  // avisos que a pessoa te mandou (1). Empate: amizade mais antiga primeiro.
  function interaction(uid) {
    let n = 0;
    for (const p of Object.values(S.projects)) {
      if (!p.members.includes(me()) || !p.members.includes(uid)) continue;
      n += 3;
      for (const s of Object.values(S.subs)) {
        if (s.projectId === p.id && L.score.isParticipant(s, me()) && L.score.isParticipant(s, uid)) n += 2;
      }
    }
    for (const x of Object.values(S.notifs)) if (x.from === uid) n += 1;
    return n;
  }
  // amigos que mais interagem com você (sem os que "skip" mandar pular)
  function topFriends(limit, skip) {
    return friends().filter((id) => !(skip && skip(id)))
      .map((id) => ({ id, n: interaction(id), since: (friendshipWith(id) || {}).acceptedAt || 0 }))
      .sort((a, b) => b.n - a.n || a.since - b.since)
      .slice(0, limit).map((x) => x.id);
  }

  async function sendFriendRequest(uid) {
    if (!uid || uid === me()) throw fail("unknown");
    const f = friendshipWith(uid);
    if (f && f.status === "accepted") return "already";
    if (f && f.to === me()) { await acceptFriend(f); return "accepted"; }   // a outra pessoa já tinha pedido
    if (f) return "sent";
    const users = [me(), uid].sort();
    await db().set("amizades/" + pairId(me(), uid), { users, from: me(), to: uid, status: "pending", createdAt: Date.now() });
    return "sent";
  }
  async function acceptFriend(f) {
    await db().update("amizades/" + f.id, { status: "accepted", acceptedAt: Date.now() });
    notify(f.from, "amizades", "friend_accepted", name(me()) + " aceitou seu pedido de amizade.");
  }
  const removeFriendship = (f) => db().remove("amizades/" + f.id);

  /* ---------- convites para projetos ---------- */
  const reqId = (pid, uid) => pid + "_" + uid;
  async function sendProjectInvite(pid, uid) {
    const p = S.projects[pid];
    if (!p) throw fail("unknown");
    if (p.members.includes(uid)) throw fail("already_member");
    await db().set("pedidos/" + reqId(pid, uid), { projectId: pid, projectName: p.name, from: me(), to: uid, createdAt: Date.now() });
  }
  const cancelProjectInvite = (r) => db().remove("pedidos/" + r.id);

  async function acceptProjectInvite(r) {
    const p = await db().get("projetos/" + r.projectId);
    if (!p) { await db().remove("pedidos/" + r.id).catch(() => {}); throw fail("project_gone"); }
    const members = Array.isArray(p.members) ? p.members : [];
    if (!members.includes(me())) {
      await db().update("projetos/" + r.projectId, { members: members.concat([me()]), joinedVia: "pedido" });
    }
    await db().remove("pedidos/" + r.id).catch(() => {});
    notify(r.from, "projetos", "joined", name(me()) + " aceitou o convite e entrou em " + (p.name || r.projectName) + ".", { projectId: r.projectId });
    return { pid: r.projectId, name: p.name || r.projectName };
  }
  async function declineProjectInvite(r) {
    await db().remove("pedidos/" + r.id);
    notify(r.from, "projetos", "declined", name(me()) + " recusou o convite para " + r.projectName + ".", { projectId: r.projectId });
  }

  /* ---------- notificações ---------- */
  // nunca atrapalha a ação principal: se não der para avisar, segue em frente
  function notify(to, cat, kind, text, extra) {
    if (!to || to === me()) return Promise.resolve();
    extra = extra || {};
    const id = db().newId("notificacoes");
    return db().set("notificacoes/" + id, {
      to, from: me(), cat, kind, text: String(text).slice(0, 200),
      projectId: extra.projectId || "", sid: extra.sid || "", createdAt: Date.now(), read: false,
    }).catch((e) => console.warn("aviso não enviado", e));
  }
  const markRead = (ids) => Promise.all(ids.map((id) => db().update("notificacoes/" + id, { read: true }).catch(() => {})));
  const deleteNotif = (id) => db().remove("notificacoes/" + id);

  // avisos do site (montados aqui; o "lido" fica salvo neste navegador)
  function siteNotes() {
    if (!S.user) return [];
    const seen = store.get("listrats.seen." + me()) || {};
    const created = S.user.createdAt || Date.now();
    const out = [{
      id: "site:welcome", cat: "site", kind: "welcome", local: true, createdAt: created, read: !!seen["site:welcome"],
      text: "Bem-vindo ao listRats! Crie um projeto, chame seus amigos e montem as listRats de vocês.",
    }];
    if (S.mode === "firebase" && !S.user.email) {
      out.push({ id: "site:email", cat: "site", kind: "email", local: true, createdAt: created + 1, read: !!seen["site:email"],
        text: "Sua conta ainda não tem e-mail. Adicione um em Configurações para conseguir recuperar a conta." });
    }
    return out;
  }
  function markSiteRead(ids) {
    const seen = store.get("listrats.seen." + me()) || {};
    for (const id of ids) seen[id] = true;
    store.set("listrats.seen." + me(), seen);
  }

  // tudo o que aparece na caixa de notificações
  function inbox() {
    const items = [];
    for (const r of Object.values(S.reqs)) items.push({ id: "req:" + r.id, cat: "convites", kind: "project_invite", req: r, createdAt: r.createdAt, read: false, from: r.from });
    for (const f of incoming()) items.push({ id: "fr:" + f.id, cat: "amizades", kind: "friend_request", fr: f, createdAt: f.createdAt, read: false, from: f.from });
    for (const n of Object.values(S.notifs)) items.push(Object.assign({}, n, { notif: true }));
    for (const n of siteNotes()) items.push(n);
    return items.sort((a, b) => b.createdAt - a.createdAt);
  }
  // número no menu: convites e pedidos esperando + avisos não lidos
  const unread = () => inbox().filter((i) => !i.read).length;

  // botão de amizade para o perfil de alguém: Adicionar amigo / Pedido enviado / Aceitar pedido / Amigos
  function friendButton(uid) {
    const { el, icon } = L.dom;
    if (!uid || uid === me()) return null;
    const f = friendshipWith(uid);
    const run = async (fn, okText) => {
      try { await fn(); if (okText) L.app.setStatus(okText, false, { auto: true }); }
      catch (e) { L.app.setStatus(L.actions.errMsg(e, "Não deu certo agora."), true); }
      L.app.render();
    };
    if (f && f.status === "accepted") return el("span", { class: "fstate ok" }, icon("heart"), "Amigos");
    if (f && f.from === me()) {
      return el("div", { class: "row", style: "gap:6px;align-items:center" },
        el("span", { class: "fstate" }, "Pedido de amizade enviado"),
        el("button", { class: "btn ghost sm", type: "button", onclick: () => run(() => removeFriendship(f), "Pedido cancelado.") }, "Cancelar"));
    }
    if (f && f.to === me()) {
      return el("div", { class: "row", style: "gap:6px" },
        el("button", { class: "btn purple sm", type: "button", onclick: () => run(() => acceptFriend(f), "Agora vocês são amigos.") }, icon("heart"), "Aceitar pedido de amizade"),
        el("button", { class: "btn ghost sm", type: "button", onclick: () => run(() => removeFriendship(f)) }, "Recusar"));
    }
    return el("button", { class: "btn purple sm", type: "button", onclick: () => run(() => sendFriendRequest(uid), "Pedido de amizade enviado para " + name(uid) + ".") }, icon("plus"), "Adicionar amigo");
  }

  L.social = {
    friendButton,
    pairId, friends, isFriend, interaction, topFriends, incoming, outgoing, friendshipWith, sendFriendRequest, acceptFriend, removeFriendship,
    sendProjectInvite, cancelProjectInvite, acceptProjectInvite, declineProjectInvite,
    notify, markRead, deleteNotif, markSiteRead, inbox, unread,
  };
  // atalhos usados pelas telas
  Object.assign(L.actions, { sendProjectInvite, cancelProjectInvite });
})(window.Liga);
