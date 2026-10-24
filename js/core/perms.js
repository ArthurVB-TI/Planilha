/* perms.js — quem pode fazer o quê.
   - Qualquer pessoa com conta cria projetos e vira o DONO DO PROJETO.
   - Dono do projeto: edita e apaga o projeto, adiciona/tira integrantes, cria links de convite,
     passa o projeto para outro integrante e pode mexer em todas as listRats do projeto.
   - Integrante de um projeto: cria listRats nesse projeto (vira o dono da listRat).
   - Dono da listRat: edita, apaga e escolhe ajudantes.
   - Dono e ajudantes da listRat: mudam as regras de inscrição, começam a listRat e aceitam/recusam
     justificativas e provas de contestação.
   - Tarefas: cada pessoa só mexe nas PRÓPRIAS. Nas inscrições cria, edita e apaga;
     depois que a listRat começa só dá para renomear (para ninguém mudar as regras do jogo no meio).
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
  // em inscrições, cada integrante do projeto cria, edita e apaga as próprias tarefas
  const canFillOwn = (s) => !!s && s.status === "inscricoes" && isMember(projOf(s));
  const ownTask = (t) => !!t && t.assignee === S.myId && isMember(projOf(S.subs[t.subId]));
  // editar: "full" (nome, tipo, frequência, dificuldade) nas inscrições, "name" depois que começou
  const editLevel = (t) => (!ownTask(t) ? "" : S.subs[t.subId].status === "inscricoes" ? "full" : "name");
  const canEditTask = (t) => !!editLevel(t);
  const canDeleteTask = (t) => editLevel(t) === "full";
  // regras de inscrição, começar a listRat, incluir participante e julgar: dono e ajudantes
  const canRunSub = (s) => canManageSub(s) || isHelper(s);
  function roleIn(s, uid) {
    if (!s) return "";
    if (subOwner(s) === uid) return "dono";
    if (s.helpers.includes(uid)) return "ajudante";
    return "";
  }

  L.perms = { projOwner, isProjectOwner, isProjectHelper, projRole, isMember, canSeeProject, canCreateSub, subOwner, canManageSub, isHelper, canFillOwn, ownTask, editLevel, canEditTask, canDeleteTask, canRunSub, roleIn };
})(window.Liga);
