# SIGAA do IFC: mapa da engenharia reversa

Referência de **como o SIGAA (v4.12.x, `sig.ifc.edu.br`) funciona por baixo**, levantada
em 2026-10 navegando como discente de graduação. Quando um parser quebrar, comece por aqui.

> Tudo é HTML renderizado no servidor (JBoss 5 / JSF 1.2 + RichFaces / Struts 1),
> em **ISO-8859-1**. Não existe API JSON.

## Sessão

| Item | Valor |
|---|---|
| Cookie de sessão | `JSESSIONID=<hex>.sigaaNN` (+ `SERVERID=sigaaNN`, sticky do balanceador) |
| Expiração | cerca de 30 min ociosa → qualquer página dá `302 → /sigaa/expirada.jsp` |
| Login | `GET /sigaa/verTelaLogin.do` → `POST <action do loginForm>` (`/sigaa/logar.do;jsessionid=…?dispatch=logOn`) |
| Campos do login | `user.login`, `user.senha`, `width`, `height` + hidden (`urlRedirect`, `subsistemaRedirect`, `acao`, `acessibilidade`) |
| Login OK | redirect para `/sigaa/portais/discente/discente.jsf` |
| Login falhou | a resposta contém de novo `form[name=loginForm]` |
| Logout | `GET /sigaa/logar.do?dispatch=logOff` |
| Captcha | nenhum (em 2026-10) |

## Navegação JSF

Quase todo link é assim:

```html
<a onclick="…jsfcljs(document.getElementById('FORM_ID'),{'PARAM':'VALOR','id':'123'},'');…">
```

O `jsfcljs` adiciona os pares como `<input type=hidden>` e submete `FORM_ID` (POST para o
`action` do form). Para emular: pegue os inputs não-botão do form (inclui
`javax.faces.ViewState`, do tipo `j_id9`), some os parâmetros e faça o POST. Ver `server/internal/sigaa/jsf.go`.

- Os IDs `j_id_jsp_<n>_<m>` mudam a cada deploy, então **nunca os fixe no código**.
- ViewStates antigos continuam valendo por um tempo (o servidor guarda vários), mas o BFF
  sempre parte de uma página fresca do portal para não depender disso.

### Menu do discente (JSCookMenu)

O menu do topo é uma variável JS com entradas no formato:

```
['<img…>', 'Consultar Minhas Notas', 'menu_form_menu_discente_j_id_jsp_…_menu:A]#{ relatorioNotasAluno.gerarRelatorio }', …]
```

Clicar = submeter o form que contém `input[name=jscook_action]` (id `menu:form_menu_discente`)
com `jscook_action` = a string `…:A]#{ bean.metodo }`. O BFF localiza pela expressão EL.

| Expressão EL | Tela | Usada? |
|---|---|---|
| `relatorioNotasAluno.gerarRelatorio` | Relatório de notas (HTML) | sim |
| `portalDiscente.historico` | Histórico (**PDF direto**, registra código de autenticação) | sim, só por clique |
| `indiceAcademicoMBean.selecionaDiscente` | Explicação das fórmulas dos índices (os valores já estão no portal) | não |
| `calendario.iniciarBusca` | Lista de calendários acadêmicos | futuro |
| `portalDiscente.atestadoMatricula` | Atestado (registra código de autenticação) | não |
| `matriculaGraduacao.*`, `trancamentoPrograma.*`, `solicitacao*`… | **alteram estado** | **proibido** |

## Portal do discente (`/sigaa/portais/discente/discente.jsf`)

| Dado | Seletor / pista |
|---|---|
| Nome, semestre, campus | `#info-usuario .usuario span`, `.periodo-atual strong`, `.unidade` |
| Matrícula, curso, nível, status, e-mail, entrada | `#agenda-docente` com `h4` "Dados Institucionais", linhas `<td>Label:</td><td>valor</td>` |
| Índices (MC, IRA, MCN, IECH, IEPL, IEA, IEAN, ISPL, IECHP) | `acronym[title=descrição]` + o `td` seguinte |
| Integralização | `td` "CH. Obrigatória Pendente" etc.; percentual exato no `style="width: 81.30…%"` da barra |
| Turmas do semestre | tabela cujo 1º `th` é "Componente Curricular"; `td.descricao a` (link com `frontEndIdTurma`), `td.info` local e horário |
| Minhas atividades | `#avaliacao-portal tbody tr`; datas passadas vêm em `<font color="gray">` |
| Últimas atualizações | `#atualizacoes-turma .rotator > table` (data + turma / descrição) |
| Fórum do curso | tabela com `th` "Respostas" |

O perfil é **texto livre do aluno** (no seu caso, havia `<script>alert(1)</script>`), então trate
todo texto como não confiável.

### Código de horário

`3N1234 (03/08/2026 - 11/12/2026)` = **dia** (2 = seg … 7 = sáb), **turno** (M/T/N) e
**aulas** do turno. Grupos podem combinar: `24M12 6T34`. Ver `parseSchedule`.

## Relatório de notas

`table.tabelaRelatorio` por semestre (`caption` = período). Cabeçalhos variam:
`Código, Disciplina, Unidade. 1, Unidade. 2, Recuperação, Resultado, Faltas, Situação`.
Os valores usam vírgula decimal, e `--` ou vazio significa sem nota.

## Turma virtual (`/sigaa/ava/index.jsf`)

- **Entrar**: link no portal com `frontEndIdTurma` (hash hex de 40 caracteres, estável); form
  `form_acessarTurmaVirtual[j_id_N]`.
- **Estado no servidor**: a sessão tem uma "turma atual". Downloads e subpáginas só funcionam
  para ela, então o BFF serializa as operações por usuário (mutex) e sempre (re)entra na turma.
- Cabeçalho: `#linkCodigoTurma`, `#linkNomeTurma` (o `title` traz o horário); `a.linkTurma`
  traz "COD - NOME (60h) (2026.2)".
- "Aulas (Ministradas/Total): 42 / 72" no painel lateral.
- `#ultimaNoticia` (`h4` "Última Notícia Título - dd/mm/aaaa hh:mm", `.conteudoNoticia`).
- Tópicos: `.topico-aula` → `.titulo` "Título (dd/mm/aaaa - dd/mm/aaaa)" e `.conteudotopico`
  (HTML livre do professor, que **precisa ser sanitizado**). Materiais em `.item`:
  - arquivo: link `jsfcljs(formAva, {…listaMateriais…, id: <hash>})` → download;
  - tarefa: parâmetro `…idEnviarMaterialTarefa` abre a tela de **envio**. **Nunca clicar.**
  - link externo: `a[href^=http]`.

### Menu da turma (`formMenu`, por texto do link)

| Texto | Conteúdo | Parser |
|---|---|---|
| Frequência | `table.listing` Data/Situação ("Presente", "N Falta(s)", "Não Registrada") + resumo em texto | `ParseAttendance` |
| Ver Notas | `table.tabelaRelatorio` com 2 linhas de cabeçalho (grupo com colspan + avaliações `th#aval_<id>`, detalhes em `input#denAval_<id>`, `#pesoAval_<id>`) ou "Ainda não foram lançadas notas." | `ParseClassGrades` |
| Tarefas | `table.listing` com 2 linhas por tarefa; ícone `accept.png` = corrigida; `a[title="Enviar tarefa"]` = aberta | `ParseTasks` |
| Arquivos | `table.listing` Título/Descrição/Tópico; download via `jsfcljs(formAva, {…, id: <numérico>})` | `ParseFiles` |
| Notícias | `table.listing` Título/Data; "Visualizar" com `id` → `fieldset` "Visualização de Notícia" | `ParseNewsList`, `ParseNewsDetail` |
| Avaliações | `table.listing` Data/Hora/Descrição (hora às vezes "18:30h") | `ParseEvaluations` |

Downloads respondem com `Content-Disposition: attachment; filename="…"` (nome em ISO-8859-1).
Se a turma atual estiver errada, o SIGAA devolve **HTML** da turma, não um erro.

## Atualizando fixtures

1. Salve a página (logado) em um arquivo local, **fora do repositório**.
2. `scripts/scrub_fixture.py pagina.html server/internal/sigaa/testdata/nome.html --map seu-mapa.private.json`
   (o mapa `{"NOME REAL": "ALUNO EXEMPLO DA SILVA", …}` é ignorado pelo git).
3. Confira: `grep -i "<seu sobrenome>\|<sua matrícula>" server/internal/sigaa/testdata/*`.
4. Escreva/ajuste o teste em `parse_test.go`.
