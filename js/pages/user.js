/* pages/user.js — perfil de uma pessoa: foto, pontos, projetos em comum e o botão de amizade.
   Rota: { page: "user", uid }. Abre ao tocar no nome de alguém (placar, resultado, amigos, tarefas…). */
window.Liga = window.Liga || {};
window.Liga.pages = window.Liga.pages || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el, icon } = L.dom;
  const { fmtTotal, plural } = L.text;

  const go = (v) => L.app.go(v);

  L.pages.user = function (v) {
    const id = S.view.uid;
    if (!id || (!S.players[id] && id !== S.myId)) return L.pages.notFound(v);
    const me = id === S.myId;
    const name = L.ui.nameOf(id);
    L.ui.crumbs([{ label: "Amigos", go: () => go({ page: "friends" }) }, { label: name }]);

    // projetos que vocês dois têm (os que você enxerga)
    const shared = L.ui.visibleProjects().filter((p) => p.members.includes(id));
    const tasks = Object.values(S.tasks).filter((t) => shared.some((p) => S.subs[t.subId] && S.subs[t.subId].projectId === p.id));
    const sc = L.score.scoreFor(id, tasks);
    const f = L.social.friendshipWith(id);
    const friend = f && f.status === "accepted";

    const since = friend && f.acceptedAt ? "Amigos desde " + L.ui.fmtDate(L.dates.keyOf(new Date(f.acceptedAt))) : me ? "Este é o seu perfil." : "";
    v.append(el("section", { class: "hero solo profile" },
      el("div", { class: "hero-main profile-main" },
        L.ui.avatar(id, "xl"),
        el("div", { class: "profile-id" },
          el("div", { class: "hero-kicker" }, "Perfil"),
          el("h1", { class: "hero-title" }, el("span", { text: name }),
            me ? el("span", { class: "you" }, "você") : friend ? el("span", { class: "ftag" }, "amigo") : null),
          since ? el("div", { class: "hero-sub" }, since) : null,
          el("div", { class: "profile-acts" }, me
            ? el("button", { class: "btn purple", type: "button", onclick: () => go({ page: "settings" }) }, icon("camera"), "Trocar foto e dados")
            : L.social.friendButton(id, { big: true, remove: true })))),
      el("div", { class: "hero-side" }, el("div", { class: "stats" },
        L.ui.stat(me ? "Seus pontos" : "Pontos com você", fmtTotal(sc.total), sc.total < 0 ? "neg" : ""),
        L.ui.stat("Projetos em comum", String(shared.length))))));

    v.append(L.ui.block(me ? "Seus projetos" : "Projetos em comum", shared.length ? null : (me ? "Você ainda não está em nenhum projeto." : "Vocês ainda não estão no mesmo projeto."),
      shared.length
        ? el("div", { class: "clist" }, shared.map((p) => {
            const pt = L.score.scoreFor(id, L.score.tasksOfProject(p.id)).total;
            return el("button", { type: "button", class: "citem", onclick: () => go({ page: "project", pid: p.id }) },
              el("div", { style: "min-width:0" },
                el("div", { class: "t", text: p.name }),
                el("div", { class: "small muted" }, plural(p.members.length, "integrante", "integrantes") + (L.perms.projOwner(p) === id ? " · dono" : ""))),
              el("span", { class: "pts" + (pt < 0 ? " neg" : "") }, fmtTotal(pt)));
          }))
        : null));
  };
})(window.Liga);
