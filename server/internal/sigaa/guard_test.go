package sigaa

import (
	"errors"
	"strings"
	"testing"

	"github.com/PuerkitoBio/goquery"
)

// Every POST the app makes must pass the guard, built from real (anonymized) pages.
func TestGuardAllowsAppNavigation(t *testing.T) {
	portal := fixture(t, "portal.html")
	class := fixture(t, "turma_principal.html")
	classFiles := fixture(t, "turma_principal_com_arquivos.html")
	files := fixture(t, "turma_arquivos.html")
	news := fixture(t, "turma_noticias.html")
	calendars := fixture(t, "calendario_lista.html")
	forum := fixture(t, "forum_curso.html")
	past := fixture(t, "turmas_anteriores.html")

	var links []struct {
		name string
		page *Page
		link Link
	}
	add := func(name string, p *Page, l Link, ok bool) {
		if !ok {
			t.Fatalf("%s: link not found", name)
		}
		links = append(links, struct {
			name string
			page *Page
			link Link
		}{name, p, l})
	}

	for action := range allowedPortalActions {
		l, ok := portalMenuLink(portal, action)
		add(action, portal, l, ok)
	}
	l, ok := portal.FindLinkByParam("frontEndIdTurma", "080070D1573B0B8866AD2CA0D5ABFA393A61BC52")
	add("enter class", portal, l, ok)
	for label := range allowedClassMenu {
		l, ok := class.FindLinkByText(classMenuForm, label)
		add("menu "+label, class, l, ok)
	}
	l, ok = findFileLink(classFiles, "D7CC7FAF766DB59B2D63AF1FD3DDEFB8CD4B0E26")
	add("topic file", classFiles, l, ok)
	l, ok = findFileLink(files, "3641653")
	add("listed file", files, l, ok)
	l, ok = news.FindLinkByParam("id", "35917358")
	add("news detail", news, l, ok)
	l, ok = calendars.FindLinkByParam("id", "35148029")
	add("calendar detail", calendars, l, ok)
	l, ok = forum.FindLinkByParam("idForumMensagem", "35437619")
	add("forum topic", forum, l, ok)
	l, ok = past.FindLinkByParam("frontEndIdTurma", "080070D1573B0B8866AD2CA0D5ABFA393A61BC52")
	add("past class", past, l, ok)

	for _, x := range links {
		_, values, ok := x.page.formRequest(x.link)
		if !ok {
			t.Errorf("%s: form %q missing", x.name, x.link.FormID)
			continue
		}
		if values.Get("javax.faces.ViewState") == "" {
			t.Errorf("%s: no ViewState", x.name)
		}
		if err := checkReadOnly(values); err != nil {
			t.Errorf("%s: guard refused: %v", x.name, err)
		}
	}
}

func TestGuardRefusesStateChanges(t *testing.T) {
	class := fixture(t, "turma_principal.html")
	// The task link inside a topic opens the submission screen.
	l, ok := class.FindLink(func(_ *goquery.Selection, l Link) bool {
		for _, kv := range l.Params {
			if strings.Contains(kv[0], "EnviarMaterialTarefa") {
				return true
			}
		}
		return false
	})
	if !ok {
		t.Fatal("task submission link not found in fixture")
	}
	_, values, _ := class.formRequest(l)
	if err := checkReadOnly(values); !errors.Is(err, ErrForbiddenAction) {
		t.Errorf("guard allowed task submission link: %v", err)
	}

	portal := fixture(t, "portal.html")
	if _, ok := portalMenuLink(portal, "portalDiscente.atestadoMatricula"); !ok {
		t.Fatal("fixture should contain the atestado action")
	}
	c := &Client{}
	if _, err := c.portalMenuRaw(t.Context(), "matriculaGraduacao.telaInstrucoes"); !errors.Is(err, ErrForbiddenAction) {
		t.Errorf("non-allowlisted portal action not refused: %v", err)
	}
	if _, err := c.clickClassMenu(t.Context(), class, "Gerenciar Perfil"); !errors.Is(err, ErrForbiddenAction) {
		t.Errorf("non-allowlisted class menu not refused: %v", err)
	}

	// Following or reporting a forum post changes state.
	topic := fixture(t, "forum_topico.html")
	refused := 0
	topic.Doc.Find("[onclick]").Each(func(_ int, el *goquery.Selection) {
		l, ok := parseJSFLink(el.AttrOr("onclick", ""))
		if !ok {
			return
		}
		_, values, _ := topic.formRequest(l)
		if err := checkReadOnly(values); !errors.Is(err, ErrForbiddenAction) {
			t.Errorf("guard allowed forum action %v: %v", l.Params, err)
		}
		refused++
	})
	if refused < 3 {
		t.Errorf("expected follow + report links in fixture, got %d", refused)
	}
}
