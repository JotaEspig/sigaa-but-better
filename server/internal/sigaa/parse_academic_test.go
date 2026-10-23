package sigaa

import (
	"strings"
	"testing"
)

func TestParseCalendarList(t *testing.T) {
	refs, err := ParseCalendarList(doc(t, "calendario_lista.html"))
	if err != nil {
		t.Fatal(err)
	}
	if len(refs) < 30 {
		t.Fatalf("refs = %d", len(refs))
	}
	if refs[0] != (CalendarRef{ID: "35148029", Period: "2026.2", Name: "CALENDÁRIO GERAL"}) {
		t.Errorf("refs[0] = %+v", refs[0])
	}
	if refs[1].Period != "2026.1" || refs[1].ID != "33138264" {
		t.Errorf("refs[1] = %+v", refs[1])
	}
}

func TestParseCalendar(t *testing.T) {
	c, err := ParseCalendar(doc(t, "calendario.html"))
	if err != nil {
		t.Fatal(err)
	}
	if c.Period != "2026.2" || !c.Current || c.Start != "2026-08-03" || c.End != "2026-12-18" {
		t.Errorf("calendar = %+v", c)
	}
	titles := []string{}
	for _, s := range c.Sections {
		titles = append(titles, s.Title)
	}
	// "Docência Assistida" has no defined dates, so it is dropped.
	want := "Geral|Datas para Turmas Regulares|Datas para Turmas de Férias|Datas para Turmas de Ensino Individualizado|Datas para Períodos de Matrículas, Rematrícula e Processamentos"
	if got := strings.Join(titles, "|"); got != want {
		t.Errorf("sections = %s", got)
	}
	if ev := c.Sections[0].Events[1]; ev != (CalendarEvent{Label: "Período de Férias", Start: "2027-01-05", End: "2027-01-30"}) {
		t.Errorf("férias = %+v", ev)
	}
	for _, s := range c.Sections {
		for _, ev := range s.Events {
			if ev.Start == "" || ev.End == "" {
				t.Errorf("undated event kept: %+v", ev)
			}
		}
	}
}

func TestParsePastClasses(t *testing.T) {
	cs, err := ParsePastClasses(doc(t, "turmas_anteriores.html"))
	if err != nil {
		t.Fatal(err)
	}
	if len(cs) != 48 {
		t.Errorf("classes = %d", len(cs))
	}
	want := PastClass{ID: "080070D1573B0B8866AD2CA0D5ABFA393A61BC52", Code: "CCB0940", Name: "COMPILADORES", Period: "2026.2", Group: "01",
		WorkloadHours: 60, Schedule: "3N1234", StartDate: "2026-08-03", EndDate: "2026-12-11"}
	if cs[0] != want {
		t.Errorf("classes[0] = %+v", cs[0])
	}
	if cs[4].Period != "2026.1" || cs[4].Name != "PROGRAMAÇÃO COMPETITIVA" {
		t.Errorf("classes[4] = %+v", cs[4])
	}
	// Some classes have no schedule at all.
	for _, c := range cs {
		if c.Code == "EEB0910" && (c.Schedule != "" || c.StartDate != "") {
			t.Errorf("no-schedule class = %+v", c)
		}
	}
}

func TestParseComplementaryActivities(t *testing.T) {
	a, err := ParseComplementaryActivities(doc(t, "atividades_autonomas.html"))
	if err != nil {
		t.Fatal(err)
	}
	if len(a.Groups) != 2 {
		t.Fatalf("groups = %+v", a.Groups)
	}
	g := a.Groups[0]
	if g.Category != "ENSINO" || g.ApprovedHours != 52 || len(g.Activities) != 3 {
		t.Errorf("group[0] = %+v", g)
	}
	if act := g.Activities[1]; act.Date != "2024-04-15" || act.Hours != 20 || act.Status != "ACEITO" || act.Description != "20 horas" ||
		!strings.HasPrefix(act.Type, "Participação em cursos") {
		t.Errorf("activity = %+v", act)
	}
	if a.Groups[1].Category != "PESQUISA E INOVAÇÃO" || a.Groups[1].ApprovedHours != 624 {
		t.Errorf("group[1] = %+v", a.Groups[1])
	}
}

func TestParseForum(t *testing.T) {
	topics, err := ParseForumTopics(doc(t, "forum_curso.html"))
	if err != nil {
		t.Fatal(err)
	}
	if len(topics) < 20 {
		t.Fatalf("topics = %d", len(topics))
	}
	if tp := topics[0]; tp.ID != "35980266" || tp.Title != "Oferta de disciplinas optativas em 2027" || tp.Date != "2026-10-22T11:07" || tp.Replies != 0 {
		t.Errorf("topic[0] = %+v", tp)
	}

	th, err := ParseForumThread(doc(t, "forum_topico.html"), "35437619")
	if err != nil {
		t.Fatal(err)
	}
	if th.Title != "Solicitação de ajuste de matrícula" || len(th.Posts) != 2 {
		t.Fatalf("thread = %+v", th)
	}
	if p := th.Posts[0]; p.Date != "2026-08-03T13:37" || p.Author != "COORDENADOR EXEMPLO" || !strings.Contains(p.HTML, "Prezados, boa tarde.<br/>") {
		t.Errorf("post[0] = %+v", p)
	}
	// The author line carries the student's matrícula; it must not leak.
	if p := th.Posts[1]; p.Author != "DISCENTE EXEMPLO Z" {
		t.Errorf("post[1].author = %q", p.Author)
	}
}

func TestParseTeachingPlan(t *testing.T) {
	p, err := ParseTeachingPlan(doc(t, "turma_plano.html"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(p.MethodologyHTML, "Análise Léxica.") || !strings.Contains(p.AssessmentHTML, "(AV1)") {
		t.Errorf("html = %q / %q", p.MethodologyHTML, p.AssessmentHTML)
	}
	if p.OfficeHours != "Quinta-feira, 13:30-17:30" {
		t.Errorf("office hours = %q", p.OfficeHours)
	}
	if len(p.Lessons) != 25 || p.Lessons[0] != (PlanLesson{Start: "2026-08-04", End: "2026-08-04", Description: "Apresentação do plano de ensino. Introdução à compilação."}) {
		t.Errorf("lessons = %d %+v", len(p.Lessons), p.Lessons[0])
	}
	if len(p.Evaluations) != 1 || p.Evaluations[0] != (PlanEvaluation{Date: "2026-09-29", Description: "1ª Avaliação"}) {
		t.Errorf("evaluations = %+v", p.Evaluations)
	}
	if len(p.BasicReferences) != 0 || len(p.ComplementaryReferences) != 8 || p.ComplementaryReferences[0].Type != "Outros" {
		t.Errorf("refs = %+v / %+v", p.BasicReferences, p.ComplementaryReferences)
	}
	if _, err := ParseTeachingPlan(doc(t, "turma_principal.html")); err == nil {
		t.Error("main page parsed as a teaching plan")
	}
}

func TestParseParticipants(t *testing.T) {
	p, err := ParseParticipants(doc(t, "turma_participantes.html"))
	if err != nil {
		t.Fatal(err)
	}
	if len(p.Teachers) != 1 || p.Teachers[0] != (Teacher{Name: "DOCENTE EXEMPLO", Department: "CAMPUS BLUMENAU", Degree: "MESTRADO", Email: "aluno@example.com"}) {
		t.Errorf("teachers = %+v", p.Teachers)
	}
	if len(p.Students) != 4 || p.Students[0] != "DISCENTE EXEMPLO B" {
		t.Errorf("students = %+v", p.Students)
	}
}

func TestParseClassReferences(t *testing.T) {
	refs, err := ParseClassReferences(doc(t, "turma_referencias.html"))
	if err != nil {
		t.Fatal(err)
	}
	if len(refs) != 8 || !strings.HasPrefix(refs[0].Title, "AHO, Alfred V.") || refs[0].Type != "Outros" || refs[0].URL != "" {
		t.Errorf("refs = %+v", refs)
	}
}
