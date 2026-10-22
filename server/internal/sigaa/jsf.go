package sigaa

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

// Page is a parsed SIGAA HTML response.
type Page struct {
	URL  *url.URL
	Doc  *goquery.Document
	HTML string
}

// Link is a JSF command link: clicking it calls jsfcljs(form, params, target),
// which adds params as hidden inputs to the form and submits it.
type Link struct {
	FormID string
	Params [][2]string
}

// Param returns the value of a link parameter, or "".
func (l Link) Param(name string) string {
	for _, kv := range l.Params {
		if kv[0] == name {
			return kv[1]
		}
	}
	return ""
}

var (
	jsfcljsRe = regexp.MustCompile(`jsfcljs\(document\.getElementById\('([^']+)'\),\{(.*?)\},'[^']*'\)`)
	jsKVRe    = regexp.MustCompile(`'([^']*)'\s*:\s*'([^']*)'`)
)

// parseJSFLink extracts the form and parameters from an onclick handler.
func parseJSFLink(onclick string) (Link, bool) {
	m := jsfcljsRe.FindStringSubmatch(onclick)
	if m == nil {
		return Link{}, false
	}
	l := Link{FormID: m[1]}
	for _, kv := range jsKVRe.FindAllStringSubmatch(m[2], -1) {
		l.Params = append(l.Params, [2]string{kv[1], kv[2]})
	}
	return l, true
}

// FindLink returns the first JSF link whose element and parsed link satisfy match.
func (p *Page) FindLink(match func(el *goquery.Selection, l Link) bool) (Link, bool) {
	var found Link
	ok := false
	p.Doc.Find("[onclick]").EachWithBreak(func(_ int, el *goquery.Selection) bool {
		onclick, _ := el.Attr("onclick")
		l, isJSF := parseJSFLink(onclick)
		if isJSF && match(el, l) {
			found, ok = l, true
			return false
		}
		return true
	})
	return found, ok
}

// FindLinkByText finds a JSF link in formID whose visible text equals text.
func (p *Page) FindLinkByText(formID, text string) (Link, bool) {
	return p.FindLink(func(el *goquery.Selection, l Link) bool {
		return l.FormID == formID && clean(el.Text()) == text
	})
}

// FindLinkByParam finds a JSF link that carries param=value.
func (p *Page) FindLinkByParam(param, value string) (Link, bool) {
	return p.FindLink(func(_ *goquery.Selection, l Link) bool {
		return l.Param(param) == value
	})
}

func (p *Page) form(id string) *goquery.Selection {
	return p.Doc.Find("form").FilterFunction(func(_ int, s *goquery.Selection) bool {
		v, _ := s.Attr("id")
		return v == id
	}).First()
}

// formRequest builds the POST a browser would send when the link is clicked:
// the form's non-button inputs plus the link parameters.
func (p *Page) formRequest(l Link) (action string, values url.Values, ok bool) {
	f := p.form(l.FormID)
	if f.Length() == 0 {
		return "", nil, false
	}
	action, _ = f.Attr("action")
	values = url.Values{}
	f.Find("input").Each(func(_ int, in *goquery.Selection) {
		name, has := in.Attr("name")
		if !has || name == "" {
			return
		}
		switch strings.ToLower(in.AttrOr("type", "text")) {
		case "submit", "button", "image", "reset", "file":
			return
		case "checkbox", "radio":
			if _, checked := in.Attr("checked"); !checked {
				return
			}
		}
		values.Set(name, in.AttrOr("value", ""))
	})
	// HTML5 parsing can hoist inputs out of malformed forms; these two are what
	// JSF needs to route the postback, so make sure they are present.
	if values.Get(l.FormID) == "" {
		values.Set(l.FormID, l.FormID)
	}
	if values.Get("javax.faces.ViewState") == "" {
		if vs, ok := p.Doc.Find(`input[name="javax.faces.ViewState"]`).First().Attr("value"); ok {
			values.Set("javax.faces.ViewState", vs)
		}
	}
	for _, kv := range l.Params {
		values.Set(kv[0], kv[1])
	}
	return action, values, true
}

var wsRe = regexp.MustCompile(`\s+`)

// clean collapses whitespace (including &nbsp;) and trims.
func clean(s string) string {
	return strings.TrimSpace(wsRe.ReplaceAllString(strings.ReplaceAll(s, " ", " "), " "))
}
