/* demo.js — dados de exemplo do MODO DE TESTE (abra o site com ?teste no fim do endereço).
   Tudo fica só neste navegador, separado do resto. Cria 4 contas (voce, ana, bruno, carla; senha teste1234),
   um projeto e quatro listRats:
     - "Semana encerrada": terminou ontem, então HOJE é o dia de contestação;
     - "Semana retrasada": já passou da contestação, mostra o resultado final (ouro, prata, bronze);
     - "Semana atual": em andamento, para marcar, mandar foto, comentar e justificar;
     - "Inscrições abertas": para criar as próprias tarefas.
   Também já vem com justificativas esperando, contestações e amizades. */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const { todayKey, addDays, weekOf } = L.dates;

  const PASS = "teste1234";
  const NAMES = ["voce", "ana", "bruno", "carla"];
  const B = () => L.data.local;

  // número "aleatório" fixo a partir de um texto (os dados ficam iguais toda vez)
  function rnd(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return (h % 1000) / 1000;
  }

  // foto de exemplo desenhada na hora
  function fakePhoto(label, color) {
    const c = document.createElement("canvas");
    c.width = 480; c.height = 360;
    const g = c.getContext("2d");
    g.fillStyle = color; g.fillRect(0, 0, 480, 360);
    g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, 250, 480, 110);
    g.fillStyle = "#fff"; g.font = "600 30px sans-serif"; g.fillText(label, 24, 315);
    g.font = "500 18px sans-serif"; g.fillText("foto de teste", 24, 280);
    return c.toDataURL("image/jpeg", 0.7);
  }

  async function seed() {
    const b = B();
    const T = todayKey();
    const ids = {};
    for (const n of NAMES) {
      await b.auth.signUp({ username: n, email: "", password: PASS });
      ids[n] = b.auth.current().id;
    }
    const all = NAMES.map((n) => ids[n]);
    const now = Date.now();
    const docs = [];
    const put = (path, data) => docs.push([path, data]);

    // fotos
    const photo = {};
    for (const [k, label, color] of [["cama", "cama arrumada", "#5b7cfa"], ["treino", "treino feito", "#2f9e6b"], ["livro", "capítulo lido", "#c9772b"], ["prova", "prova do treino", "#8e44ad"], ["just", "atestado", "#b03a48"]]) {
      photo[k] = await b.photos.save(fakePhoto(label, color));
    }

    // projeto e amizades
    const pid = "pteste";
    put("projetos/" + pid, { name: "Projeto de teste", desc: "Dados de exemplo para testar contestação, justificativas e resultado.", members: all, owner: ids.voce, helpers: [ids.ana], createdAt: now - 20 * 864e5 });
    const pair = (a, c) => (a < c ? a + "_" + c : c + "_" + a);
    const fr = (a, c, status) => put("amizades/" + pair(ids[a], ids[c]), { users: [ids[a], ids[c]].sort(), from: ids[a], to: ids[c], status, createdAt: now - 5 * 864e5, acceptedAt: status === "accepted" ? now - 4 * 864e5 : 0 });
    fr("ana", "voce", "accepted");
    fr("voce", "bruno", "accepted");
    fr("carla", "voce", "pending");

    // listRats
    const subs = {
      A: { id: "sencerrada", name: "Semana encerrada", start: addDays(T, -7), end: addDays(T, -1), owner: ids.voce, helpers: [ids.ana], desc: "Terminou ontem: hoje é o dia de contestação. Cada um pode duvidar de até 3 tarefas dos outros." },
      B: { id: "sretrasada", name: "Semana retrasada", start: addDays(T, -15), end: addDays(T, -9), owner: ids.ana, helpers: [], desc: "Já passou a contestação: veja o resultado final." },
      C: { id: "satual", name: "Semana atual", start: addDays(T, -3), end: addDays(T, 3), owner: ids.voce, helpers: [ids.bruno], desc: "Em andamento: marque, mande foto, comente ou justifique." },
    };
    for (const s of Object.values(subs)) {
      const joined = {};
      for (const id of all) joined[id] = s.start;
      put("subprojetos/" + s.id, {
        projectId: pid, name: s.name, desc: s.desc, start: s.start, end: s.end, status: "ativa",
        req: L.rules.normReq({}), participants: all, startedAt: s.start, joined, owner: s.owner, helpers: s.helpers, createdAt: now - 20 * 864e5,
      });
    }
    put("subprojetos/sinscricoes", {
      projectId: pid, name: "Inscrições abertas", desc: "Crie as suas tarefas aqui para participar.", start: addDays(T, 1), end: addDays(T, 7),
      status: "inscricoes", req: L.rules.normReq({}), participants: [], startedAt: "", joined: {}, owner: ids.bruno, helpers: [], createdAt: now - 864e5,
    });

    // tarefas e marcações
    const TASKS = [
      ["cama", "Arrumar a cama", "obrigatoria", "daily", "facil"],
      ["estudo", "Estudar 1 hora", "obrigatoria", "daily", "media"],
      ["treino", "Treinar", "normal", "daily", "dificil"],
      ["livro", "Ler um capítulo", "normal", "weekly", "media"],
    ];
    const RATE = { voce: 0.85, ana: 0.95, bruno: 0.6, carla: 0.45 };
    const players = {};
    for (const n of NAMES) players[ids[n]] = { nick: n, done: {}, proofs: {}, notes: {}, updatedAt: now };
    const tid = (sk, n, key) => "t" + sk + "_" + n + "_" + key;

    for (const [sk, s] of Object.entries(subs)) {
      const last = s.end < T ? s.end : addDays(T, -1);
      for (const n of NAMES) {
        const uid = ids[n];
        for (const [key, title, type, kind, diff] of TASKS) {
          const id = tid(sk, n, key);
          put("tarefas/" + id, { subId: s.id, projectId: pid, title, assignee: uid, kind, type, diff, startKey: s.start, createdAt: now - 20 * 864e5 });
          const marks = [];
          if (kind === "daily") {
            for (let k = s.start; k <= last; k = addDays(k, 1)) if (rnd(id + k) < RATE[n]) marks.push(k);
          } else {
            for (let k = weekOf(s.start); k <= weekOf(last); k = addDays(k, 7)) if (rnd(id + k) < RATE[n] + 0.1) marks.push(k);
          }
          if (key === "treino" && !marks.length) marks.push(last);
          if (marks.length) players[uid].done[id] = marks;
        }
      }
    }
    // fotos e comentários de exemplo
    const addProof = (n, sk, key, day, ph, note) => {
      const uid = ids[n], id = tid(sk, n, key);
      const d = players[uid].done[id] = players[uid].done[id] || [];
      if (!d.includes(day)) d.push(day);
      if (ph) (players[uid].proofs[id] = players[uid].proofs[id] || {})[day] = photo[ph];
      if (note) (players[uid].notes[id] = players[uid].notes[id] || {})[day] = note;
    };
    addProof("voce", "A", "cama", addDays(T, -2), "cama", "Arrumei antes da aula.");
    addProof("ana", "A", "treino", addDays(T, -3), "treino", "Treino de perna.");
    addProof("ana", "A", "livro", weekOf(addDays(T, -1)), "livro", "");
    addProof("voce", "C", "treino", addDays(T, -1), "treino", "Corri 5 km.");
    for (const [uid, doc] of Object.entries(players)) put("players/" + uid, doc);

    // justificativas
    const just = (n, sk, key, day, comment, status, by, ph) => {
      const id = tid(sk, n, key);
      put("justificativas/" + id + "_" + day, {
        taskId: id, subId: subs[sk].id, projectId: pid, uid: ids[n], key: day, comment, photo: ph ? photo[ph] : "",
        status, decidedBy: by ? ids[by] : "", createdAt: now - 864e5, decidedAt: by ? now - 3600e3 : 0,
      });
      // a justificativa só existe em dia não marcado
      const d = players[ids[n]].done[id];
      if (d) players[ids[n]].done[id] = d.filter((x) => x !== day);
    };
    just("carla", "A", "cama", addDays(T, -3), "Dormi fora de casa, na casa da minha avó.", "pendente");
    just("bruno", "C", "estudo", addDays(T, -1), "Passei mal e fui ao médico.", "pendente", null, "just");
    just("ana", "C", "cama", addDays(T, -2), "Viajei cedo para o campeonato.", "aceita", "voce");

    // contestações
    const contest = (sk, by, accused, key, status, proof) => {
      const id = tid(sk, accused, key);
      put("contestacoes/" + id, {
        taskId: id, subId: subs[sk].id, projectId: pid, by: ids[by], accused: ids[accused], status,
        proofPhoto: proof ? photo[proof] : "", proofComment: proof ? "Foto do treino daquele dia." : "", proofAt: proof ? now - 1800e3 : 0,
        decidedBy: status === "aceita" ? ids.ana : "", createdAt: now - 3600e3,
      });
    };
    contest("A", "bruno", "voce", "treino", "aberta");            // você precisa mandar a prova hoje
    contest("A", "carla", "ana", "treino", "provada", "prova");   // você (dono) pode aceitar ou recusar
    contest("B", "voce", "bruno", "treino", "aberta");            // passou o dia sem prova: perdeu os pontos
    contest("B", "ana", "carla", "livro", "aceita", "prova");

    // notificações para você
    const notif = (from, text, sid, kind) => put("notificacoes/n" + Math.random().toString(36).slice(2, 10), {
      to: ids.voce, from: ids[from], cat: "projetos", kind, text, projectId: pid, sid, createdAt: now - 1200e3, read: false,
    });
    notif("bruno", "bruno contestou sua tarefa \"Treinar\" em Semana encerrada. Mande uma prova até o fim do dia ou ela perde os pontos.", subs.A.id, "contest");
    notif("carla", "carla justificou \"Arrumar a cama\" em Semana encerrada. Aceite ou recuse na tarefa.", subs.A.id, "justify");

    // inscrições: tarefas da ana e do bruno (as suas você cria)
    for (const n of ["ana", "bruno"]) {
      for (const [key, title, type, kind, diff] of TASKS) {
        put("tarefas/" + tid("D", n, key), { subId: "sinscricoes", projectId: pid, title, assignee: ids[n], kind, type, diff, startKey: T, createdAt: now - 3600e3 });
      }
    }

    put("config/teste", { createdAt: now, day: T });
    await b.setMany(docs);
    await b.auth.signIn("voce", PASS);
    const view = { page: "sub", pid, sid: subs.A.id, tab: "resultado" };
    L.text.store.set("liga.view", view);
    L.S.view = view;
  }

  // cria os dados se ainda não existirem (e entra como "voce")
  async function ensure() {
    const b = B();
    if (await b.get("config/teste")) return;
    b.wipe();
    await seed();
  }
  async function reset() {
    B().wipe();
    L.text.store.set("liga.view", { page: "home" });
  }

  L.demo = { ensure, reset, PASS };
})(window.Liga);
