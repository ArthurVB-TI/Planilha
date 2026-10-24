/* data/local.js — MODO LOCAL: guarda tudo no localStorage deste navegador, inclusive as contas.
   Dá para criar várias contas aqui para testar como se fossem amigos.
   Mesma interface do data/firebase.js, então o resto do site não sabe a diferença.

   Interface de um "backend":
     start(onAuth)                chama onAuth(usuario | null) quando alguém entra ou sai
     watch(colecao, cb, onErr)    cb({ id: dados, ... }) a cada mudança; devolve função para parar
     watchWhere(colecao, campo, valor, cb, onErr)  igual, só com os documentos em que campo == valor
     watchDoc(caminho, cb, onErr)
     get(caminho) -> dados | null   newId(colecao)
     set / update / remove / removeMany
     claimOwner(uid)
     photos.save(dataUrl, uid) -> id   photos.load(id) -> dataUrl   photos.remove(id)
     auth.current()  auth.signUp({username,email,password})  auth.signIn(login, senha) -> {} | {mfa, resolve(code)}
     auth.signOut()  auth.changeUsername(novo)  auth.changePassword(atual, nova, codigo)
     auth.changeEmail(novo, senha, codigo)  auth.sendVerification()  auth.reload()
     auth.mfaStart(senha, codigo) -> {secret, uri}  auth.mfaConfirm(codigo)  auth.mfaDisable(senha, codigo)
   Erros têm e.code (veja L.actions.errMsg).
*/
window.Liga = window.Liga || {};
window.Liga.data = window.Liga.data || {};
(function (L) {
  "use strict";
  const C = L.crypto;

  const KEY = "liga.local.v1";
  const ACC = "liga.local.accounts";
  const SES = "liga.local.session";
  const PHOTO = "liga.local.foto.";
  const clone = (o) => JSON.parse(JSON.stringify(o ?? null));
  const fail = (code) => Object.assign(new Error(code), { code });

  let db = read(KEY);
  const listeners = new Set();
  let authCb = null;
  let pendingSecret = null;

  function read(k) {
    try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { throw fail("quota_exceeded"); }
  }

  // aplica a mudança numa cópia e só troca se conseguir salvar
  function commit(mutate) {
    const next = clone(db) || {};
    mutate(next);
    write(KEY, next);
    db = next;
    emit();
  }
  function emit() { for (const l of listeners) l(); }
  function split(path) {
    const i = path.indexOf("/");
    return [path.slice(0, i), path.slice(i + 1)];
  }

  window.addEventListener("storage", (e) => {
    if (e.key === KEY) { db = read(KEY); emit(); }
    if (e.key === SES && authCb) authCb(current());
  });

  /* ---------- contas ---------- */
  const accounts = () => read(ACC);
  const session = () => { try { return localStorage.getItem(SES); } catch (e) { return null; } };
  function setSession(uid) {
    try { uid ? localStorage.setItem(SES, uid) : localStorage.removeItem(SES); } catch (e) { /* ignora */ }
    if (uid) adoptLegacy(uid);
    if (authCb) authCb(current());
  }

  /* Dados de versões antigas do modo local (antes de existir conta) ficaram com o dono "local",
     que não é uma conta de verdade — então ninguém conseguia mexer em nada. Se o dono gravado
     não for uma conta existente, a conta que entrar assume a liga, e tudo que era do "local"
     (integrante dos projetos, tarefas, pontos, listRats) passa para ela. */
  function adoptLegacy(uid) {
    const owner = db.config && db.config.liga && db.config.liga.owner;
    if (owner && accounts()[owner]) return;
    commit((d) => {
      d.config = { liga: { owner: uid, createdAt: Date.now() } };
      if (!owner) return;
      const swap = (id) => (id === owner ? uid : id);
      for (const p of Object.values(d.projetos || {})) {
        if (Array.isArray(p.members)) p.members = [...new Set(p.members.map(swap))];
      }
      for (const s of Object.values(d.subprojetos || {})) {
        if (s.owner) s.owner = swap(s.owner);
        if (Array.isArray(s.helpers)) s.helpers = s.helpers.map(swap).filter((h) => h !== s.owner);
      }
      for (const t of Object.values(d.tarefas || {})) t.assignee = swap(t.assignee);
      if (d.players && d.players[owner] && !d.players[uid]) {
        d.players[uid] = d.players[owner];
        delete d.players[owner];
      }
    });
  }
  function me() {
    const uid = session();
    const a = uid && accounts()[uid];
    return a ? { uid, a } : null;
  }
  function current() {
    const m = me();
    if (!m) return null;
    return { id: m.uid, name: m.a.username, email: m.a.email || "", emailVerified: !!m.a.email, createdAt: m.a.createdAt, mfa: !!m.a.totp };
  }
  function findByLogin(login) {
    const all = accounts(), l = login.trim().toLowerCase();
    for (const uid in all) {
      const a = all[uid];
      if (a.username.toLowerCase() === l || (a.email && a.email.toLowerCase() === l)) return { uid, a };
    }
    return null;
  }
  function saveAccount(uid, a) {
    const all = accounts();
    all[uid] = a;
    write(ACC, all);
  }
  async function verify(m, password, code) {
    if (!(await C.checkPassword(password || "", m.a.salt, m.a.hash))) throw fail("bad_password");
    if (m.a.totp) {
      if (!code) throw fail("need_code");
      if (!(await C.verifyTotp(m.a.totp, code))) throw fail("bad_code");
    }
  }

  const auth = {
    verifiesEmail: false,
    current,

    async signUp({ username, email, password }) {
      const all = accounts();
      for (const uid in all) {
        if (all[uid].username.toLowerCase() === username.toLowerCase()) throw fail("username_taken");
        if (email && all[uid].email && all[uid].email.toLowerCase() === email.toLowerCase()) throw fail("email_taken");
      }
      const uid = "u" + local.newId();
      const { salt, hash } = await C.hashPassword(password);
      saveAccount(uid, { username, email: email || "", salt, hash, totp: null, createdAt: Date.now() });
      // a primeira conta criada neste navegador vira a dona da liga (feito em setSession/adoptLegacy)
      setSession(uid);
    },

    async signIn(login, password) {
      const m = findByLogin(login);
      if (!m || !(await C.checkPassword(password, m.a.salt, m.a.hash))) throw fail("bad_login");
      if (m.a.totp) {
        return {
          mfa: true,
          async resolve(code) {
            if (!(await C.verifyTotp(m.a.totp, code))) throw fail("bad_code");
            setSession(m.uid);
          },
        };
      }
      setSession(m.uid);
      return {};
    },

    async signOut() { setSession(null); },

    async changeUsername(username) {
      const m = me();
      if (!m) throw fail("denied");
      const other = findByLogin(username);
      if (other && other.uid !== m.uid) throw fail("username_taken");
      m.a.username = username;
      saveAccount(m.uid, m.a);
    },

    async changePassword(currentPw, next, code) {
      const m = me();
      await verify(m, currentPw, code);
      Object.assign(m.a, await C.hashPassword(next));
      saveAccount(m.uid, m.a);
    },

    async changeEmail(email, password, code) {
      const m = me();
      await verify(m, password, code);
      const other = findByLogin(email);
      if (other && other.uid !== m.uid) throw fail("email_taken");
      m.a.email = email;
      saveAccount(m.uid, m.a);
      return { pending: false };
    },

    async sendVerification() {},
    async reload() {},

    async mfaStart(password) {
      const m = me();
      await verify(m, password);
      pendingSecret = C.newTotpSecret();
      return { secret: pendingSecret, uri: C.totpUri(m.a.username, pendingSecret) };
    },
    async mfaConfirm(code) {
      const m = me();
      if (!pendingSecret || !(await C.verifyTotp(pendingSecret, code))) throw fail("bad_code");
      m.a.totp = pendingSecret;
      pendingSecret = null;
      saveAccount(m.uid, m.a);
    },
    async mfaDisable(password, code) {
      const m = me();
      await verify(m, password, code);
      m.a.totp = null;
      saveAccount(m.uid, m.a);
    },
  };

  const local = {
    mode: "local",
    auth,

    async start(onAuth) {
      authCb = onAuth;
      const uid = session();
      if (uid && accounts()[uid]) adoptLegacy(uid); // quem já estava logado também conserta
      setTimeout(() => onAuth(current()), 0);
    },

    watch(coll, cb) {
      const fire = () => cb(clone(db[coll] || {}));
      listeners.add(fire);
      setTimeout(fire, 0);
      return () => listeners.delete(fire);
    },
    watchWhere(coll, field, value, cb, onErr, op) {
      const fire = () => {
        const all = db[coll] || {}, out = {};
        const hit = (v) => (op === "array-contains" ? Array.isArray(v) && v.includes(value) : v === value);
        for (const id in all) if (all[id] && hit(all[id][field])) out[id] = clone(all[id]);
        cb(out);
      };
      listeners.add(fire);
      setTimeout(fire, 0);
      return () => listeners.delete(fire);
    },
    watchDoc(path, cb) {
      const [c, id] = split(path);
      const fire = () => cb(db[c] && db[c][id] ? clone(db[c][id]) : null);
      listeners.add(fire);
      setTimeout(fire, 0);
      return () => listeners.delete(fire);
    },

    async get(path) {
      const [c, id] = split(path);
      return db[c] && db[c][id] ? clone(db[c][id]) : null;
    },

    newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); },

    async set(path, data) {
      const [c, id] = split(path);
      commit((d) => { d[c] = d[c] || {}; d[c][id] = clone(data); });
    },
    async update(path, data) {
      const [c, id] = split(path);
      commit((d) => {
        if (!d[c] || !d[c][id]) throw fail("unknown");
        Object.assign(d[c][id], clone(data));
      });
    },
    async remove(path) {
      const [c, id] = split(path);
      commit((d) => { if (d[c]) delete d[c][id]; });
    },
    async removeMany(paths) {
      commit((d) => { for (const p of paths) { const [c, id] = split(p); if (d[c]) delete d[c][id]; } });
    },
    async claimOwner(uid) {
      if (db.config && db.config.liga) throw fail("denied");
      commit((d) => { d.config = { liga: { owner: uid, createdAt: Date.now() } }; });
    },

    photos: {
      async save(dataUrl) {
        const id = local.newId();
        try { localStorage.setItem(PHOTO + id, dataUrl); } catch (e) { throw fail("quota_exceeded"); }
        return id;
      },
      async load(id) {
        try { return localStorage.getItem(PHOTO + id); } catch (e) { return null; }
      },
      async remove(id) {
        try { localStorage.removeItem(PHOTO + id); } catch (e) { /* ignora */ }
      },
    },
  };

  L.data.local = local;
})(window.Liga);
