# Liga das Tarefas

Competição de tarefas entre amigos. Cada projeto tem integrantes e **listRats**, e cada listRat tem as tarefas de cada integrante. O placar é o total de pontos acumulado desde a criação de cada tarefa.

Site estático (HTML + CSS + JavaScript puro, sem build). Para usar é preciso entrar numa conta (usuário + e-mail + senha, com verificação em duas etapas opcional). Funciona de dois jeitos:

| Modo | Quando | Onde ficam contas e dados |
|---|---|---|
| **Local** | `js/config.js` com `firebase: null` (padrão) | Só no navegador que abriu o site. Dá para criar várias contas para testar. A primeira conta criada vira a dona da liga. |
| **Firebase** | `js/config.js` com a configuração do seu projeto Firebase | Online. É o modo para jogar com os amigos. |

## Estrutura

```
index.html              página única que carrega o resto
assets/icon.svg         ícone da aba
css/
  base.css              cores (escuro padrão / claro), tipografia, botões, campos
  layout.css            menu lateral recolhível, gaveta no celular, grades, tela de entrar
  components.css        placar, tarefas, listRats, fotos, configurações
  motion.css            animações (somem se o sistema pedir "reduzir movimento")
js/
  config.js             ÚNICO arquivo para editar (configuração do Firebase)
  util/                 dom.js, text.js, dates.js, crypto.js (senha e códigos do modo local)
  core/                 rules.js (dificuldades, regras de conta, validação), state.js, scoring.js, perms.js (quem pode o quê)
  data/
    local.js            contas e banco no localStorage (modo local)
    firebase.js         Firebase Authentication + Firestore
  actions.js            tudo que grava: marcar, criar/editar/apagar
  ui/                   components.js, forms.js, photos.js, shell.js (menu e tema), fx.js (animações)
  pages/                login, home, projects, project, sub (listRat), mine, rules, new-project, settings
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

1. Em https://console.firebase.google.com clique em **Criar projeto** (ex.: `liga-das-tarefas`).
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
7. Abra o site, crie sua conta, vá em **Configurações** e clique em **Assumir como dono**. Faça isso antes de mandar o link para alguém: o primeiro que assumir vira o dono, e isso não muda mais.

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
git commit -m "ListRats com dono e ajudantes, início com todas as tarefas e animações"
git push -u origin main
```

## Telas

- **Entrar / Criar conta**: usuário (ou e-mail) e senha; código do autenticador se a conta tiver duas etapas.
- **Início**: seus pontos (contando na tela), barra do dia, todas as suas tarefas de qualquer projeto (pendentes primeiro, depois as feitas) e o placar geral. Marcar uma tarefa mostra os pontos subindo; fechar o dia solta confete.
- **Minhas tarefas**: todas as suas tarefas, por listRat.
- **Projetos**: lista dos projetos — é por aqui que se entra num projeto. No menu, "Projetos" abre e mostra os projetos; o projeto aberto mostra as listRats dele.
- **Projeto**: listRats, integrantes e placar do projeto. O dono edita e apaga.
- **ListRat**: equipe (dono e ajudantes), nova tarefa e uma coluna por integrante.
- **Regras**: pontuação, foto de prova e tabela de dificuldades.
- **Configurações**: dados da conta, trocar usuário, senha e e-mail, verificação em duas etapas, tema (escuro é o padrão) e sair.

O menu lateral abre e fecha pelo botão no topo; no celular ele vira uma gaveta.

## Quem pode o quê

| Quem | Pode |
|---|---|
| Dono da liga | Criar, editar e apagar projetos e escolher integrantes. Mexer em tudo. |
| Integrante do projeto | Criar listRats no projeto (vira o dono delas) e marcar as próprias tarefas. |
| Dono da listRat | Renomear e apagar a listRat, escolher os ajudantes (entre os integrantes) e cuidar das tarefas dela. |
| Ajudante da listRat | Criar, editar e apagar as tarefas da listRat. |

ListRats antigas, criadas antes de existir dono, ficam com o dono da liga.

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

- Só quem está logado vê alguma coisa. O site só mostra um projeto para quem é integrante dele (no banco, qualquer conta logada consegue ler os dados da liga).
- As permissões da tabela "Quem pode o quê" são garantidas pelas regras do Firestore, não só pelo site.
- Cada jogador grava só o próprio documento (`players/<uid>`) e só apaga as próprias fotos.
- Pontos nunca são gravados: são recalculados das tarefas e marcações válidas.
- No modo local as senhas são guardadas com PBKDF2 (150 mil iterações), nunca em texto puro. Mesmo assim, o modo local serve para testar: qualquer pessoa com acesso ao navegador consegue mexer no localStorage.
- `usernames/<usuario>` guarda o e-mail para permitir entrar pelo usuário; ele pode ser lido por quem souber o nome exato, mas não pode ser listado.

## Dados (Firestore)

| Coleção | Campos |
|---|---|
| `usernames/<usuario em minúsculas>` | uid, email |
| `config/liga` | owner, createdAt |
| `projetos/<id>` | name, desc, members[], createdAt |
| `subprojetos/<id>` (listRats) | projectId, name, owner, helpers[], createdAt |
| `tarefas/<id>` | subId, projectId, title, assignee, kind (daily/weekly), type (normal/obrigatoria), diff (facil/media/dificil), startKey, createdAt |
| `players/<uid>` | nick (= usuário), done, proofs, updatedAt |
| `fotos/<id>` | uid, data (imagem em base64), createdAt |
