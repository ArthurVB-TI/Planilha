# Liga das Tarefas

Competição de tarefas entre amigos, organizada em projetos. Cada projeto tem integrantes e subprojetos, e cada subprojeto tem as tarefas de cada integrante. O placar é o total de pontos acumulado desde a criação de cada tarefa.

## Telas

- **Início**: tarefas pendentes de hoje, projetos e placar geral.
- **Projetos**: todos os projetos. O dono cria, edita (nome, descrição e integrantes) e apaga.
- **Projeto**: subprojetos, integrantes e placar do projeto. Subprojetos podem ser criados, renomeados e apagados.
- **Subprojeto**: formulário de nova tarefa e uma coluna por integrante. Cada tarefa pode ser editada ou apagada pelo dono.
- **Minhas tarefas**: todas as tarefas do jogador, agrupadas por subprojeto.
- **Regras**: pontuação, foto de prova e tabela de dificuldades.

Um projeto pode ser criado só com o dono e receber integrantes depois.

## Pontuação

| Dificuldade | Tarefa normal ganha | Tarefa obrigatória perde |
|---|---|---|
| Fácil | +10 | −5 |
| Média | +25 | −10 |
| Difícil | +50 | −20 |
| Lendária | +100 | −40 |

- **Normal**: ganha os pontos a cada dia (ou semana) em que é feita.
- **Obrigatória**: não dá pontos e tira os pontos a cada dia (ou semana) encerrado sem ela.
- Diárias podem ser marcadas até 6 dias para trás; semanais, na semana atual e na anterior.
- Só contam tarefas de quem é integrante do projeto.

## Foto de prova

Cada tarefa tem um botão para provar com foto (no celular abre a câmera). A foto é reduzida para no máximo 1600 px, enviada ao armazenamento do artifact e já marca a tarefa como feita. Todos veem as miniaturas e quantas marcações têm foto. A foto é opcional.

## Segurança

- Só o dono cria, edita e apaga projetos, subprojetos e tarefas.
- Cada jogador grava apenas o próprio documento (`players/<id>`).
- Os pontos nunca são gravados: são recalculados a partir das tarefas e das marcações válidas. Datas fora do intervalo ou tarefas de outra pessoa são ignoradas.
- Textos de outras pessoas são exibidos com `textContent`.

## Dados

| Coleção | Campos |
|---|---|
| `projetos/<id>` | name, desc, members[], createdAt |
| `subprojetos/<id>` | projectId, name, createdAt |
| `tarefas/<id>` | subId, projectId, title, assignee, kind (daily/weekly), type (normal/obrigatoria), diff (facil/media/dificil/lendaria), startKey, createdAt |
| `players/<id>` | nick, done {tarefa: [datas]}, proofs {tarefa: {data: idDaFoto}}, updatedAt |

## Onde roda

A página usa o banco de dados (`claude.use("db")`), o armazenamento de arquivos (`claude.use("assets")`) e a identidade do usuário (`claude.use("user")`) dos artifacts do Claude. Por isso, ela só funciona aberta pelo link do artifact. Aberta direto no navegador ou no GitHub Pages, ela mostra o aviso "Abra esta página pelo link do Claude".

Os amigos entram pelo menu Compartilhar do artifact, convidados por e-mail como Editor.
