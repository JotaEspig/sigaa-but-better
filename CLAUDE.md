# CLAUDE.md

Frontend alternativo, **somente leitura**, para o SIGAA do IFC. Go BFF (`server/`) faz
scraping do SIGAA e expõe JSON; React (`web/`) consome. Leia `ARCHITECTURE.md` antes de
mudanças estruturais e `docs/SIGAA.md` antes de mexer em parsers ou navegação.

## Regras inegociáveis

1. **Nunca altere estado no SIGAA.** Só GET, login/logout e POSTs de *navegação* JSF
   que passam por `Client.click` (que roda `checkReadOnly`). Para uma tela nova:
   adicione a entrada às allowlists de `server/internal/sigaa/guard.go`, nunca contorne o
   guard, e acrescente o caso em `guard_test.go`. Na dúvida se um clique altera algo, não clique.
2. **Nunca armazene a senha.** Ela vive só durante `Client.Login`. Nada de log de body,
   headers de auth ou cookies.
3. **Nunca commite dados pessoais.** Fixtures só depois de `scripts/scrub_fixture.py`;
   `credentials.json` e `*.private.json` são ignorados pelo git. Antes de commitar fixtures,
   rode um grep pelo nome/matrícula reais.
4. **Documentos oficiais** (histórico, atestados) registram código de autenticação no
   SIGAA: só por clique explícito do usuário, nunca em cache ou prefetch.
5. HTML de terceiros (tópicos, notícias, plano de ensino, mensagens do fórum) só chega ao front
   via `sanitize()` (bluemonday). No front, `dangerouslySetInnerHTML` só é permitido para esses campos.
6. Dados de colegas (participantes, fórum): exponha só o necessário. Nada de e-mail, usuário ou
   matrícula de outros alunos na API.
7. Contrato JSON: `server/internal/sigaa/model.go` ⇄ `web/src/api/types.ts`. Mudou um, mude o outro
   e a tabela da API em `ARCHITECTURE.md`.

## Comandos

```bash
make dev-server   # Go em :8080 (COOKIE_SECURE=false)
make dev-web      # Vite em :5173 com proxy /api → :8080
cd web && VITE_MOCK=1 npm run dev   # front com dados falsos, sem backend
make test         # go vet + go test -race + typecheck + vitest
make lint         # gofmt + eslint
make docker       # imagem única (API + estáticos)
```

Testes Go não acessam a rede: `internal/api/api_test.go` sobe um SIGAA falso com as fixtures.
Teste manual contra o SIGAA real só com consentimento do dono da conta.

## Convenções

- Go: parsers são funções puras `Parse*(*goquery.Document) (T, error)`, uma fixture e um teste
  por página. Localize elementos por texto, expressão EL ou parâmetro estável
  (`frontEndIdTurma`, `id`), **nunca** por `j_id_jsp_*`. Layout inesperado → `parseErr(...)`
  (vira `PARSE_ERROR` 502), não panic nem dado inventado.
- Operações de alto nível ficam em `service.go` e seguram `c.mu` do início ao fim (a turma
  virtual tem estado no servidor).
- Datas na API: `YYYY-MM-DD` / `YYYY-MM-DDTHH:mm` sem offset (horário de Brasília).
- UI e mensagens em pt-BR com acentuação correta; código e identificadores em inglês.
- Front: TanStack Query por endpoint em `web/src/api/hooks.ts`; tokens de cor em CSS
  (`:root` / `[data-theme=dark]`); sem CDNs externos (CSP `default-src 'self'`).
