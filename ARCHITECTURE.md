# Arquitetura

SIGAA But Better é um frontend alternativo, **somente leitura**, para o SIGAA do IFC
(`https://sig.ifc.edu.br/sigaa`). O SIGAA não expõe uma API: é uma aplicação
JBoss/JSF/Struts renderizada no servidor. Por isso o projeto tem duas partes:

```
┌──────────────┐  JSON /api/*   ┌──────────────────────────┐  HTML (ISO-8859-1)  ┌─────────┐
│  web (React) │ ─────────────▶ │  server (Go BFF)         │ ──────────────────▶ │  SIGAA  │
│  Vite + TS   │ ◀───────────── │  sessão · scraping ·     │ ◀────────────────── │  (JSF)  │
└──────────────┘  cookie sbb_sid│  cache · guard read-only │  JSESSIONID         └─────────┘
                                └──────────────────────────┘
```

Em produção um único binário Go serve a API e os arquivos estáticos do build do
React (`STATIC_DIR`). Em desenvolvimento o Vite (`:5173`) faz proxy de `/api` para
o Go (`:8080`).

## Decisões

| Decisão | Escolha | Motivo |
|---|---|---|
| Público | Multiusuário, hospedado | Colegas usam a mesma instância |
| Senha | **Nunca armazenada** | Usada só no POST de login e descartada. O BFF guarda apenas o `JSESSIONID` do SIGAA em memória |
| Sessão local | Cookie `sbb_sid` opaco (32 bytes aleatórios), `HttpOnly`, `SameSite=Lax`, `Secure` | O navegador nunca vê o `JSESSIONID` |
| Expiração | Ociosidade de 30 min (igual ao SIGAA) e no máximo 12 h | Quando o SIGAA redireciona para `expirada.jsp`, a sessão local morre e o front volta ao login |
| Persistência | Nenhuma: cache em memória por sessão | Sem banco = sem dados acadêmicos de terceiros em disco (LGPD) |
| Escrita no SIGAA | **Proibida** | Ver "Guard somente leitura" |
| Visual | Inspirado no IFC (verde), **sem logos oficiais** e com aviso de "projeto não oficial" | Evita parecer phishing do login institucional |

## Como o SIGAA funciona (o que o BFF emula)

Detalhes e seletores em [`docs/SIGAA.md`](docs/SIGAA.md). Resumo:

1. **Login**: `GET /sigaa/verTelaLogin.do` → `POST /sigaa/logar.do;jsessionid=…?dispatch=logOn`
   com `user.login`/`user.senha`. Em caso de sucesso, cai em `/sigaa/portais/discente/discente.jsf`.
2. **Navegação JSF**: quase todo link é `jsfcljs(form, {param: valor}, target)`, ou seja,
   um POST do `<form>` com os hidden inputs (incluindo `javax.faces.ViewState`) mais
   os parâmetros do link. O BFF extrai `form` e `params` do `onclick` e reenvia.
3. **Os IDs `j_id_jsp_*` não são estáveis.** Os links são localizados por texto
   visível, pela expressão EL do menu (`#{ relatorioNotasAluno.gerarRelatorio }`) ou
   por parâmetros de negócio estáveis (`frontEndIdTurma`, `id`).
4. **A turma virtual tem estado no servidor.** "Entrar" numa turma muda a "turma
   atual" da sessão SIGAA, e downloads ou subpáginas só funcionam para a turma atual.
   Por isso **cada sessão tem um mutex**: uma operação (entrar na turma → clicar →
   parsear) roda inteira sem intercalar com outra do mesmo usuário.
5. **Sessão expirada** → `302 /sigaa/expirada.jsp`. O cliente não segue esse redirect: detecta pelo `Location` e devolve `ErrSessionExpired`.

## Guard somente leitura

Defesa em camadas, em `server/internal/sigaa/guard.go`:

1. **API tipada**: o pacote `sigaa` não expõe "submeter formulário arbitrário".
   Só existem operações nomeadas (`EnterClass`, `ClassMenu("Frequência")`,
   `PortalMenu(actionHistorico)`, …) com allowlists fixas.
2. **Denylist final**: antes de qualquer POST, nomes e valores dos parâmetros são
   checados contra `enviar|salvar|cadastrar|excluir|remover|alterar|confirmar|
   submeter|matricul|trancar|responder|inscrever|gravar|novoTopico`. Se bater, a
   chamada falha com erro interno, nunca é enviada.
3. **Nunca enviamos botões `submit`**, só hidden inputs + parâmetros do link (é
   exatamente o que um clique de navegação faz).
4. **Documentos oficiais** (histórico) registram um código de autenticação no SIGAA,
   então são emitidos **apenas por clique explícito** do usuário, nunca em prefetch
   ou cache.

Login e logout são os únicos POSTs fora da navegação JSF.

## Backend (`server/`)

```
server/
├── cmd/server/main.go          # config via env, wiring, graceful shutdown
└── internal/
    ├── sigaa/                  # tudo que conhece o SIGAA
    │   ├── client.go           # http.Client + cookie jar, decode latin1, detecção de expiração, semáforo global
    │   ├── jsf.go              # Page, extração de links jsfcljs, montagem do POST
    │   ├── guard.go            # allowlists + denylist
    │   ├── service.go          # operações de alto nível (Dashboard, Grades, Class…) sob o mutex da sessão
    │   ├── parse_*.go          # HTML → model (goquery), puros e testados com fixtures
    │   ├── schedule.go         # "3N1234" → []Slot
    │   ├── sanitize.go         # bluemonday para HTML de tópicos e notícias
    │   ├── model.go            # contrato JSON (espelhado em web/src/api/types.ts)
    │   └── testdata/           # páginas reais ANONIMIZADAS (scripts/scrub_fixture.py)
    ├── session/                # store em memória, cookie, TTL, janitor, cache por sessão
    └── api/                    # roteamento net/http, middlewares, handlers, erros, estáticos
```

Parsers são **funções puras** `func(*goquery.Document) (T, error)`: toda mudança
de layout do SIGAA é corrigida com uma nova fixture e um teste.

### Proteção do SIGAA (bom vizinho)

- Semáforo global de requisições simultâneas ao SIGAA (`SIGAA_MAX_CONCURRENCY`, padrão 8).
- Rate limit de login por IP (5/min) e de API por sessão.
- Cache por sessão com TTL (painel 2 min, notas 5 min, turma 5 min, frequência 10 min…).
  `?refresh=1` ignora o cache e continua sujeito ao rate limit.
- Timeout de 20 s por requisição ao SIGAA.

## API REST

Toda resposta JSON de sucesso vem como `{ "data": T, "fetchedAt": "<RFC3339>" }`.
Erros vêm como `{ "error": { "code": "…", "message": "…" } }`.

| Método | Rota | Resposta (`data`) | Cache |
|---|---|---|---|
| POST | `/api/auth/login` `{username,password}` | `SessionInfo` | – |
| POST | `/api/auth/logout` | 204 | – |
| GET | `/api/session` | `SessionInfo` | – |
| GET | `/api/dashboard` | `Dashboard` | 2 min |
| GET | `/api/grades` | `GradesReport` | 5 min |
| GET | `/api/classes/{id}` | `ClassOverview` | 5 min |
| GET | `/api/classes/{id}/attendance` | `Attendance` | 10 min |
| GET | `/api/classes/{id}/grades` | `ClassGrades` (`published: false` se o professor ainda não lançou) | 5 min |
| GET | `/api/classes/{id}/tasks` | `Task[]` | 5 min |
| GET | `/api/classes/{id}/files` | `FileItem[]` | 10 min |
| GET | `/api/classes/{id}/files/{fileId}` | binário (download) | – |
| GET | `/api/classes/{id}/news` | `NewsItem[]` | 5 min |
| GET | `/api/classes/{id}/news/{newsId}` | `NewsItem` (com `html`) | 30 min |
| GET | `/api/classes/{id}/evaluations` | `Evaluation[]` | 10 min |
| GET | `/api/documents/transcript` | PDF do histórico | nunca |

`{id}` é o `frontEndIdTurma` do SIGAA (hash hex de 40 caracteres, estável).
POSTs exigem `Content-Type: application/json`, o que, junto com `SameSite=Lax`,
impede CSRF por formulário.

| Código | HTTP | Quando |
|---|---|---|
| `UNAUTHENTICATED` | 401 | sem cookie/sessão local |
| `SESSION_EXPIRED` | 401 | SIGAA expirou a sessão |
| `INVALID_CREDENTIALS` | 401 | login recusado |
| `UNSUPPORTED_ACCOUNT` | 422 | login ok, mas não caiu no portal do discente (múltiplos vínculos, avisos…) |
| `RATE_LIMITED` | 429 | limite excedido |
| `NOT_FOUND` | 404 | turma/arquivo/notícia inexistente |
| `SIGAA_UNAVAILABLE` | 502 | SIGAA fora/timeout |
| `PARSE_ERROR` | 502 | layout do SIGAA mudou |

### Downloads

Arquivos são transmitidos em streaming com `Content-Disposition: attachment`
(PDF e imagens podem ser `inline`), `X-Content-Type-Options: nosniff` e
`Content-Security-Policy: sandbox`, para que um HTML enviado por professor nunca
rode na origem do app.

## Frontend (`web/`)

- React 19 + Vite + TypeScript, React Router, TanStack Query, Tailwind CSS v4, lucide-react.
- Tema claro/escuro/sistema com tokens CSS em `:root` / `[data-theme=dark]`, persistido em `localStorage`.
- Navegação espelha o SIGAA: faixa superior (semestre, usuário, tema, sair) + "Menu Discente"
  com **Portal do Discente**, **Ensino ▾** (Minhas notas, Horários, Índices e integralização,
  Emitir histórico) e **Turmas virtuais ▾**; trilha "Portal do Discente › …" em cada página.
  No mobile, o menu abre num painel.
- Rotas: `/` Portal (perfil, índices e integralização à esquerda, como no SIGAA; hoje,
  turmas, atividades, atualizações e fórum à direita), `/notas`, `/horarios`, `/progresso`
  (`#historico`), `/turmas`, `/turmas/:id[/:secao]`. A turma virtual tem o menu lateral do
  SIGAA (Turma: Principal, Notícias · Alunos: Frequência, Ver notas · Materiais: Arquivos ·
  Atividades: Avaliações, Tarefas) e "Trocar de turma" mantendo a seção.
- Sem gradientes: cores sólidas (`--bar` para a faixa superior).
- `401 SESSION_EXPIRED/UNAUTHENTICATED` em qualquer query → limpa o cache e redireciona para `/login`.
- HTML vindo da API (`topic.html`, `news.html`) já é sanitizado no BFF. O front o
  renderiza dentro de um container `.prose-sigaa`, sem nenhum outro HTML cru.

## Deploy

`Dockerfile` multi-stage: build do web (node), build do Go (estático, CGO off),
imagem final distroless com o binário e `public/`. Rode atrás de um proxy HTTPS
(Caddy/Traefik/Fly) com `TRUST_PROXY=true` para o rate limit ver o IP real.
