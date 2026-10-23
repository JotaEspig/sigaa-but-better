# Roadmap

O que já foi feito, o que dá para fazer nas próximas rodadas e o que fica de fora de propósito.
Atualize este arquivo no mesmo PR que entrega ou descarta uma funcionalidade.

Legenda de esforço: **P** (só front ou um parser simples), **M** (parser + rota + tela),
**G** (exige navegação nova, paginação ou decisão de privacidade).

## Feito

### Rodada 1: base (`9bb0773`)
- Login/logout, sessão local, guard somente leitura, cache por sessão.
- Portal do discente: perfil, índices, integralização, turmas do semestre, minhas atividades,
  últimas atualizações e resumo do fórum.
- Minhas notas (todos os semestres), horários da semana, índices e integralização.
- Emitir histórico (PDF oficial, só por clique explícito).
- Turma virtual: Principal (tópicos e materiais), Notícias, Frequência, Ver notas, Arquivos
  (download), Avaliações, Tarefas (só leitura).

### Rodada 2: temas (PR #1)
- Seletor de tema com paletas extras e tema escuro neutro.

### Rodada 3: mais telas do SIGAA (`feat/more-sigaa-pages`, 2026-10)
- **Calendário acadêmico** (`/calendario`): todos os semestres desde 2009, com "em andamento" e
  "próximos prazos" no calendário vigente.
- **Turmas anteriores** (`/turmas/anteriores`): as turmas de todos os semestres, agrupadas e
  filtráveis. Cada uma abre a turma virtual antiga (o BFF entra por `turmas.jsf`).
- **Atividades complementares** (`/progresso#complementares`): registros por categoria, horas e status.
- **Fórum do curso** (`/forum`, `/forum/:id`): lista com filtro e leitura dos tópicos. O portal
  agora linka cada tópico.
- **Turma virtual**: Plano de ensino (metodologia, avaliação, horário de atendimento, cronograma
  com "próxima aula", referências), Participantes (docentes com contato; colegas só com nome),
  Referências.
- Guard: `seguir|denunc|denmensag` na denylist (seguir/denunciar no fórum).

## Próximas rodadas (candidatos)

### Precisam de uma conta/turma com dados para gerar fixture
Na conta explorada em 2026-10 estas telas estavam vazias, então não há HTML real para escrever
o parser com segurança. Quando alguma turma tiver conteúdo, salve a página e siga o fluxo de
fixtures do `docs/SIGAA.md`.

| Item | Onde | Esforço | Observação |
|---|---|---|---|
| Fóruns da turma | menu da turma "Fóruns" | M | Mesmo cuidado do fórum do curso: nada de seguir/responder |
| Enquetes (resultado) | "Enquetes" | M | Só ver resultado; **votar altera estado** |
| Questionários (lista e notas) | "Questionários" | M | Só listar prazos/notas; **responder altera estado** |
| Vídeos | "Vídeos" | P | Provavelmente links externos |
| Conteúdo/Página web | "Conteúdo/Página web" | M | HTML do professor: passar por `sanitize()` |
| Ver grupo | "Ver Grupo" | P | Integrantes do grupo (só nomes) |
| Recuperação paralela | "Recuperação Paralela" | P | |
| Linha do tempo | "Linha do Tempo" | P | Tem filtro por datas (form com submit: avaliar o guard) |
| Situação dos discentes | "Situação dos Discentes" | P | Estatísticas da turma (agregadas, sem dados individuais?) |
| Minhas bolsas | menu `relatorioBolsasDiscenteBean.listarBolsasInstituicao` | P | Vazia nesta conta |
| Mural de estágios | menu `ofertaEstagioMBean.listarOfertasDisponiveis` | P | Vazio nesta conta |

### Melhorias no que já existe
| Item | Esforço | Observação |
|---|---|---|
| Paginação do tópico do fórum | M | Hoje só a 1ª página de mensagens; os links de página são `pageNext` etc. |
| Busca no fórum pelo SIGAA | G | O filtro do SIGAA é um **botão submit**; o guard não envia submits. Hoje filtramos no front |
| Detalhe de atividade complementar | P | Link "Detalhar Anotação" (`id`), só leitura |
| Programa do componente | P | Link `idComponente` no plano de ensino (ementa oficial) |
| Calendário no painel | P | Mostrar "próximo prazo" do calendário no portal |
| Exportar calendário/avaliações (.ics) | M | Gerado no front a partir dos dados já carregados |
| Notas de turmas anteriores na turma virtual | P | "Ver Notas" já funciona para turmas antigas; falta destaque na lista |
| Fixture de turma antiga | P | Hoje o teste de turma anterior reaproveita `turma_principal.html` |

### Ideias que exigem decisão antes
- **Índices acadêmicos detalhados** (`indiceAcademicoMBean.selecionaDiscente`): é uma página de
  fórmulas, sem dados novos. Valeria só como texto explicativo estático.
- **Estrutura curricular / componentes pendentes**: "Consultar Estrutura Curricular" é uma busca
  que exige enviar botão submit. Precisaria de uma exceção bem delimitada no guard.
- **Notificações** (novas notícias, tarefas, notas): exigiria polling em segundo plano com a
  sessão do usuário. Conflita com "sem persistência" e com ser bom vizinho do SIGAA.

## Fora de escopo (de propósito)
- Qualquer coisa que **altere estado**: matrícula, "Meu plano de matrículas", trancamento,
  solicitações, avaliação institucional, enviar tarefa, responder fórum/enquete/questionário,
  seguir/denunciar, atualizar perfil.
- **Documentos com código de autenticação** em prefetch ou cache: atestados, declarações,
  certificados (o histórico só existe por clique explícito).
- **Dossiê eletrônico** (RG, reservista, título de eleitor): sensível demais para um serviço
  multiusuário.
- **Caixa postal**: respondeu 404 em 2026-10, e abrir uma mensagem a marca como lida.
- **Dados de colegas** além do nome: e-mail, usuário, matrícula, foto.
