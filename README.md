# Liga das Tarefas

Competição semanal de tarefas diárias e semanais. Cada tarefa vale pontos (uma diária conta até 7 vezes, uma semanal conta 1 vez) e o placar mostra quem fez mais pontos na semana. O placar zera toda segunda-feira.

## Como funciona

- O dono da liga cria e apaga as tarefas e define quantos pontos cada uma vale.
- Cada jogador marca só as próprias tarefas, dia a dia.
- Os pontos são recalculados a partir das tarefas e das marcações válidas. Valores forjados (peso alterado, dias futuros, tarefas inexistentes) são ignorados.

## Onde roda

A página usa o banco de dados compartilhado dos artifacts do Claude (`window.claude.use("db")`). Por isso, ela só funciona aberta pelo link do artifact no Claude. Aberta direto no navegador ou no GitHub Pages, ela mostra o aviso "Abra esta página pelo link do Claude".
