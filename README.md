# SIGAA But Better

Uma interface moderna, rápida e com tema claro/escuro para o
[SIGAA do IFC](https://sig.ifc.edu.br/sigaa/verTelaLogin.do). **Projeto não oficial**,
sem vínculo com o IFC ou a UFRN.

- 📅 Painel com aulas de hoje, próximas avaliações e atualizações das turmas
- 🗓️ Grade semanal de horários
- 📊 Notas de todos os semestres e notas detalhadas por avaliação
- ✅ Frequência por aula, com alerta de limite de faltas
- 📚 Turma virtual: aulas, arquivos, tarefas, notícias e avaliações
- 🎓 Progresso no curso: índices acadêmicos, integralização e histórico em PDF

## Privacidade e segurança

- **Somente leitura**: o app nunca envia tarefas, faz matrícula ou altera nada no SIGAA.
  Há um guard no código que bloqueia qualquer requisição com cara de alteração.
- **Sua senha não é armazenada**: ela é repassada ao SIGAA apenas no login. O servidor
  guarda em memória só o cookie de sessão do SIGAA, que expira junto com ele.
- Sem banco de dados: nada sobre você fica gravado em disco.

## Rodando

Pré-requisitos: Go 1.27+, Node 22+.

```bash
# desenvolvimento (dois terminais)
make dev-server
make dev-web        # abra http://localhost:5173

# ou tudo numa imagem
docker compose up --build   # http://localhost:8080
```

Para trabalhar no front sem backend: `cd web && VITE_MOCK=1 npm run dev`.

### Variáveis de ambiente (servidor)

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `8080` | porta HTTP |
| `SIGAA_BASE_URL` | `https://sig.ifc.edu.br` | instância do SIGAA |
| `STATIC_DIR` | – | pasta do build do front (servido com fallback de SPA) |
| `COOKIE_SECURE` | `true` | use `false` só em `http://localhost` |
| `TRUST_PROXY` | `false` | `true` atrás de proxy reverso (lê `X-Forwarded-For`) |
| `SIGAA_MAX_CONCURRENCY` | `8` | requisições simultâneas ao SIGAA (todos os usuários) |
| `SESSION_IDLE_TTL` | `30m` | sessão ociosa expira |
| `SESSION_MAX_TTL` | `12h` | duração máxima de uma sessão |

Em produção, coloque atrás de HTTPS (Caddy, Traefik, Fly.io…) com `TRUST_PROXY=true`.
Como as sessões ficam em memória, rode **uma única instância** (ou use sticky sessions).

## Documentação

- [ARCHITECTURE.md](ARCHITECTURE.md): decisões, componentes, API REST e segurança
- [docs/SIGAA.md](docs/SIGAA.md): como o SIGAA funciona por dentro (engenharia reversa)
- [docs/ROADMAP.md](docs/ROADMAP.md): o que já foi feito e candidatos para as próximas rodadas
- [CLAUDE.md](CLAUDE.md): regras para quem (humano ou IA) for contribuir
- [CONTRIBUTING.md](CONTRIBUTING.md): padrões de branches, commits (Conventional Commits) e pull requests
