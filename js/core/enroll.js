/* enroll.js — inscrições de uma listRat.
   Quando a listRat é criada ela fica "em inscrições": cada integrante preenche as próprias tarefas.
   Fica pronto quem tem o mínimo de obrigatórias e de min a max tarefas normais (regras do dono/ajudantes).
   O desvio padrão dos pontos dos prontos não impede ninguém de entrar — só impede COMEÇAR a listRat.
   Pontos de cada pessoa = pontos possíveis por semana das tarefas normais
   (diária vale os pontos × 7, semanal vale os pontos × 1). Obrigatórias não entram no desvio. */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const S = L.S;
  const { DIFF } = L.rules;
  const { plural } = L.text;

  const weekly = (t) => (t.type === "normal" ? DIFF[t.diff].pts * (t.kind === "daily" ? 7 : 1) : 0);

  // situação de uma pessoa na listRat
  function personStatus(s, uid) {
    const req = s.req;
    const mine = Object.values(S.tasks).filter((t) => t.subId === s.id && t.assignee === uid);
    const obr = mine.filter((t) => t.type === "obrigatoria").length;
    const normal = mine.filter((t) => t.type === "normal").length;
    const pts = mine.reduce((a, t) => a + weekly(t), 0);
    const missing = [];
    if (obr < req.minObr) missing.push(plural(req.minObr - obr, "obrigatória", "obrigatórias"));
    if (normal < req.minTasks) missing.push(plural(req.minTasks - normal, "tarefa normal", "tarefas normais"));
    const over = req.maxTasks && normal > req.maxTasks ? normal - req.maxTasks : 0;
    const ready = !missing.length && !over;
    let text = ready ? "Pronto" : "";
    if (missing.length) text = "Falta " + missing.join(" e ");
    if (over) text = (text ? text + "; " : "") + "tirar " + plural(over, "tarefa normal", "tarefas normais");
    return { uid, obr, normal, pts, ready, text, count: mine.length };
  }

  // desvio padrão (populacional) de uma lista de números
  function stdev(nums) {
    if (nums.length < 2) return 0;
    const m = nums.reduce((a, b) => a + b, 0) / nums.length;
    return Math.sqrt(nums.reduce((a, b) => a + (b - m) * (b - m), 0) / nums.length);
  }

  // resumo das inscrições: quem está pronto, desvio e se dá para começar
  function summary(s) {
    const p = S.projects[s.projectId];
    const people = p ? p.members.map((id) => personStatus(s, id)) : [];
    const ready = people.filter((x) => x.ready);
    const pts = ready.map((x) => x.pts);
    const desvio = stdev(pts);
    const mean = pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : 0;
    const desvioOk = desvio <= s.req.maxDesvio + 1e-9;
    let block = "";
    if (!ready.length) block = "Ninguém completou as tarefas ainda.";
    else if (!desvioOk) block = "O desvio padrão dos pontos (" + fmt(desvio) + ") passou do máximo (" + fmt(s.req.maxDesvio) + "). Ajustem as tarefas para os pontos ficarem mais parecidos.";
    return { people, ready: ready.map((x) => x.uid), desvio, mean, desvioOk, canStart: !block, block };
  }

  const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

  L.enroll = { weekly, personStatus, stdev, summary, fmt };
})(window.Liga);
