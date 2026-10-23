package sigaa

import (
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/PuerkitoBio/goquery"
)

func fixture(t *testing.T, name string) *Page {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatal(err)
	}
	u, _ := url.Parse("https://sig.ifc.edu.br/sigaa/ava/index.jsf")
	p, err := newPage(u, string(raw))
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func doc(t *testing.T, name string) *goquery.Document { return fixture(t, name).Doc }

func f(v float64) *float64 { return &v }

func eqF(a, b *float64) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

func TestParsePortal(t *testing.T) {
	d, err := ParsePortal(doc(t, "portal.html"))
	if err != nil {
		t.Fatal(err)
	}
	p := d.Profile
	if p.Name != "ALUNO EXEMPLO DA SILVA" || p.Matricula != "2020000001" || p.CurrentPeriod != "2026.2" {
		t.Errorf("profile = %+v", p)
	}
	if !strings.HasPrefix(p.Course, "CIÊNCIA DA COMPUTAÇÃO") || p.Level != "GRADUAÇÃO" || p.Status != "ATIVO" || p.EntryPeriod != "2023.1" {
		t.Errorf("profile = %+v", p)
	}
	if !strings.HasPrefix(p.Campus, "CAMPUS BLUMENAU") {
		t.Errorf("campus = %q", p.Campus)
	}

	if len(d.Indices) != 9 || d.Indices[1].Code != "IRA" || d.Indices[1].Value != 9.2035 || d.Indices[1].Description != "Índice de Rendimento Acadêmico" {
		t.Errorf("indices = %+v", d.Indices)
	}
	want := Progress{MandatoryPendingHours: 480, OptionalPendingHours: 120, TotalCurriculumHours: 3210, Percent: 81.30841121495327}
	if d.Progress != want {
		t.Errorf("progress = %+v", d.Progress)
	}

	if len(d.Classes) != 4 {
		t.Fatalf("classes = %+v", d.Classes)
	}
	c := d.Classes[0]
	if c.ID != "080070D1573B0B8866AD2CA0D5ABFA393A61BC52" || c.Name != "COMPILADORES" || c.Location != "Laboratório D06" ||
		c.Schedule != "3N1234" || c.Period != "2026.2" || c.StartDate != "2026-08-03" || c.EndDate != "2026-12-11" {
		t.Errorf("class = %+v", c)
	}
	if len(c.Slots) != 4 || c.Slots[0] != (Slot{Day: 3, Shift: "N", Index: 1}) {
		t.Errorf("slots = %+v", c.Slots)
	}

	if len(d.Activities) != 2 {
		t.Fatalf("activities = %+v", d.Activities)
	}
	if a := d.Activities[0]; a != (Activity{Date: "2026-10-15", ClassName: "COMPUTAÇÃO GRÁFICA", Kind: "Avaliação", Title: "Trab 3", Past: true}) {
		t.Errorf("activity[0] = %+v", a)
	}
	if a := d.Activities[1]; a.Date != "2026-11-04" || a.Past || a.Title != "Trabalho" {
		t.Errorf("activity[1] = %+v", a)
	}

	if len(d.Updates) != 10 || d.Updates[0] != (ClassUpdate{Date: "2026-10-13", ClassName: "COMPUTAÇÃO GRÁFICA", Description: "Nova Notícia: Trabalho 03 - alteração de data de entrega."}) {
		t.Errorf("updates[0] = %+v (n=%d)", d.Updates[0], len(d.Updates))
	}
	if len(d.Forum) < 5 || d.Forum[0] != (ForumTopic{ID: "35974352", Title: "Ponto facultativo 28/10", Author: "servidor.exemplo", Replies: 0, Date: "2026-10-21T15:01"}) {
		t.Errorf("forum = %+v", d.Forum)
	}
}

func TestParseGradesReport(t *testing.T) {
	r, err := ParseGradesReport(doc(t, "notas_relatorio.html"))
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Semesters) != 8 || r.Semesters[0].Period != "2026.2" || r.Semesters[7].Period != "2023.1" {
		t.Fatalf("semesters = %d", len(r.Semesters))
	}
	if got := r.Semesters[1].UnitLabels; len(got) != 2 || got[0] != "Unidade. 1" {
		t.Errorf("unit labels = %v", got)
	}
	cur := r.Semesters[0].Rows[0]
	if cur.Code != "CCB0940" || !eqF(cur.Units[0], f(2.8)) || cur.Units[1] != nil || cur.Result != nil || cur.Situation != "" || *cur.Absences != 4 {
		t.Errorf("current row = %+v", cur)
	}
	pc := r.Semesters[1].Rows[0]
	if pc.Name != "PROGRAMAÇÃO COMPETITIVA" || !eqF(pc.Units[1], f(6.3)) || !eqF(pc.Result, f(7.8)) || *pc.Absences != 14 || pc.Situation != "APROVADO" {
		t.Errorf("row = %+v", pc)
	}
}

func TestParseClassOverview(t *testing.T) {
	c, err := ParseClassOverview(doc(t, "turma_principal.html"), "080070D1573B0B8866AD2CA0D5ABFA393A61BC52")
	if err != nil {
		t.Fatal(err)
	}
	if c.Code != "CCB0940" || c.Name != "COMPILADORES" || c.Period != "2026.2" || c.WorkloadHours != 60 || c.Schedule != "3N1234" {
		t.Errorf("header = %+v", c)
	}
	if c.LessonsTaught != 42 || c.LessonsTotal != 72 {
		t.Errorf("lessons = %d/%d", c.LessonsTaught, c.LessonsTotal)
	}
	if c.LastNews == nil || c.LastNews.Title != "Aula de 20/10 cancelada" || c.LastNews.Date != "2026-10-10T17:17" || !strings.Contains(c.LastNews.HTML, "Não haverá aula") {
		t.Errorf("last news = %+v", c.LastNews)
	}
	if len(c.Topics) != 21 {
		t.Fatalf("topics = %d", len(c.Topics))
	}
	first := c.Topics[0]
	if first.Title != "Apresentação do plano de ensino. Introdução à compilação." || first.StartDate != "2026-08-04" {
		t.Errorf("topic = %+v", first)
	}
	if !strings.Contains(first.HTML, `href="https://forms.gle/`) || !strings.Contains(first.HTML, `target="_blank"`) || strings.Contains(first.HTML, "style=") {
		t.Errorf("topic html not sanitized as expected: %s", first.HTML)
	}
	tasks := 0
	for _, tp := range c.Topics {
		for _, m := range tp.Materials {
			if m.Kind == "task" {
				tasks++
			}
		}
	}
	if tasks != 2 {
		t.Errorf("task materials = %d", tasks)
	}
}

func TestParseClassOverviewFiles(t *testing.T) {
	c, err := ParseClassOverview(doc(t, "turma_principal_com_arquivos.html"), "85DFE8650ADD2C68233863FB1676975A2A4034C9")
	if err != nil {
		t.Fatal(err)
	}
	m := c.Topics[0].Materials
	if len(m) != 1 || m[0] != (Material{Kind: "file", Title: "Gestão e Estrutura Organizacional", ID: "D7CC7FAF766DB59B2D63AF1FD3DDEFB8CD4B0E26"}) {
		t.Errorf("materials = %+v", m)
	}
	if c.Topics[0].HTML != "" {
		t.Errorf("topic with only files should have empty html, got %q", c.Topics[0].HTML)
	}
	var holiday *Topic
	for i := range c.Topics {
		if strings.HasPrefix(c.Topics[i].Title, "Não Haverá Aula - Feriado") {
			holiday = &c.Topics[i]
		}
	}
	if holiday == nil || holiday.StartDate == "" || holiday.StartDate != holiday.EndDate {
		t.Errorf("single-date topic = %+v", holiday)
	}
	if c.WorkloadHours != 60 || c.Name != "EMPREENDEDORISMO" {
		t.Errorf("header = %+v", c)
	}
}

func TestParseAttendance(t *testing.T) {
	a, err := ParseAttendance(doc(t, "turma_frequencia.html"))
	if err != nil {
		t.Fatal(err)
	}
	if len(a.Records) != 12 || a.Records[6] != (AttendanceRecord{Date: "2026-09-15", Status: "absent", Absences: 4}) || a.Records[1].Status != "unregistered" {
		t.Errorf("records = %+v", a.Records)
	}
	if a.Presences != 68 || a.LessonsWithRecord != 72 || a.LessonsByWorkload != 72 || a.PercentOfRecorded != 94 || a.PercentOfWorkload != 94 || a.TotalAbsences != 4 || a.MaxAbsences != 18 {
		t.Errorf("summary = %+v", a)
	}
}

func TestParseClassGrades(t *testing.T) {
	g, err := ParseClassGrades(doc(t, "turma_notas.html"))
	if err != nil {
		t.Fatal(err)
	}
	if len(g.Assessments) != 4 {
		t.Fatalf("assessments = %+v", g.Assessments)
	}
	if a := g.Assessments[0]; a.Group != "Unid. 1" || a.Label != "AV1" || a.Title != "Prova" || a.Weight != "1" || !eqF(a.Value, f(8.3)) || a.IsUnitTotal {
		t.Errorf("av1 = %+v", a)
	}
	if a := g.Assessments[3]; a.Label != "Nota" || !a.IsUnitTotal || !eqF(a.Value, f(2.8)) {
		t.Errorf("unit total = %+v", a)
	}
	if !g.Published {
		t.Error("grades should be published")
	}
	if g.Makeup != nil || g.Result != nil || *g.Absences != 4 || g.Situation != "REC" {
		t.Errorf("grades = %+v", g)
	}
}

func TestParseClassGradesNotPublished(t *testing.T) {
	g, err := ParseClassGrades(doc(t, "turma_notas_vazia.html"))
	if err != nil || g.Published || len(g.Assessments) != 0 {
		t.Errorf("got %+v, %v", g, err)
	}
}

func TestHHMM(t *testing.T) {
	for in, want := range map[string]string{"18:30": "18:30", "18:30h": "18:30", "8h05": "08:05", "": ""} {
		if got := hhmm(in); got != want {
			t.Errorf("hhmm(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestParseTasks(t *testing.T) {
	tasks, err := ParseTasks(doc(t, "turma_tarefas.html"))
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) != 2 {
		t.Fatalf("tasks = %+v", tasks)
	}
	want := Task{Title: "AV1 - prática", Description: "Poste aqui os seus arquivos (flex e bison) do exercício prático.",
		Start: "2026-09-29T19:00", End: "2026-09-29T22:10", Submissions: 14, Corrected: true, CanSubmit: true}
	if tasks[1] != want {
		t.Errorf("task = %+v", tasks[1])
	}
	if tasks[0].Corrected || tasks[0].CanSubmit || tasks[0].End != "2026-10-06T21:53" {
		t.Errorf("task = %+v", tasks[0])
	}
}

func TestParseFilesNewsEvaluations(t *testing.T) {
	files, _ := ParseFiles(doc(t, "turma_arquivos.html"))
	if len(files) < 5 || files[0].ID != "3641653" || files[0].Title != "Empreendedorismo, Papel do empreendedor" || !strings.HasPrefix(files[0].Topic, "Atividades Administrativas") {
		t.Errorf("files = %+v", files)
	}
	news, _ := ParseNewsList(doc(t, "turma_noticias.html"))
	if len(news) != 1 || news[0] != (NewsItem{ID: "35917358", Title: "Aula de 20/10 cancelada", Date: "2026-10-10"}) {
		t.Errorf("news = %+v", news)
	}
	n, err := ParseNewsDetail(doc(t, "turma_noticia_detalhe.html"))
	if err != nil || n.ID != "35917358" || n.Date != "2026-10-10T17:17" || n.Title != "Aula de 20/10 cancelada" || !strings.Contains(n.HTML, "<p>Não haverá aula") {
		t.Errorf("news detail = %+v, %v", n, err)
	}
	evals, _ := ParseEvaluations(doc(t, "turma_avaliacoes.html"))
	if len(evals) != 1 || evals[0] != (Evaluation{ID: "35429303", Date: "2026-09-29", Time: "18:30", Description: "1ª Avaliação"}) {
		t.Errorf("evals = %+v", evals)
	}
}

func TestParseSchedule(t *testing.T) {
	got := parseSchedule("24M12 6T3")
	want := []Slot{{2, "M", 1}, {2, "M", 2}, {4, "M", 1}, {4, "M", 2}, {6, "T", 3}}
	if len(got) != len(want) {
		t.Fatalf("got %+v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("slot %d = %+v, want %+v", i, got[i], want[i])
		}
	}
}

func TestSanitizeStripsScripts(t *testing.T) {
	out := sanitize(`<p onclick="x()">oi<script>alert(1)</script><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)></p>`)
	for _, bad := range []string{"script", "onclick", "javascript:", "onerror"} {
		if strings.Contains(out, bad) {
			t.Errorf("sanitize kept %q: %s", bad, out)
		}
	}
}
