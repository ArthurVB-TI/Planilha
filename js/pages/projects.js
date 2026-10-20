/* pages/projects.js — lista de projetos (é por aqui que se entra num projeto) */
window.Liga = window.Liga || {};
window.Liga.pages = window.Liga.pages || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el } = L.dom;

  L.pages.projects = function (v) {
    L.ui.crumbs([{ label: "Projetos" }]);
    const n = L.ui.visibleProjects().length;
    v.append(L.ui.pageHead("Projetos", n ? n + (n === 1 ? " projeto" : " projetos") : "",
      S.isOwner ? el("button", { class: "btn", type: "button", onclick: () => L.app.go({ page: "new" }) }, "Novo projeto") : null));
    v.append(L.ui.projectList());
  };
})(window.Liga);
