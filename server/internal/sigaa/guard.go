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
	actionGradesReport = "relatorioNotasAluno.gerarRelatorio"
	actionTranscript   = "portalDiscente.historico"
)

var allowedPortalActions = map[string]bool{
	actionGradesReport: true,
	actionTranscript:   true,
}

// Turma virtual menu entries (visible link text inside formMenu) we may click.
var allowedClassMenu = map[string]bool{
	"Principal":  true,
	"Frequência": true,
	"Ver Notas":  true,
	"Tarefas":    true,
	"Arquivos":   true,
	"Notícias":   true,
	"Avaliações": true,
}

var stateChangingRe = regexp.MustCompile(`(?i)(enviar|salvar|cadastr|exclu|remov|alterar|confirm|submet|matricul|trancar|respond|inscrev|gravar|novotopico)`)

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
