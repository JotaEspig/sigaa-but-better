package sigaa

import (
	"strings"

	"github.com/PuerkitoBio/goquery"
)

// ParseGradesReport parses the "Relatório de Notas do Aluno" (Consultar Minhas Notas).
// Columns differ between semesters and curricula, so they are mapped by header text.
func ParseGradesReport(doc *goquery.Document) (GradesReport, error) {
	report := GradesReport{Semesters: []GradeSemester{}}
	tables := doc.Find("table.tabelaRelatorio")
	if tables.Length() == 0 {
		if strings.Contains(doc.Text(), "Relatório de Notas") {
			return report, nil
		}
		return report, parseErr("notas", "no tabelaRelatorio")
	}
	tables.Each(func(_ int, t *goquery.Selection) {
		sem := GradeSemester{Period: clean(t.Find("caption").Text()), UnitLabels: []string{}, Rows: []GradeRow{}}
		var cols []string
		t.Find("thead th").Each(func(_ int, th *goquery.Selection) {
			label := clean(th.Text())
			cols = append(cols, label)
			if isUnitHeader(label) {
				sem.UnitLabels = append(sem.UnitLabels, label)
			}
		})
		t.Find("tbody tr").Each(func(_ int, tr *goquery.Selection) {
			tds := tr.ChildrenFiltered("td")
			if tds.Length() != len(cols) {
				return
			}
			row := GradeRow{Units: []*float64{}}
			tds.Each(func(i int, td *goquery.Selection) {
				v := clean(td.Text())
				switch label := cols[i]; {
				case label == "Código":
					row.Code = v
				case label == "Disciplina":
					row.Name = v
				case isUnitHeader(label):
					row.Units = append(row.Units, number(v))
				case strings.HasPrefix(label, "Recupera"):
					row.Recovery = number(v)
				case label == "Resultado":
					row.Result = number(v)
				case label == "Faltas":
					row.Absences = integer(v)
				case strings.HasPrefix(label, "Situa"):
					if v != "--" {
						row.Situation = v
					}
				}
			})
			sem.Rows = append(sem.Rows, row)
		})
		report.Semesters = append(report.Semesters, sem)
	})
	return report, nil
}

func isUnitHeader(label string) bool {
	return strings.HasPrefix(label, "Unidade") || strings.HasPrefix(label, "Unid.")
}
