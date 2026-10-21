/* perms.js — quem pode fazer o quê.
   - Dono da liga: tudo.
   - Integrante de um projeto: cria listRats nesse projeto (vira o dono da listRat).
   - Dono da listRat: renomeia, apaga, escolhe ajudantes e cuida das tarefas dela.
   - Ajudante da listRat: cria, edita e apaga tarefas dela, muda as regras de inscrição e começa a listRat.
   - Em inscrições, cada integrante cria, edita e apaga as próprias tarefas.
   As mesmas regras estão no firestore.rules (é lá que elas valem de verdade). */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const S = L.S;

  const isMember = (p) => !!p && p.members.includes(S.myId);
  const canSeeProject = (p) => S.isOwner || isMember(p);
  const canCreateSub = (p) => S.isOwner || isMember(p);
  // listRats antigas (sem dono gravado) pertencem ao dono da liga
  const subOwner = (s) => (s && s.owner) || S.ownerId;
  const canManageSub = (s) => !!s && (S.isOwner || s.owner === S.myId);
  const isHelper = (s) => !!s && s.helpers.includes(S.myId);
  const canEditTasks = (s) => canManageSub(s) || isHelper(s);
  // em inscrições, cada integrante do projeto cria, edita e apaga as próprias tarefas
  const canFillOwn = (s) => !!s && s.status === "inscricoes" && isMember(S.projects[s.projectId]);
  const canEditTask = (t) => { const s = t && S.subs[t.subId]; return canEditTasks(s) || (canFillOwn(s) && t.assignee === S.myId); };
  // regras de inscrição, começar a listRat e incluir participante: dono e ajudantes
  const canRunSub = (s) => canEditTasks(s);
  function roleIn(s, uid) {
    if (!s) return "";
    if (subOwner(s) === uid) return "dono";
    if (s.helpers.includes(uid)) return "ajudante";
    return "";
  }

  L.perms = { isMember, canSeeProject, canCreateSub, subOwner, canManageSub, isHelper, canEditTasks, canFillOwn, canEditTask, canRunSub, roleIn };
})(window.Liga);
