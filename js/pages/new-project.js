/* pages/new-project.js — Novo projeto (só o dono) */
window.Liga = window.Liga || {};
window.Liga.pages = window.Liga.pages || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { el } = L.dom;

  L.pages.new = function (v) {
    L.ui.crumbs([{ label: "Projetos", go: () => L.app.go({ page: "projects" }) }, { label: "Novo projeto" }]);
    if (!S.isOwner) {
      v.append(L.ui.pageHead("Novo projeto"), L.ui.empty("Só o dono da liga cria projetos."));
      return;
    }
    if (!S.draft.newProject) S.draft.newProject = { name: "", desc: "", members: [S.myId] };
    v.append(L.ui.pageHead("Novo projeto"), L.forms.newProjectForm());
  };
})(window.Liga);
