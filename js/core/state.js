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
    ownerId: null,          // antigo "dono da liga" (config/liga): só vale como dono de projetos antigos sem dono
    configLoaded: false,
    readOnly: false,

    players: {}, projects: {}, subs: {}, tasks: {},
    invites: {}, invitesOn: false,  // links de convite que eu criei
    friendships: {},                // amizades (pedidos e aceitas) em que eu estou
    reqs: {}, sentReqs: {},         // convites para projetos: recebidos e enviados
    notifs: {},                     // minhas notificações
    invitePrompt: null,             // janela "Você quer entrar no projeto X?" (link de convite)
    invite: null, joining: false,   // código de convite recebido pelo endereço (#convite=...)
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
      subForm: null,
      charts: null,           // página de gráficos: { pid, sid, range, type, table }
      req: null,              // regras de inscrição sendo editadas { sid, minObr, minTasks, maxTasks, maxDesvio }          // página de nova/editar listRat
      mem: null,              // página de integrantes: busca, quem está sendo editado, aviso
      sub: "",
      task: newTaskDraft(),
      settings: {},
    },
    newTaskDraft, newAuthDraft,
    unsubs: [],
  };
})(window.Liga);
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
    ownerId: null,          // antigo "dono da liga" (config/liga): só vale como dono de projetos antigos sem dono
    configLoaded: false,
    readOnly: false,

    players: {}, projects: {}, subs: {}, tasks: {},
    invites: {}, invitesOn: false,  // links de convite que eu criei
    invite: null, joining: false,   // código de convite recebido pelo endereço (#convite=...)
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
      subForm: null,
      charts: null,           // página de gráficos: { pid, sid, range, type, table }
      req: null,              // regras de inscrição sendo editadas { sid, minObr, minTasks, maxTasks, maxDesvio }          // página de nova/editar listRat
      mem: null,              // página de integrantes: busca, quem está sendo editado, aviso
      sub: "",
      task: newTaskDraft(),
      settings: {},
    },
    newTaskDraft, newAuthDraft,
    unsubs: [],
  };
})(window.Liga);
