package sigaa

import (
	"regexp"
	"strconv"
	"strings"

	"github.com/microcosm-cc/bluemonday"
)

var (
	dateRe     = regexp.MustCompile(`(\d{2})/(\d{2})/(\d{4})`)
	dateTimeRe = regexp.MustCompile(`(\d{2})/(\d{2})/(\d{4})\D{1,6}(\d{2})[:h](\d{2})`)
	intRe      = regexp.MustCompile(`-?\d+`)
	scheduleRe = regexp.MustCompile(`\b([2-7]+)([MTN])([1-9]+)\b`)
)

// isoDate converts the first "dd/mm/yyyy" in s to "yyyy-mm-dd", or "".
func isoDate(s string) string {
	m := dateRe.FindStringSubmatch(s)
	if m == nil {
		return ""
	}
	return m[3] + "-" + m[2] + "-" + m[1]
}

// isoDateTimes converts every "dd/mm/yyyy[ às] hh:mm|hhhmm" in s to "yyyy-mm-ddThh:mm".
func isoDateTimes(s string) []string {
	var out []string
	for _, m := range dateTimeRe.FindAllStringSubmatch(s, -1) {
		out = append(out, m[3]+"-"+m[2]+"-"+m[1]+"T"+m[4]+":"+m[5])
	}
	return out
}

// number parses "9,3", "1416.91", "--" or "" (nil).
func number(s string) *float64 {
	s = strings.TrimSpace(strings.ReplaceAll(s, ",", "."))
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return nil
	}
	return &v
}

// integer returns the first integer in s, or nil.
func integer(s string) *int {
	m := intRe.FindString(s)
	if m == "" {
		return nil
	}
	v, err := strconv.Atoi(m)
	if err != nil {
		return nil
	}
	return &v
}

func intOr0(s string) int {
	if v := integer(s); v != nil {
		return *v
	}
	return 0
}

// parseSchedule reads SIGAA schedule codes like "3N1234" or "24M12 6T34".
// Each group is <days><shift><slot indexes>.
func parseSchedule(code string) []Slot {
	slots := []Slot{}
	for _, m := range scheduleRe.FindAllStringSubmatch(code, -1) {
		for _, d := range m[1] {
			for _, i := range m[3] {
				slots = append(slots, Slot{Day: int(d - '0'), Shift: m[2], Index: int(i - '0')})
			}
		}
	}
	return slots
}

// sanitizer cleans teacher-authored HTML (topics, news) before it reaches the browser.
var sanitizer = func() *bluemonday.Policy {
	p := bluemonday.UGCPolicy()
	p.AllowURLSchemes("http", "https", "mailto")
	p.RequireNoReferrerOnLinks(true)
	p.AddTargetBlankToFullyQualifiedLinks(true)
	return p
}()

func sanitize(html string) string {
	return strings.TrimSpace(sanitizer.Sanitize(html))
}
