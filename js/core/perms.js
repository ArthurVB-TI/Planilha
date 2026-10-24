/* perms.js — quem pode fazer o quê.
   - Qualquer pessoa com conta cria projetos e vira o DONO DO PROJETO.
   - Dono do projeto: edita e apaga o projeto, adiciona/tira integrantes, cria links de convite,
     passa o projeto para outro integrante e pode mexer em todas as listRats do projeto.
   - Integrante de um projeto: cria listRats nesse projeto (vira o dono da listRat).
   - Dono da listRat: edita, apaga, escolhe ajudantes e cuida das tarefas dela.
   - Ajudante da listRat: cria, edita e apaga tarefas dela, muda as regras de inscrição e começa a listRat.
   - Em inscrições, cada integrante cria, edita e apaga as próprias tarefas.
   As mesmas regras estão no firestore.rules (é lá que elas valem de verdade). */
window.Liga = window.Liga || {};
(function (L) {
  "use strict";
  const S = L.S;

  // dono do projeto (projetos antigos sem dono gravado: o antigo "dono da liga" ou o primeiro integrante)
  const projOwner = (p) => (p && (p.owner || S.ownerId || p.members[0])) || "";
  const isProjectOwner = (p) => !!p && !!S.myId && projOwner(p) === S.myId;
  const isMember = (p) => !!p && p.members.includes(S.myId);
  // cargo "ajudante do projeto" — as permissões dele ainda vão ser definidas
  const isProjectHelper = (p) => !!p && p.helpers.includes(S.myId);
  const projRole = (p, uid) => (!p ? "" : projOwner(p) === uid ? "dono" : p.helpers.includes(uid) ? "ajudante" : "");
  const canSeeProject = (p) => isMember(p) || isProjectOwner(p);
  const canCreateSub = (p) => isMember(p) || isProjectOwner(p);
  const projOf = (s) => s && S.projects[s.projectId];
  // listRats antigas (sem dono gravado) pertencem ao dono do projeto
  const subOwner = (s) => (s && s.owner) || projOwner(projOf(s));
  const canManageSub = (s) => !!s && (s.owner === S.myId || isProjectOwner(projOf(s)));
  const isHelper = (s) => !!s && s.helpers.includes(S.myId);
  const canEditTasks = (s) => canManageSub(s) || isHelper(s);
  // em inscrições, cada integrante do projeto cria, edita e apaga as próprias tarefas
  const canFillOwn = (s) => !!s && s.status === "inscricoes" && isMember(projOf(s));
  const canEditTask = (t) => { const s = t && S.subs[t.subId]; return canEditTasks(s) || (canFillOwn(s) && t.assignee === S.myId); };
  // regras de inscrição, começar a listRat e incluir participante: dono e ajudantes
  const canRunSub = (s) => canEditTasks(s);
  function roleIn(s, uid) {
    if (!s) return "";
    if (subOwner(s) === uid) return "dono";
    if (s.helpers.includes(uid)) return "ajudante";
    return "";
  }

  L.perms = { projOwner, isProjectOwner, isProjectHelper, projRole, isMember, canSeeProject, canCreateSub, subOwner, canManageSub, isHelper, canEditTasks, canFillOwn, canEditTask, canRunSub, roleIn };
})(window.Liga);
