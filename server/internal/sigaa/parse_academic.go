package sigaa

import (
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

// Parsers for portal pages outside the turma virtual: academic calendar,
// past classes, complementary activities and the course forum.

var (
	calendarPeriodRe = regexp.MustCompile(`(\d{4})\s*[./]\s*(\d)`)
	pastClassRe      = regexp.MustCompile(`^(\S+)\s+-\s+(.+)$`)
	hoursRe          = regexp.MustCompile(`([\d.,]+)\s*h`)
	authorSuffixRe   = regexp.MustCompile(`\s*-\s*\d*\s*$`)
)

// ParseCalendarList parses "Consulta de Calendário Acadêmico": a listagem with
// one "Calendário 2026.2" section row followed by its calendars.
func ParseCalendarList(doc *goquery.Document) ([]CalendarRef, error) {
	refs := []CalendarRef{}
	table := doc.Find("table.listagem").FilterFunction(func(_ int, t *goquery.Selection) bool {
		return clean(t.Find("caption").Text()) == "Lista de Calendários"
	}).First()
	if table.Length() == 0 {
		return refs, parseErr("calendarios", "listagem not found")
	}
	period := ""
	table.Find("tr").Each(func(_ int, tr *goquery.Selection) {
		if tr.HasClass("secao") {
			if m := calendarPeriodRe.FindStringSubmatch(tr.Text()); m != nil {
				period = m[1] + "." + m[2]
			}
			return
		}
		l, ok := parseJSFLink(tr.Find("a[onclick]").AttrOr("onclick", ""))
		if !ok || l.Param("id") == "" {
			return
		}
		refs = append(refs, CalendarRef{ID: l.Param("id"), Period: period, Name: clean(tr.Find("td").First().Text())})
	})
	return refs, nil
}

// ParseCalendar parses "Visualização do Calendário Acadêmico": a two-column
// table.visualizacao (th label, td "De dd/mm/aaaa até dd/mm/aaaa"), split into
// sections by td.subFormulario rows.
func ParseCalendar(doc *goquery.Document) (AcademicCalendar, error) {
	cal := AcademicCalendar{Sections: []CalendarSection{}}
	table := doc.Find("table.visualizacao").First()
	if table.Length() == 0 {
		return cal, parseErr("calendario", "table.visualizacao not found")
	}
	current := CalendarSection{Title: "Geral", Events: []CalendarEvent{}}
	flush := func() {
		if len(current.Events) > 0 {
			cal.Sections = append(cal.Sections, current)
		}
	}
	table.Find("tr").Each(func(_ int, tr *goquery.Selection) {
		if sub := tr.ChildrenFiltered("td.subFormulario"); sub.Length() > 0 {
			flush()
			current = CalendarSection{Title: clean(sub.Text()), Events: []CalendarEvent{}}
			return
		}
		th, td := tr.ChildrenFiltered("th"), tr.ChildrenFiltered("td")
		if th.Length() == 0 || td.Length() == 0 {
			return
		}
		label := strings.TrimSuffix(clean(th.Text()), ":")
		value := clean(td.First().Text())
		switch label {
		case "Ano/Semestre":
			if m := calendarPeriodRe.FindStringSubmatch(value); m != nil {
				cal.Period = m[1] + "." + m[2]
			}
			return
		case "Vigente":
			cal.Current = value == "Sim"
			return
		}
		dates := dateRe.FindAllString(value, 2)
		if len(dates) == 0 {
			return // "Não Definido", unidade, períodos "2026-4"…
		}
		ev := CalendarEvent{Label: label, Start: isoDate(dates[0]), End: isoDate(dates[len(dates)-1])}
		if label == "Período Letivo" {
			cal.Start, cal.End = ev.Start, ev.End
		}
		current.Events = append(current.Events, ev)
	})
	flush()
	if cal.Period == "" {
		return cal, parseErr("calendario", "Ano/Semestre not found")
	}
	return cal, nil
}

// ParsePastClasses parses /sigaa/portais/discente/turmas.jsf: rows grouped by
// td.periodo, each with "CODE - NAME", turma, "60h", schedule and an access link.
func ParsePastClasses(doc *goquery.Document) ([]PastClass, error) {
	classes := []PastClass{}
	table := doc.Find("table.listagem").FilterFunction(func(_ int, t *goquery.Selection) bool {
		return strings.Contains(t.Find("caption").Text(), "Turmas")
	}).First()
	if table.Length() == 0 {
		return classes, parseErr("turmas-anteriores", "listagem not found")
	}
	period := ""
	table.Find("tr").Each(func(_ int, tr *goquery.Selection) {
		if p := tr.Find("td.periodo"); p.Length() > 0 {
			period = clean(p.Text())
			return
		}
		tds := tr.ChildrenFiltered("td")
		l, ok := parseJSFLink(tr.Find("a[onclick]").AttrOr("onclick", ""))
		if tds.Length() < 4 || !ok || !classIDRe.MatchString(l.Param("frontEndIdTurma")) {
			return
		}
		c := PastClass{ID: l.Param("frontEndIdTurma"), Period: period, Group: clean(tds.Eq(1).Text())}
		title := clean(tds.Eq(0).Text())
		if m := pastClassRe.FindStringSubmatch(title); m != nil {
			c.Code, c.Name = m[1], m[2]
		} else {
			c.Name = title
		}
		c.WorkloadHours = intOr0(tds.Eq(2).Text())
		schedule := clean(tds.Eq(3).Text())
		if dates := dateRe.FindAllString(schedule, 2); len(dates) == 2 {
			c.StartDate, c.EndDate = isoDate(dates[0]), isoDate(dates[1])
		}
		if i := strings.Index(schedule, "("); i >= 0 {
			schedule = schedule[:i]
		}
		c.Schedule = strings.TrimSpace(schedule)
		classes = append(classes, c)
	})
	return classes, nil
}

// ParseComplementaryActivities parses "Registro da Atividade Autônoma". The
// table uses th cells for data; td.subFormulario rows start a category and a
// tr.caixaCinza row closes it with the approved total.
func ParseComplementaryActivities(doc *goquery.Document) (ComplementaryActivities, error) {
	out := ComplementaryActivities{Groups: []ComplementaryGroup{}}
	table := doc.Find("table.listagem").FilterFunction(func(_ int, t *goquery.Selection) bool {
		return strings.Contains(t.Find("caption").Text(), "Atividades Autônomas")
	}).First()
	if table.Length() == 0 {
		if strings.Contains(doc.Text(), "Registro da Atividade Autônoma") {
			return out, nil // no requests yet: SIGAA omits the table
		}
		return out, parseErr("atividades-autonomas", "listagem not found")
	}
	var group *ComplementaryGroup
	table.Find("tr").Each(func(_ int, tr *goquery.Selection) {
		if sub := tr.ChildrenFiltered("td.subFormulario"); sub.Length() > 0 {
			out.Groups = append(out.Groups, ComplementaryGroup{Category: clean(sub.Text()), Activities: []ComplementaryActivity{}})
			group = &out.Groups[len(out.Groups)-1]
			return
		}
		cells := tr.ChildrenFiltered("th")
		if group == nil {
			return
		}
		if tr.HasClass("caixaCinza") {
			cells.Each(func(_ int, th *goquery.Selection) {
				if v := hours(th.Text()); v > 0 {
					group.ApprovedHours = v
				}
			})
			return
		}
		if cells.Length() < 5 {
			return
		}
		group.Activities = append(group.Activities, ComplementaryActivity{
			Date:        isoDate(cells.Eq(0).Text()),
			Type:        clean(cells.Eq(1).Text()),
			Description: clean(cells.Eq(2).Text()),
			Hours:       hours(cells.Eq(3).Text()),
			Status:      clean(cells.Eq(4).Text()),
		})
	})
	return out, nil
}

// hours parses "624.0h" or "2,5h".
func hours(s string) float64 {
	if m := hoursRe.FindStringSubmatch(s); m != nil {
		if v := number(m[1]); v != nil {
			return *v
		}
	}
	return 0
}

// ParseForumTopics parses the course forum topic list (also used by the portal box).
func ParseForumTopics(doc *goquery.Document) ([]ForumTopic, error) {
	topics := []ForumTopic{}
	table := doc.Find("table").FilterFunction(func(_ int, t *goquery.Selection) bool {
		return t.Find("th").FilterFunction(func(_ int, th *goquery.Selection) bool {
			return clean(th.Text()) == "Respostas"
		}).Length() > 0
	}).First()
	table.Find("tr.linhaPar, tr.linhaImpar").Each(func(_ int, tr *goquery.Selection) {
		tds := tr.ChildrenFiltered("td")
		if tds.Length() < 4 {
			return
		}
		date := isoDate(tds.Eq(3).Text())
		if dt := isoDateTimes(tds.Eq(3).Text()); len(dt) > 0 {
			date = dt[0]
		}
		l, _ := parseJSFLink(tds.Eq(0).Find("a[onclick]").AttrOr("onclick", ""))
		topics = append(topics, ForumTopic{
			ID:      l.Param("idForumMensagem"),
			Title:   clean(tds.Eq(0).Text()),
			Author:  clean(tds.Eq(1).Text()),
			Replies: intOr0(tds.Eq(2).Text()),
			Date:    date,
		})
	})
	return topics, nil
}

// ParseForumThread parses a course forum topic ("Discussão sobre …"). Posts come
// in pairs of rows: tr.bg-claro (date, "Postado por: NAME - matrícula") and the
// body row. The author's matrícula is dropped.
func ParseForumThread(doc *goquery.Document, id string) (ForumThread, error) {
	t := ForumThread{ID: id, Posts: []ForumPost{}}
	h2 := clean(doc.Find("#conteudo h2").First().Text())
	i := strings.Index(h2, "Discussão sobre")
	if i < 0 {
		return t, parseErr("forum-topico", "title not found")
	}
	t.Title = strings.TrimSpace(strings.TrimPrefix(h2[i:], "Discussão sobre"))
	doc.Find("tr.bg-claro").Each(func(_ int, head *goquery.Selection) {
		tds := head.ChildrenFiltered("td")
		if tds.Length() < 2 {
			return
		}
		date := isoDate(tds.Eq(0).Text())
		if dt := isoDateTimes(tds.Eq(0).Text()); len(dt) > 0 {
			date = dt[0]
		}
		author := strings.TrimSpace(strings.TrimPrefix(clean(tds.Eq(1).Text()), "Postado por:"))
		body := head.Next().ChildrenFiltered("td").Last()
		html, _ := body.Html()
		t.Posts = append(t.Posts, ForumPost{Date: date, Author: authorSuffixRe.ReplaceAllString(author, ""), HTML: sanitize(html)})
	})
	return t, nil
}
