package sigaa

import (
	"regexp"
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

var (
	percentWidthRe = regexp.MustCompile(`width:\s*([\d.]+)%`)
	periodRe       = regexp.MustCompile(`^\d{4}\.\d$`)
	classPeriodRe  = regexp.MustCompile(`\s*\((\d{4}\.\d)\)\s*$`)
	daysLeftRe     = regexp.MustCompile(`\(\d+ dias?\)`)
)

// ParsePortal parses /sigaa/portais/discente/discente.jsf.
func ParsePortal(doc *goquery.Document) (Dashboard, error) {
	d := Dashboard{
		Indices:    []Index{},
		Classes:    []ClassSummary{},
		Activities: []Activity{},
		Updates:    []ClassUpdate{},
		Forum:      []ForumTopic{},
	}

	info := doc.Find("#info-usuario")
	d.Profile.Name = clean(info.Find(".usuario span").First().Text())
	d.Profile.CurrentPeriod = clean(info.Find(".periodo-atual strong").Text())
	d.Profile.Campus = clean(info.Find(".unidade").Text())
	if d.Profile.Name == "" {
		return d, parseErr("portal", "student name not found")
	}

	parseInstitutional(doc, &d)
	parseProgress(doc, &d)
	parseClasses(doc, &d)
	parseActivities(doc, &d)
	parseUpdates(doc, &d)
	parseForum(doc, &d)
	return d, nil
}

func parseInstitutional(doc *goquery.Document, d *Dashboard) {
	box := doc.Find("#agenda-docente").FilterFunction(func(_ int, s *goquery.Selection) bool {
		return strings.Contains(s.Find("h4").Text(), "Dados Institucionais")
	})
	box.Find("tr").Each(func(_ int, tr *goquery.Selection) {
		tds := tr.ChildrenFiltered("td")
		if tds.Length() != 2 {
			return
		}
		label, value := clean(tds.Eq(0).Text()), clean(tds.Eq(1).Text())
		switch label {
		case "Matrícula:":
			d.Profile.Matricula = value
		case "Curso:":
			d.Profile.Course = value
		case "Nível:":
			d.Profile.Level = value
		case "Status:":
			d.Profile.Status = value
		case "E-Mail:":
			d.Profile.Email = value
		case "Entrada:":
			d.Profile.EntryPeriod = value
		}
	})
	box.Find("acronym").Each(func(_ int, a *goquery.Selection) {
		code := strings.TrimSuffix(clean(a.Text()), ":")
		value := number(clean(a.ParentFiltered("td").Next().Text()))
		if code == "" || value == nil {
			return
		}
		d.Indices = append(d.Indices, Index{Code: code, Description: a.AttrOr("title", ""), Value: *value})
	})
}

func parseProgress(doc *goquery.Document, d *Dashboard) {
	doc.Find("td").Each(func(_ int, td *goquery.Selection) {
		label := clean(td.Text())
		if !strings.HasPrefix(label, "CH. ") || td.Children().Length() > 0 {
			return
		}
		v := intOr0(td.Next().Text())
		switch label {
		case "CH. Obrigatória Pendente":
			d.Progress.MandatoryPendingHours = v
		case "CH. Optativa Pendente":
			d.Progress.OptionalPendingHours = v
		case "CH. Total Currículo":
			d.Progress.TotalCurriculumHours = v
		case "CH. Complementar Pendente":
			d.Progress.ComplementaryPendingHours = v
		}
	})
	// The bar's width carries the precise percentage; the label is rounded.
	doc.Find("td").EachWithBreak(func(_ int, td *goquery.Selection) bool {
		if !strings.Contains(td.Text(), "Integralizado") || td.Children().Length() > 0 {
			return true
		}
		bar := td.Parent().Prev().Find("div")
		if m := percentWidthRe.FindStringSubmatch(bar.AttrOr("style", "")); m != nil {
			d.Progress.Percent, _ = strconv.ParseFloat(m[1], 64)
		} else if v := number(strings.TrimSuffix(strings.Fields(clean(td.Text()))[0], "%")); v != nil {
			d.Progress.Percent = *v
		}
		return false
	})
}

func parseClasses(doc *goquery.Document, d *Dashboard) {
	table := doc.Find("table").FilterFunction(func(_ int, t *goquery.Selection) bool {
		return clean(t.Find("thead th").First().Text()) == "Componente Curricular"
	}).First()
	period := ""
	table.Find("tbody > tr").Each(func(_ int, tr *goquery.Selection) {
		tds := tr.ChildrenFiltered("td")
		if tds.Length() == 1 {
			if t := clean(tds.Text()); periodRe.MatchString(t) {
				period = t
			}
			return
		}
		desc := tr.ChildrenFiltered("td.descricao")
		if desc.Length() == 0 {
			return
		}
		onclick := desc.Find("a[onclick]").AttrOr("onclick", "")
		l, ok := parseJSFLink(onclick)
		if !ok || l.Param("frontEndIdTurma") == "" {
			return
		}
		infos := tr.ChildrenFiltered("td.info")
		schedule := clean(infos.Eq(1).Text())
		code, start, end := schedule, "", ""
		if i := strings.Index(schedule, "("); i >= 0 {
			code = strings.TrimSpace(schedule[:i])
			dates := dateRe.FindAllString(schedule[i:], 2)
			if len(dates) == 2 {
				start, end = isoDate(dates[0]), isoDate(dates[1])
			}
		}
		d.Classes = append(d.Classes, ClassSummary{
			ID:        l.Param("frontEndIdTurma"),
			Name:      clean(desc.Find("a").Text()),
			Period:    period,
			Location:  clean(infos.Eq(0).Text()),
			Schedule:  code,
			Slots:     parseSchedule(code),
			StartDate: start,
			EndDate:   end,
		})
	})
}

func parseActivities(doc *goquery.Document, d *Dashboard) {
	doc.Find("#avaliacao-portal tbody > tr").Each(func(_ int, tr *goquery.Selection) {
		tds := tr.ChildrenFiltered("td")
		if tds.Length() < 3 {
			return
		}
		small := tds.Eq(2).Find("small")
		kind := strings.TrimSuffix(clean(small.Find("strong").Text()), ":")
		// "<class name><br/><strong>Kind:</strong> title" — split on the <br>.
		html, _ := small.Html()
		className, title := "", ""
		if parts := strings.SplitN(html, "<br/>", 2); len(parts) == 2 {
			className = clean(textOf(parts[0]))
			title = clean(strings.TrimPrefix(clean(textOf(parts[1])), kind+":"))
		}
		d.Activities = append(d.Activities, Activity{
			Date:      isoDate(daysLeftRe.ReplaceAllString(tds.Eq(1).Text(), "")),
			ClassName: className,
			Kind:      kind,
			Title:     title,
			Past:      tds.Eq(1).Find(`font[color="gray"]`).Length() > 0,
		})
	})
}

func parseUpdates(doc *goquery.Document, d *Dashboard) {
	doc.Find("#atualizacoes-turma .rotator > table").Each(func(_ int, t *goquery.Selection) {
		rows := t.Find("tr")
		if rows.Length() < 2 {
			return
		}
		className := classPeriodRe.ReplaceAllString(clean(rows.Eq(0).Find("a").Text()), "")
		d.Updates = append(d.Updates, ClassUpdate{
			Date:        isoDate(rows.Eq(0).Text()),
			ClassName:   className,
			Description: clean(rows.Eq(1).Text()),
		})
	})
}

func parseForum(doc *goquery.Document, d *Dashboard) {
	d.Forum, _ = ParseForumTopics(doc)
}

// textOf extracts text from an HTML fragment.
func textOf(fragment string) string {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(fragment))
	if err != nil {
		return ""
	}
	return doc.Text()
}
