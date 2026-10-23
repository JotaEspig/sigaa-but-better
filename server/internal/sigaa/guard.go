package sigaa

import (
	"fmt"
	"net/url"
	"regexp"
)

// The read-only guard. See ARCHITECTURE.md "Guard somente leitura".
//
// Layer 1 is the typed API in service.go: callers can only pick from the
// allowlists below. Layer 2 (checkReadOnly) inspects every POST right before
// it is sent and refuses anything that smells like a state change.

// Portal menu entries (the EL expression inside jscook_action) we may trigger.
const (
	actionGradesReport  = "relatorioNotasAluno.gerarRelatorio"
	actionTranscript    = "portalDiscente.historico"
	actionCalendars     = "calendario.iniciarBusca"
	actionComplementary = "solicitacaoRegistroAtividadeAutonomaMBean.listar"
	actionCourseForum   = "forum.listarForunsCurso"
)

var allowedPortalActions = map[string]bool{
	actionGradesReport:  true,
	actionTranscript:    true,
	actionCalendars:     true,
	actionComplementary: true,
	actionCourseForum:   true,
}

// Plain GET pages we may load.
const pastClassesPath = "/sigaa/portais/discente/turmas.jsf"

// Turma virtual menu entries (visible link text inside formMenu) we may click.
var allowedClassMenu = map[string]bool{
	"Principal":  true,
	"Frequência": true,
	"Ver Notas":  true,
	"Tarefas":    true,
	"Arquivos":   true,
	"Notícias":   true,
	"Avaliações": true,
	// "Plano de Ensino" is the link text; SIGAA's own page title is "Plano de Curso".
	"Plano de Ensino": true,
	"Participantes":   true,
	"Referências":     true,
}

var stateChangingRe = regexp.MustCompile(`(?i)(enviar|salvar|cadastr|exclu|remov|alterar|confirm|submet|matricul|trancar|respond|inscrev|gravar|novotopico|seguir|denunc|denmensag)`)

// checkReadOnly is the last line of defense before a POST leaves the process.
func checkReadOnly(values url.Values) error {
	for name, vs := range values {
		if stateChangingRe.MatchString(name) {
			return fmt.Errorf("%w: parameter %q", ErrForbiddenAction, name)
		}
		for _, v := range vs {
			if stateChangingRe.MatchString(v) {
				return fmt.Errorf("%w: value of %q", ErrForbiddenAction, name)
			}
		}
	}
	return nil
}
