package sigaa

import (
	"regexp"
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

var (
	classTitleRe = regexp.MustCompile(`\((\d+)h\)\s*\((\d{4}\.\d)\)`)
	lessonsRe    = regexp.MustCompile(`Aulas \(Ministradas/Total\):\s*(\d+)\s*/\s*(\d+)`)
	// "Título (dd/mm/aaaa - dd/mm/aaaa)" or, for single-day topics, "Título (dd/mm/aaaa)".
	topicTitleRe   = regexp.MustCompile(`^(.*?)\s*\((\d{2}/\d{2}/\d{4})(?:\s*-\s*(\d{2}/\d{2}/\d{4}))?\)$`)
	lastNewsHeadRe = regexp.MustCompile(`^Última Notícia\s*(.*?)\s*-\s*(\d{2}/\d{2}/\d{4} \d{2}:\d{2})$`)
)

// ParseClassOverview parses the turma virtual main page (/sigaa/ava/index.jsf).
func ParseClassOverview(doc *goquery.Document, id string) (ClassOverview, error) {
	c := ClassOverview{ID: id, Topics: []Topic{}}
	c.Code = strings.TrimSpace(strings.TrimSuffix(clean(doc.Find("#linkCodigoTurma").Text()), "-"))
	c.Name = clean(doc.Find("#linkNomeTurma").Text())
	if c.Name == "" {
		return c, parseErr("turma", "class name not found")
	}
	schedule := doc.Find("#linkNomeTurma").AttrOr("title", "")
	if i := strings.Index(schedule, "("); i >= 0 {
		schedule = schedule[:i]
	}
	c.Schedule = strings.TrimSpace(schedule)

	doc.Find("a.linkTurma").EachWithBreak(func(_ int, a *goquery.Selection) bool {
		l, ok := parseJSFLink(a.AttrOr("onclick", ""))
		if !ok || l.Param("frontEndIdTurma") != id {
			return true
		}
		if m := classTitleRe.FindStringSubmatch(clean(a.Text())); m != nil {
			c.WorkloadHours, _ = strconv.Atoi(m[1])
			c.Period = m[2]
		}
		return false
	})

	if m := lessonsRe.FindStringSubmatch(clean(doc.Text())); m != nil {
		c.LessonsTaught, _ = strconv.Atoi(m[1])
		c.LessonsTotal, _ = strconv.Atoi(m[2])
	}

	if ln := doc.Find("#ultimaNoticia"); ln.Length() > 0 {
		if m := lastNewsHeadRe.FindStringSubmatch(clean(ln.Find("h4").Text())); m != nil {
			html, _ := ln.Find(".conteudoNoticia").Html()
			dt := isoDateTimes(m[2])
			c.LastNews = &NewsItem{Title: m[1], Date: dt[0], HTML: sanitize(html)}
		}
	}

	doc.Find(".topico-aula").Each(func(_ int, t *goquery.Selection) {
		c.Topics = append(c.Topics, parseTopic(t))
	})
	return c, nil
}

func parseTopic(t *goquery.Selection) Topic {
	title := t.Find(".titulo").Clone()
	title.Find("small").Remove()
	topic := Topic{Title: clean(title.Text()), Materials: []Material{}}
	if m := topicTitleRe.FindStringSubmatch(topic.Title); m != nil {
		end := m[3]
		if end == "" {
			end = m[2]
		}
		topic.Title, topic.StartDate, topic.EndDate = m[1], isoDate(m[2]), isoDate(end)
	}

	content := t.Find(".conteudotopico").Clone()
	content.Find("script, .drag_indicator").Remove()
	content.Find(".item").Each(func(_ int, item *goquery.Selection) {
		if m, ok := parseMaterial(item); ok {
			topic.Materials = append(topic.Materials, m)
		}
	}).Remove()
	html, _ := content.Html()
	// Topics often contain only empty <span>/<p> wrappers once items are gone.
	if clean(textOf(html)) != "" {
		topic.HTML = sanitize(html)
	}
	return topic
}

func parseMaterial(item *goquery.Selection) (Material, bool) {
	a := item.Find("a").First()
	title := clean(a.Text())
	if title == "" {
		return Material{}, false
	}
	if l, ok := parseJSFLink(a.AttrOr("onclick", "")); ok {
		for _, kv := range l.Params {
			if strings.Contains(kv[0], "Tarefa") {
				return Material{Kind: "task", Title: title}, true
			}
		}
		if id := l.Param("id"); id != "" {
			return Material{Kind: "file", Title: title, ID: id}, true
		}
		return Material{}, false
	}
	if href := a.AttrOr("href", ""); strings.HasPrefix(href, "http://") || strings.HasPrefix(href, "https://") {
		return Material{Kind: "link", Title: title, URL: href}, true
	}
	return Material{}, false
}

// listing finds the table.listing whose header contains th.
func listing(doc *goquery.Document, th string) *goquery.Selection {
	return doc.Find("table.listing").FilterFunction(func(_ int, t *goquery.Selection) bool {
		found := false
		t.Find("thead th").Each(func(_ int, h *goquery.Selection) {
			found = found || clean(h.Text()) == th
		})
		return found
	}).First()
}

var (
	presencesRe       = regexp.MustCompile(`Presenças Registradas:\s*(\d+)`)
	lessonsRecordedRe = regexp.MustCompile(`Número de Aulas com Registro de Frequência:\s*(\d+)`)
	percentRecordedRe = regexp.MustCompile(`Porcentagem de Frequência em relação as Aulas com Registro de Frequência:\s*([\d.,]+)\s*%`)
	lessonsWorkloadRe = regexp.MustCompile(`Número de Aulas definidas pela CH do Componente:\s*(\d+)`)
	percentWorkloadRe = regexp.MustCompile(`Porcentagem de Frequência em relação a CH:\s*([\d.,]+)\s*%`)
)

// ParseAttendance parses the turma virtual "Frequência" page.
func ParseAttendance(doc *goquery.Document) (Attendance, error) {
	a := Attendance{Records: []AttendanceRecord{}}
	if !strings.Contains(doc.Text(), "Mapa de Frequências") {
		return a, parseErr("frequencia", "not the attendance page")
	}
	listing(doc, "Situação").Find("tbody tr").Each(func(_ int, tr *goquery.Selection) {
		tds := tr.ChildrenFiltered("td")
		if tds.Length() < 2 {
			return
		}
		status := clean(tds.Eq(1).Text())
		r := AttendanceRecord{Date: isoDate(tds.Eq(0).Text())}
		switch {
		case status == "Presente":
			r.Status = "present"
		case strings.Contains(status, "Falta"):
			r.Status = "absent"
			r.Absences = intOr0(status)
		default:
			r.Status = "unregistered"
		}
		a.TotalAbsences += r.Absences
		a.Records = append(a.Records, r)
	})
	text := clean(doc.Text())
	find := func(re *regexp.Regexp) string {
		if m := re.FindStringSubmatch(text); m != nil {
			return m[1]
		}
		return ""
	}
	a.Presences = intOr0(find(presencesRe))
	a.LessonsWithRecord = intOr0(find(lessonsRecordedRe))
	a.LessonsByWorkload = intOr0(find(lessonsWorkloadRe))
	if v := number(find(percentRecordedRe)); v != nil {
		a.PercentOfRecorded = *v
	}
	if v := number(find(percentWorkloadRe)); v != nil {
		a.PercentOfWorkload = *v
	}
	// Regulamento: presença mínima de 75% da carga horária.
	a.MaxAbsences = a.LessonsByWorkload / 4
	return a, nil
}

// ParseClassGrades parses the turma virtual "Ver Notas" report, whose header has
// two rows: groups (Unid. 1 spanning AV1..Nota) and the assessments themselves.
func ParseClassGrades(doc *goquery.Document) (ClassGrades, error) {
	g := ClassGrades{Assessments: []Assessment{}}
	table := doc.Find("table.tabelaRelatorio").First()
	if table.Length() == 0 {
		if strings.Contains(doc.Text(), "Ainda não foram lançadas notas") {
			return g, nil
		}
		return g, parseErr("notas-turma", "no tabelaRelatorio")
	}
	g.Published = true
	headRows := table.Find("thead tr")
	var groups []string
	headRows.Eq(0).ChildrenFiltered("th").Each(func(_ int, th *goquery.Selection) {
		span, _ := strconv.Atoi(th.AttrOr("colspan", "1"))
		for i := 0; i < max(span, 1); i++ {
			groups = append(groups, clean(th.Text()))
		}
	})
	type sub struct{ label, id string }
	var subs []sub
	headRows.Eq(1).ChildrenFiltered("th").Each(func(_ int, th *goquery.Selection) {
		subs = append(subs, sub{clean(th.Text()), strings.TrimPrefix(th.AttrOr("id", ""), "aval_")})
	})
	hidden := func(prefix, id string) string {
		return doc.Find(`input[id="`+prefix+id+`"]`).AttrOr("value", "")
	}

	row := table.Find("tbody tr").First()
	row.ChildrenFiltered("td").Each(func(i int, td *goquery.Selection) {
		if i >= len(groups) {
			return
		}
		v := clean(td.Text())
		switch group := groups[i]; {
		case group == "Matrícula" || group == "Nome":
		case group == "Reposição" || strings.HasPrefix(group, "Recupera"):
			g.Makeup = number(v)
		case group == "Resultado":
			g.Result = number(v)
		case group == "Faltas":
			g.Absences = integer(v)
		case group == "Sit." || strings.HasPrefix(group, "Situa"):
			g.Situation = v
		default:
			a := Assessment{Group: group, Label: group, Value: number(v)}
			if i < len(subs) && subs[i].label != "" {
				a.Label = subs[i].label
				if id := subs[i].id; id != "" && id != "unid" {
					a.Title = hidden("denAval_", id)
					a.Weight = hidden("pesoAval_", id)
				}
				a.IsUnitTotal = subs[i].id == "unid"
			}
			g.Assessments = append(g.Assessments, a)
		}
	})
	return g, nil
}

// ParseTasks parses the turma virtual "Tarefas" page. Each task spans two rows:
// the data row and a description row.
func ParseTasks(doc *goquery.Document) ([]Task, error) {
	tasks := []Task{}
	table := listing(doc, "Período de Entrega")
	if table.Length() == 0 {
		return tasks, nil
	}
	rows := table.Find("tbody > tr")
	rows.Each(func(i int, tr *goquery.Selection) {
		tds := tr.ChildrenFiltered("td")
		if tds.Length() < 5 {
			return
		}
		t := Task{
			Title:       clean(tds.Eq(1).Text()),
			Graded:      clean(tds.Eq(3).Text()) == "Sim",
			Submissions: intOr0(tds.Eq(4).Text()),
			Corrected:   strings.Contains(tds.Eq(0).Find("img").AttrOr("src", ""), "accept.png"),
			CanSubmit:   tr.Find(`a[title="Enviar tarefa"]`).Length() > 0,
		}
		if dts := isoDateTimes(tds.Eq(2).Text()); len(dts) == 2 {
			t.Start, t.End = dts[0], dts[1]
		}
		if next := rows.Eq(i + 1); next.Length() > 0 && next.ChildrenFiltered("td").Length() == 1 {
			t.Description = clean(next.Text())
		}
		tasks = append(tasks, t)
	})
	return tasks, nil
}

// ParseFiles parses the turma virtual "Arquivos" page.
func ParseFiles(doc *goquery.Document) ([]FileItem, error) {
	files := []FileItem{}
	listing(doc, "Tópico de Aula").Find("tbody tr").Each(func(_ int, tr *goquery.Selection) {
		tds := tr.ChildrenFiltered("td")
		l, ok := parseJSFLink(tr.Find("a[onclick]").AttrOr("onclick", ""))
		if tds.Length() < 4 || !ok || l.Param("id") == "" {
			return
		}
		files = append(files, FileItem{
			ID:          l.Param("id"),
			Title:       clean(tds.Eq(0).Text()),
			Description: clean(tds.Eq(1).Text()),
			Topic:       clean(tds.Eq(2).Text()),
		})
	})
	return files, nil
}

// ParseNewsList parses the turma virtual "Notícias" page.
func ParseNewsList(doc *goquery.Document) ([]NewsItem, error) {
	news := []NewsItem{}
	table := listing(doc, "Data")
	table.Find("tbody tr").Each(func(_ int, tr *goquery.Selection) {
		tds := tr.ChildrenFiltered("td")
		l, ok := parseJSFLink(tr.Find("a[onclick]").AttrOr("onclick", ""))
		if tds.Length() < 2 || !ok {
			return
		}
		news = append(news, NewsItem{ID: l.Param("id"), Title: clean(tds.Eq(0).Text()), Date: isoDate(tds.Eq(1).Text())})
	})
	return news, nil
}

// ParseNewsDetail parses "Visualização de Notícia".
func ParseNewsDetail(doc *goquery.Document) (NewsItem, error) {
	fs := doc.Find("fieldset").FilterFunction(func(_ int, s *goquery.Selection) bool {
		return clean(s.Find("legend").Text()) == "Visualização de Notícia"
	}).First()
	if fs.Length() == 0 {
		return NewsItem{}, parseErr("noticia", "fieldset not found")
	}
	n := NewsItem{ID: fs.Find(`input[name="id"]`).AttrOr("value", "")}
	fs.Find("ul.form > li").Each(func(_ int, li *goquery.Selection) {
		switch clean(li.Find("label").Text()) {
		case "Título:":
			n.Title = clean(li.Find("span").Text())
		case "Data:":
			if dt := isoDateTimes(li.Text()); len(dt) > 0 {
				n.Date = dt[0]
			} else {
				n.Date = isoDate(li.Text())
			}
		}
	})
	html, _ := fs.Find(".conteudoNoticia").Html()
	n.HTML = sanitize(html)
	return n, nil
}

var hhmmRe = regexp.MustCompile(`(\d{1,2})[:h](\d{2})`)

// hhmm normalizes "18:30", "18:30h" or "18h30" to "18:30".
func hhmm(s string) string {
	m := hhmmRe.FindStringSubmatch(s)
	if m == nil {
		return ""
	}
	if len(m[1]) == 1 {
		m[1] = "0" + m[1]
	}
	return m[1] + ":" + m[2]
}

// ParseEvaluations parses the turma virtual "Avaliações" page.
func ParseEvaluations(doc *goquery.Document) ([]Evaluation, error) {
	evals := []Evaluation{}
	listing(doc, "Hora").Find("tbody tr").Each(func(_ int, tr *goquery.Selection) {
		tds := tr.ChildrenFiltered("td")
		if tds.Length() < 3 {
			return
		}
		l, _ := parseJSFLink(tr.Find("a[onclick]").AttrOr("onclick", ""))
		evals = append(evals, Evaluation{
			ID:          l.Param("id"),
			Date:        isoDate(tds.Eq(0).Text()),
			Time:        hhmm(tds.Eq(1).Text()),
			Description: clean(tds.Eq(2).Text()),
		})
	})
	return evals, nil
}
