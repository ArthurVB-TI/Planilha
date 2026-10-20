/* state.js — estado único do site. Toda tela é desenhada a partir daqui. */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const { store } = L.text;

  const newTaskDraft = () => ({ title: "", type: "normal", kind: "daily", diff: "media", assignee: "" });
  const newAuthDraft = () => ({ tab: "login", login: "", password: "", username: "", email: "", password2: "", code: "", mfa: null, busy: false, err: "" });

  L.S = {
    backend: null,          // L.data.local ou L.data.firebase
    mode: "",               // "local" | "firebase"
    authReady: false,       // já sabemos se tem alguém logado?
    user: null,             // { id, name, email, emailVerified, createdAt, mfa }
    myId: null,
    ownerId: null,          // dono da liga (documento config/liga)
    configLoaded: false,
    isOwner: false,
    readOnly: false,

    players: {}, projects: {}, subs: {}, tasks: {},
    loaded: { players: false, projects: false, subs: false, tasks: false },

    mine: null,             // cópia editável do meu documento players/<meu id>
    myLoaded: false,
    pending: false, writing: false, saveTimer: 0,

    uploading: null, camTarget: null,
    photoCache: {},

    view: store.get("liga.view") || { page: "home" },
    navOpen: false,                                   // gaveta do celular
    projectsOpen: store.get("liga.projectsOpen") !== false,
    confirm: null,
    draft: {
      auth: newAuthDraft(),
      newProject: null,
      editProject: null,
      editTask: null,
      editSub: null,
      editHelpers: null,
      sub: "",
      task: newTaskDraft(),
      settings: {},
    },
    newTaskDraft, newAuthDraft,
    unsubs: [],
  };
})(window.Liga);
