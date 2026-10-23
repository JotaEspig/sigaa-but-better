# Contribuindo

Padrões de branches, commits e pull requests do projeto. Leia também o
[CLAUDE.md](CLAUDE.md) (regras inegociáveis: somente leitura, sem senha, sem dados pessoais)
e o [ARCHITECTURE.md](ARCHITECTURE.md) antes de mudanças estruturais.

## Fluxo

1. A `main` está sempre pronta para deploy. Nada de push direto nela, exceto ajustes
   triviais de documentação feitos pelo mantenedor.
2. Crie uma branch a partir da `main` atualizada, faça commits pequenos e abra um PR.
3. O PR só entra com `make lint` e `make test` passando e pelo menos uma revisão.
4. Merge por **squash** (ou rebase, se cada commit já estiver limpo e fizer sentido sozinho).
   A branch é apagada depois do merge.

## Branches

Formato: `<tipo>/<descrição-curta>`, em inglês, minúsculas e com hífens.

| Tipo | Uso | Exemplo |
|---|---|---|
| `feat/` | funcionalidade nova | `feat/extra-themes` |
| `fix/` | correção de bug | `fix/grades-parse-empty-row` |
| `refactor/` | mudança interna sem alterar comportamento | `refactor/session-store` |
| `docs/` | só documentação | `docs/contributing-guide` |
| `test/` | só testes ou fixtures | `test/schedule-fixture` |
| `chore/` | build, dependências, CI, configs | `chore/bump-vite` |
| `perf/` | melhoria de desempenho | `perf/dashboard-prefetch` |

Se houver issue, inclua o número: `fix/42-login-redirect`. Uma branch, um assunto.

## Commits

Seguimos [Conventional Commits 1.0](https://www.conventionalcommits.org/pt-br/v1.0.0/):

```
<tipo>(<escopo opcional>): <descrição>

<corpo opcional: o porquê da mudança>

<rodapé opcional: BREAKING CHANGE, Closes #123, Co-Authored-By…>
```

**Tipos:** `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `style` (formatação, sem
mudança de lógica), `build`, `ci`, `chore`, `revert`.

**Escopos comuns:** `web`, `server`, `api`, `parser`, `guard`, `session`, `theme`, `docker`, `deps`.

**Regras:**

- Descrição no imperativo, minúscula, sem ponto final, até ~72 caracteres:
  `feat(web): add theme picker`, não `Added theme picker.`
- Mensagens em inglês (como o código); o corpo pode explicar em detalhes o *porquê*,
  não o *como* (o diff já mostra o como).
- Commits atômicos: cada um compila, passa nos testes e trata de uma coisa só.
  Não misture refactor com feature no mesmo commit.
- Mudança incompatível no contrato JSON ou na configuração: `!` após o tipo
  (`feat(api)!: rename grades fields`) e rodapé `BREAKING CHANGE: …`.
- Referencie issues no rodapé: `Closes #12`, `Refs #34`.

Exemplos:

```
feat(web): add theme picker with community palettes
fix(parser): handle classes without location
docs: add contributing guide
chore(deps): bump vite to 8.3.5
refactor(server)!: move session store to its own package

BREAKING CHANGE: SESSION_TTL was split into SESSION_IDLE_TTL and SESSION_MAX_TTL.
```

## Pull requests

**Título:** no mesmo formato de um commit convencional (vira a mensagem do squash):
`feat(web): add theme picker with community palettes`.

**Descrição** (em pt-BR):

```markdown
## O quê
Resumo da mudança em 1–3 frases.

## Por quê
Motivação, problema resolvido ou issue (Closes #N).

## Como testar
- [ ] passo a passo para verificar
- [ ] `make lint` e `make test` passando

## Capturas de tela
(obrigatório para mudanças visuais: antes/depois, tema claro e escuro)

## Checklist
- [ ] Nenhuma requisição nova altera estado no SIGAA (guard/allowlists atualizados se preciso)
- [ ] Nenhum dado pessoal em fixtures, logs ou screenshots
- [ ] Contrato `model.go` ⇄ `types.ts` ⇄ ARCHITECTURE.md sincronizado (se mudou)
- [ ] Documentação atualizada (se aplicável)
```

**Boas práticas:**

- PRs pequenos e focados; prefira vários PRs a um gigante.
- Abra como *draft* enquanto estiver em andamento.
- Responda a todos os comentários de revisão; quem abriu o comentário é quem o resolve.
- Atualize a branch com `git rebase origin/main` em vez de merge da `main`.
