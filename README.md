# ✝ Ordo

Organizador pessoal que reúne num só lugar a **vida pessoal** (agenda, tarefas,
avisos, lembretes), a **igreja** (escala de cerimoniário, eventos, horários
fixos, orações, materiais, leituras) e os **estudos** (simulados com correção
automática, caderno de erros, flashcards, Pomodoro, metas).

Stack: **HTML + CSS + JavaScript** sem build, **Python (Flask)** e **MySQL local**.

- Especificação funcional e de design: [ordo-planejamento.md](ordo-planejamento.md)
- Plano de desenvolvimento em fases: `~/.claude/plans/utilize-o-planejamento-que-validated-crayon.md`

---

## Como rodar

Pré-requisito: **MySQL rodando** localmente, com um usuário que tenha permissão
de `CREATE` (o `root` local já tem).

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# copie .env.example para .env e preencha com a sua senha do MySQL
python app.py
```

Depois abra **http://127.0.0.1:5000**.

Saída esperada na primeira execução:

```
✔ Banco 'ordo' pronto.
✔ Migrações aplicadas.
✔ Categorias padrão criadas.
✔ Disciplinas padrão criadas.
✔ 30 datas litúrgicas fixas cadastradas.
✔ 7 orações iniciais cadastradas.
✔ Usuário inicial criado: seu@email.com
 * Running on http://127.0.0.1:5000
```

Rodar de novo não duplica nada: cada etapa do seed só insere se a tabela estiver
vazia. Com `debug=True` o Flask reinicia o processo uma vez ao subir, então as
mensagens aparecem duas vezes no terminal — é normal.

### Testes

```powershell
cd backend
.\venv\Scripts\activate
pytest
```

197 testes cobrindo a lógica que não é óbvia: cálculo litúrgico (2026–2030),
expansão de recorrência, materialização de lembretes, correção de simulados e
revisão espaçada.

---

## O que existe

| Módulo | O que faz |
|---|---|
| **Dashboard** | Card da próxima escala com contagem regressiva, agenda de hoje e da semana, tarefas, lembretes, avisos fixados, o que vem na paróquia, resumo de estudos e a oração do momento — tudo num único request |
| **Agenda** | FullCalendar com compromissos, escalas e eventos juntos; recorrência diária, semanal e mensal; arrastar para remarcar; cancelar ou mover **uma** ocorrência sem tocar na série |
| **Tarefas** | Kanban com arrastar e tabela com ordenação, subtarefas, tags, prioridade e prazo |
| **Avisos** | Post-its com cor, prioridade, fixação e data de expiração |
| **Igreja** | Escalas (com cadastro em lote e "preencher os domingos do mês"), eventos, grade de horários fixos, orações com modo Rezar em tela cheia, novenas com contador, materiais com leitor de PDF embutido, leituras com notas e citações, anotações em Markdown |
| **Estudos** | Simulados com lançamento em grade e correção automática, caderno de erros, flashcards com revisão espaçada, Pomodoro que registra as horas, metas com progresso, anotações |
| **Busca global** | Ctrl+K em dez tipos de registro, ignorando acento e caixa |
| **Configurações** | Perfil e senha, categorias, disciplinas, datas litúrgicas fixas, tema e backup |

---

## Estrutura

```
backend/
├── app.py            ← o arquivo que você executa
├── config.py         ← .env + serialização ISO de datas
├── database.py       ← cria o banco no MySQL se não existir
├── models.py         ← todas as tabelas
├── constants.py      ← listas fixas, também servidas em /api/constantes
├── seed.py           ← dados iniciais, idempotentes
├── migrations/       ← Flask-Migrate; é a fonte da verdade do schema
├── routes/           ← um blueprint por módulo
├── services/         ← lógica de domínio (litúrgico, recorrência,
│                       lembretes, correção, SRS, dashboard, backup)
├── utils/            ← respostas e validação da API
├── tests/
└── uploads/          ← criada em runtime, fora de frontend/, nunca versionada

frontend/
├── index.html        ← dashboard
├── login.html
├── pages/            ← uma página por tela
├── css/ordo.css      ← importa variables, base, components e layout
└── js/
    ├── core/         ← api, layout, ui, fmt, tema, busca, lembretes,
    │                   md (Markdown sanitizado), graficos
    └── pages/        ← um arquivo por página
```

Só `js/core/layout.js` desenha a sidebar, a topbar e a faixa litúrgica. Nenhuma
página repete a casca: cada uma chama `montar()` e recebe o elemento onde
renderizar.

---

## Decisões que valem saber

**Schema por migrações, nunca `create_all()`.** `create_all()` cria tabelas
novas mas não altera as que já existem. Ao mexer em `models.py`:

```powershell
flask db migrate -m "o que mudou"
flask db upgrade
```

`app.py` roda `upgrade()` sozinho na subida, então basta gerar a migração.

**Datas sempre em ISO e no horário local.** O provider padrão do Flask serializa
`datetime` em RFC 822 (`"Sun, 27 Sep 2026 10:00:00 GMT"`), que o FullCalendar não
aceita e que o JavaScript lê como UTC, deslocando todos os horários em 3 h. O
`ISOJSONProvider` de `config.py` corrige isso. Todo o sistema usa `datetime.now()`
— nunca `utcnow()` — e no frontend `fmt.hojeISO()` e `fmt.mesAtualISO()` existem
justamente porque `toISOString()` devolve UTC e erraria o dia à noite.

**Recorrência com exceções.** `services/recorrencia.py` expande a série em
ocorrências; a tabela `compromisso_excecoes` guarda os dias cancelados ou
remarcados. É o que permite dizer "a reunião dessa quinta não haverá" sem apagar
tudo. Um compromisso no dia 31 simplesmente não acontece em fevereiro, em vez de
escorregar para o dia 1º.

**Lembretes sem agendador.** Não há processo em segundo plano: o navegador
consulta `/api/lembretes/pendentes` a cada minuto e a rota materializa antes de
responder. Por isso a operação é idempotente, garantida pela `UniqueConstraint
(origem_tipo, origem_id, disparar_em)`.

**Tempo litúrgico em duas camadas.** `services/liturgia.py` calcula as datas
móveis (Cinzas, Páscoa, Pentecostes, Advento, Batismo do Senhor pela regra
brasileira) e a tabela `liturgia_datas_fixas` cobre as solenidades e festas de
data fixa, aplicadas por cima só quando o grau realmente sobrepõe o tempo
vigente. É por isso que o vermelho dos mártires aparece no lugar certo, que São
José sobrepõe a Quaresma, e que a Sexta-feira da Paixão não é sobreposta por
nada. Para conferir qualquer dia:

```
GET /api/liturgia/hoje?data=2026-04-05
```

**Cores verificadas, não escolhidas no olho.** Os tokens `--gold-texto`,
`--success-texto`, `--danger-texto` e `--grafico-serie` existem porque as cores
de preenchimento do design system não alcançam o contraste mínimo quando viram
texto: o ouro dá 2,81:1 sobre o branco. Cada valor foi calculado contra a
superfície real em que é desenhado, e o tema escuro tem os seus próprios passos —
não é o claro invertido. O texto dos blocos do calendário é escolhido por
luminância em `routes/agenda.py`, porque a cor do bloco vem da categoria que
você escolheu.

**Gráficos de hue único.** As cores das disciplinas, postas lado a lado, não se
distinguem o bastante (o roxo e o azul ficam a ΔE 12,7 na visão normal). Como o
trabalho daquelas barras é comparar grandeza, e não identidade, usam um hue só —
a identidade vem do nome no eixo. Todo gráfico tem uma tabela de números junto,
em "Ver os números".

**Um usuário só, sem `usuario_id` nas tabelas.** É um app pessoal. Multiusuário
exigiria a coluna em ~20 tabelas e não está no escopo.

**CSRF sem biblioteca.** Cookie de sessão `SameSite=Lax` + `HttpOnly`, mais um
`before_request` que exige `Content-Type: application/json` nas mutações. Um
formulário de outro site só consegue enviar form-urlencoded ou multipart, então
esse caminho fica fechado. Uploads são a exceção declarada.

**Uploads fora de `frontend/`.** Ficam em `backend/uploads/`, servidos apenas por
rota com `@login_required`, com nome de arquivo em UUID e whitelist de extensões.
O Markdown renderizado passa por DOMPurify antes de ir ao DOM.

**Backup sem senha na linha de comando.** `services/backup.py` chama o
`mysqldump` com `--defaults-extra-file` apontando para um arquivo temporário,
apagado logo em seguida — um `ps` na máquina mostraria os argumentos de qualquer
processo, senha inclusive.

---

## Problemas comuns

| Erro | Causa provável |
|---|---|
| `Access denied for user` | Usuário ou senha incorretos no `.env` |
| `Can't connect to MySQL server` | MySQL não está rodando, ou a porta está errada |
| `cryptography package is required` | Rode `pip install cryptography` |
| `UnicodeEncodeError: 'charmap'` | Terminal antigo do Windows; `config.py` já reconfigura a saída para UTF-8 |
| Coluna nova não aparece | Falta gerar e aplicar a migração |
| Backup indisponível | `mysqldump` fora do PATH; aponte o caminho em `MYSQLDUMP` no `.env` |
| Trocar `ADMIN_SENHA` no `.env` não muda a senha | O seed só cria o usuário se não existir nenhum. Troque em Configurações → Perfil |
