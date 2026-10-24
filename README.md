# listRats

Competição de tarefas entre amigos. Cada projeto tem integrantes e **listRats**, e cada listRat tem as tarefas de cada integrante. O placar é o total de pontos acumulado desde a criação de cada tarefa.

Site estático (HTML + CSS + JavaScript puro, sem build). Para usar é preciso entrar numa conta (usuário + senha; e-mail opcional, confirmado por link; verificação em duas etapas opcional). Funciona de dois jeitos:

| Modo | Quando | Onde ficam contas e dados |
|---|---|---|
| **Local** | `js/config.js` com `firebase: null` (padrão) | Só no navegador que abriu o site. Dá para criar várias contas para testar. |
| **Firebase** | `js/config.js` com a configuração do seu projeto Firebase | Online. É o modo para jogar com os amigos. |

## Estrutura

```
index.html              página única que carrega o resto
assets/icon.svg         logo do listRats (aba e menu)
css/
  base.css              cores (escuro padrão / claro), tipografia, botões, campos
  layout.css            menu lateral recolhível, gaveta no celular, grades, tela de entrar
  components.css        placar, tarefas, listRats, fotos, configurações
  motion.css            animações (somem se o sistema pedir "reduzir movimento")
js/
  config.js             ÚNICO arquivo para editar (configuração do Firebase)
  util/                 dom.js, text.js, dates.js, crypto.js (senha e códigos do modo local)
  core/                 rules.js (dificuldades, regras de conta, validação), state.js, scoring.js, perms.js (quem pode o quê), enroll.js (inscrições e desvio padrão)
  data/
    local.js            contas e banco no localStorage (modo local)
    firebase.js         Firebase Authentication + Firestore
  actions.js            tudo que grava: marcar, criar/editar/apagar
  social.js             amizades, convites para projetos e notificações
  ui/                   components.js, forms.js, photos.js, shell.js (menu e tema), fx.js (animações), enroll-panel.js (quadro das inscrições)
  pages/                login, home, projects, project, members, sub-form (nova/editar listRat), sub (listRat), charts, friends, inbox, mine, rules, new-project, settings
  main.js               inicialização: escolhe o banco, acompanha o login, desenha
firestore.rules         regras de segurança para colar no Firebase
```

## Rodar no seu computador

```bash
# entra na pasta do projeto
cd ~/Documentos/GitHub/Planilha
# sobe um servidor simples na porta 5173
python3 -m http.server 5173
# abra http://localhost:5173 no navegador (Ctrl+C no terminal para parar)
```

Abrir o `index.html` com dois cliques também funciona no modo local, mas pelo servidor é mais garantido (as senhas usam a criptografia do navegador, que exige `localhost` ou `https` em alguns navegadores).

## Configurar o Firebase (para jogar com os amigos)

1. Em https://console.firebase.google.com clique em **Criar projeto** (ex.: `listrats`).
2. **Authentication** → **Vamos começar** → **Método de login** → ative **E-mail/senha** → salve.
3. **Firestore Database** → **Criar banco de dados** → local `southamerica-east1` → **modo de produção**.
4. Firestore → aba **Regras**: cole o conteúdo de `firestore.rules` → **Publicar**.
5. **Configurações do projeto** (engrenagem) → **Seus apps** → ícone **Web** (`</>`) → registre → copie o `firebaseConfig`.
6. Cole em `js/config.js` no lugar de `firebase: null`:
   ```js
   window.LIGA_CONFIG = {
     firebase: {
       apiKey: "...",
       authDomain: "....firebaseapp.com",
       projectId: "...",
       storageBucket: "...",
       messagingSenderId: "...",
       appId: "..."
     },
   };
   ```
   Esses valores não são senha: podem ir para o GitHub. Quem protege os dados são as regras do passo 4.
7. Abra o site e crie sua conta. Qualquer pessoa cria projetos e vira o dono do projeto que criou; para chamar os amigos, use o link de convite na página Integrantes do projeto.

### Verificação em duas etapas no Firebase (opcional)

No modo local ela funciona sem configurar nada. No Firebase, o código por aplicativo autenticador (TOTP) só funciona depois de:

1. **Authentication** → **Configurações** → **Fazer upgrade** para o *Firebase Authentication with Identity Platform*. Isso pede o plano **Blaze** (precisa de cartão, mas até 50 mil usuários ativos por mês não cobra).
2. Ativar o TOTP no projeto (troque `SEU_PROJETO` pelo ID do projeto; precisa do `gcloud` logado na sua conta Google):
   ```bash
   # ativa a verificação em duas etapas por aplicativo autenticador no projeto
   curl -X PATCH "https://identitytoolkit.googleapis.com/admin/v2/projects/SEU_PROJETO/config?updateMask=mfa" \
     -H "Authorization: Bearer $(gcloud auth print-access-token)" \
     -H "X-Goog-User-Project: SEU_PROJETO" \
     -H "Content-Type: application/json" \
     -d '{"mfa":{"state":"ENABLED","providerConfigs":[{"state":"ENABLED","totpProviderConfig":{"adjacentIntervals":5}}]}}'
   ```
Sem isso, o resto do site funciona normalmente e só a ativação das duas etapas mostra o aviso "não está ativado no Firebase". O Firebase também exige que o e-mail esteja confirmado antes de ativar.

## Publicar no GitHub Pages

1. Envie os arquivos (comandos abaixo).
2. GitHub → **Settings** → **Pages** → *Deploy from a branch* → `main`, pasta `/ (root)` → **Save**.
3. O site fica em `https://arthurvb-ti.github.io/Planilha/`.
4. No Firebase: **Authentication** → **Configurações** → **Domínios autorizados** → adicione `arthurvb-ti.github.io`.

```bash
cd ~/Documentos/GitHub/Planilha
git add .
git commit -m "listRats: amigos, notificações, convites e e-mail opcional"
git push -u origin main
```

## Telas

- **Entrar / Criar conta**: usuário (ou e-mail) e senha; código do autenticador se a conta tiver duas etapas. O e-mail é opcional: se colocar, o site manda um link e o e-mail só passa a valer depois que o link for aberto (então só entra e-mail que existe). Dá para pôr ou trocar depois em Configurações.
- **Início**: seus pontos (contando na tela), barra do dia, todas as suas tarefas de qualquer projeto (pendentes primeiro, depois as feitas) e o placar dos amigos (você e seus amigos). Marcar uma tarefa mostra os pontos subindo; fechar o dia solta confete.
- **Minhas tarefas**: todas as suas tarefas, por listRat.
- **Projetos**: lista dos projetos — é por aqui que se entra num projeto. No menu, "Projetos" abre e mostra os projetos; o projeto aberto mostra as listRats dele.
- **Amigos**: procurar pelo nome de usuário, mandar pedido (a outra pessoa aceita), lista de amigos com pontos e pedidos enviados.
- **Notificações**: caixa de entrada do site. Convites para projetos (entrar ou recusar), pedidos de amizade, avisos dos projetos (alguém entrou, listRat começou, virou dono ou ajudante...) e avisos do site. Separado por categoria (Tudo, Convites, Amizades, Projetos, Site) e por dia, com "Só não lidas" e "Marcar tudo como lido".
- **Projeto**: cabeçalho com abas Visão geral, ListRats, Integrantes, Placar e, para o dono, Editar (nome e descrição) e Gerenciar (cargo ajudante do projeto, passar o projeto, apagar).
- **Integrantes** (botão "Adicionar e gerenciar" no projeto, ou "Integrantes" no menu): página só das pessoas do projeto. Ver a ficha de cada um (pontos, posição, tarefas, papéis), convidar procurando pelo nome de usuário (nada é listado antes de digitar; quem não existe não aparece; a pessoa recebe o convite nas Notificações e só entra se aceitar), editar o papel em cada listRat (nenhum, ajudante ou dono) e passar as tarefas para outra pessoa, e tirar do projeto (escolhendo se as tarefas ficam guardadas ou passam para alguém). Ao criar um projeto, o site já abre essa página.
- **Link de convite** (na página Integrantes, só o dono do projeto): cria um link que vale 1 hora, 1 dia ou 7 dias e já copia. Quem abre o link precisa estar logado (ou entrar/criar a conta) e vê a caixa "Você quer entrar no projeto {nome}?" antes de entrar. Links vencidos param de funcionar e somem da lista. Só funciona entre aparelhos diferentes no modo Firebase (no modo local as contas ficam num navegador só).
- **Nova listRat / Editar listRat** (botão "Nova listRat" no projeto, "Editar" na listRat): página com nome, quando começa, quando termina (ou "Sem data para acabar", com atalhos de 1 semana a 6 meses) e detalhes. As tarefas só valem dentro desse período: antes do início e depois do fim não ganham nem perdem pontos, e não aparecem no Início.
- **Inscrições da listRat**: toda listRat nova começa em inscrições. Cada integrante preenche as próprias tarefas e só participa quem cumprir as regras (definidas ao criar a listRat e depois pelo dono e ajudantes: mínimo de obrigatórias — padrão 3 —, mínimo de tarefas normais — padrão 1 —, máximo de tarefas normais — opcional — e o desvio padrão máximo — recomendado 35, sobe de 1 em 1). O quadro mostra quem está pronto, os pontos possíveis por semana de cada um (tarefas normais; diária vale os pontos × 7) e o desvio padrão desses pontos entre os prontos. O desvio não impede ninguém de entrar; só impede começar. Ao começar, os participantes ficam gravados na listRat (`participants`) e só eles pontuam; dá para incluir alguém depois, valendo a partir daquele dia. Também aparece na página de editar a listRat e no Início ("Inscrições abertas").
- **ListRat**: cabeçalho com abas Visão geral, Tarefas (nova tarefa e uma coluna por pessoa), Inscrições, Equipe e, para quem cuida dela, Editar e Gerenciar (ajudantes, inscrições, apagar). Uma pessoa não pode ter duas tarefas com o mesmo nome na mesma listRat.
- **Gráficos** (menu, ou botão "Gráficos" no projeto): escolhe o projeto, a listRat (ou todas) e o período (7, 30, 90 dias ou tudo) e o tipo: **Pontuação** (total acumulado de cada pessoa), **Calendário** (dias com tarefas feitas e obrigatórias perdidas), **Ações** (tarefas feitas por dia ou semana, empilhadas por pessoa) e **Por tarefa** (quanto de cada tarefa foi feito). Passe o mouse (ou toque) para ver os números; "ver como tabela" mostra os dados.
- **Regras**: pontuação, foto de prova e tabela de dificuldades.
- **Configurações**: dados da conta, trocar usuário, senha e e-mail, verificação em duas etapas, tema (escuro é o padrão) e sair.

O menu lateral abre e fecha pelo botão no topo; no celular ele vira uma gaveta.

## Quem pode o quê

| Quem | Pode |
|---|---|
| Qualquer pessoa com conta | Criar projetos (vira o dono do projeto). |
| Dono do projeto | Editar e apagar o projeto, convidar e tirar integrantes, criar links de convite, escolher ajudantes do projeto, passar o projeto para outro integrante e mexer em todas as listRats e tarefas dele. Não consegue colocar ninguém no projeto sem a pessoa aceitar. |
| Ajudante do projeto | Cargo criado; as permissões ainda vão ser definidas. |
| Integrante do projeto | Criar listRats no projeto (vira o dono delas) e marcar as próprias tarefas. |
| Dono da listRat | Renomear e apagar a listRat, escolher os ajudantes (entre os integrantes) e cuidar das tarefas dela. |
| Ajudante da listRat | Criar, editar e apagar as tarefas da listRat. |

ListRats antigas, criadas antes de existir dono, ficam com o dono do projeto.

## Pontuação

| Dificuldade | Tarefa normal ganha | Tarefa obrigatória perde |
|---|---|---|
| Fácil | +10 | −5 |
| Média | +25 | −10 |
| Difícil | +50 | −20 |

Tarefas antigas marcadas como "Lendária" passam a valer como Difícil.

- **Normal**: ganha os pontos a cada dia (ou semana) em que é feita.
- **Obrigatória**: não dá pontos e tira os pontos a cada dia (ou semana) encerrado sem ela.
- Diárias podem ser marcadas até 6 dias para trás; semanais, na semana atual e na anterior.
- Só contam tarefas de quem é integrante do projeto.

## Segurança

- Só quem está logado vê alguma coisa. O site só mostra um projeto para quem é integrante dele (no banco, qualquer conta logada consegue ler os dados do site).
- As permissões da tabela "Quem pode o quê" são garantidas pelas regras do Firestore, não só pelo site.
- Cada jogador grava só o próprio documento (`players/<uid>`) e só apaga as próprias fotos.
- Pontos nunca são gravados: são recalculados das tarefas e marcações válidas.
- No modo local as senhas são guardadas com PBKDF2 (150 mil iterações), nunca em texto puro. Mesmo assim, o modo local serve para testar: qualquer pessoa com acesso ao navegador consegue mexer no localStorage.
- Ninguém entra num projeto sem aceitar um convite ou abrir um link de convite; as regras proíbem o dono de acrescentar integrantes.
- Conta sem e-mail usa um endereço interno (`...@sem-email.listrats.example.com`) que nunca recebe nada e não aparece no site.
- `usernames/<usuario>` guarda o e-mail (e o e-mail pendente, enquanto o link não é aberto) para permitir entrar pelo usuário; ele pode ser lido por quem souber o nome exato, mas não pode ser listado.

## Dados (Firestore)

| Coleção | Campos |
|---|---|
| `usernames/<usuario em minúsculas>` | uid, email, pending (e-mail esperando confirmação) |
| `config/liga` | owner (antigo "dono da liga"; não é mais usado) |
| `projetos/<id>` | name, desc, members[], owner (dono do projeto), helpers[] (ajudantes do projeto), createdAt, joinedVia (último convite usado ou "pedido") |
| `pedidos/<projeto>_<uid>` | projectId, projectName, from, to, createdAt (convite para entrar no projeto) |
| `amizades/<uid menor>_<uid maior>` | users[], from, to, status (pending/accepted), createdAt, acceptedAt |
| `notificacoes/<id>` | to, from, cat (projetos/amizades/site), kind, text, projectId, sid, createdAt, read |
| `convites/<código>` | projectId, expiresAt, createdBy, createdAt |
| `subprojetos/<id>` (listRats) | projectId, name, desc, start, end (AAAA-MM-DD ou vazio), status (inscricoes/ativa), req {minObr, minTasks, maxTasks, maxDesvio}, participants[], startedAt, joined {uid: dia}, owner, helpers[], createdAt |
| `tarefas/<id>` | subId, projectId, title, assignee, kind (daily/weekly), type (normal/obrigatoria), diff (facil/media/dificil), startKey, createdAt |
| `players/<uid>` | nick (= usuário), done, proofs, updatedAt |
| `fotos/<id>` | uid, data (imagem em base64), createdAt |
