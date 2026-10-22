package sigaa

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

// High-level, read-only operations. Each one holds c.mu for its whole request
// sequence because SIGAA keeps navigation state per session.

const classMenuForm = "formMenu"

// Dashboard parses the student portal.
func (c *Client) Dashboard(ctx context.Context) (Dashboard, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	page, err := c.get(ctx, portalPath)
	if err != nil {
		return Dashboard{}, err
	}
	return ParsePortal(page.Doc)
}

// Grades opens "Ensino > Consultar Minhas Notas".
func (c *Client) Grades(ctx context.Context) (GradesReport, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	page, err := c.portalMenu(ctx, actionGradesReport)
	if err != nil {
		return GradesReport{}, err
	}
	return ParseGradesReport(page.Doc)
}

// Transcript emits the official transcript PDF ("Emitir Histórico"). SIGAA
// registers an authentication code for every emission, so only call this on an
// explicit user request. The caller must close the response body.
func (c *Client) Transcript(ctx context.Context) (*http.Response, func(), error) {
	c.mu.Lock()
	resp, err := c.portalMenuRaw(ctx, actionTranscript)
	if err != nil {
		c.mu.Unlock()
		return nil, nil, err
	}
	if !strings.Contains(resp.Header.Get("Content-Type"), "pdf") {
		resp.Body.Close()
		c.mu.Unlock()
		return nil, nil, parseErr("historico", "expected a PDF, got %q", resp.Header.Get("Content-Type"))
	}
	return resp, c.mu.Unlock, nil
}

// ClassOverview enters the turma virtual and parses its main page.
func (c *Client) ClassOverview(ctx context.Context, classID string) (ClassOverview, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	page, err := c.enterClass(ctx, classID)
	if err != nil {
		return ClassOverview{}, err
	}
	return ParseClassOverview(page.Doc, classID)
}

// ClassPage opens one of the allowlisted turma virtual menu entries and parses it.
func ClassPage[T any](ctx context.Context, c *Client, classID, menu string, parse func(*goquery.Document) (T, error)) (T, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	var zero T
	page, err := c.classMenu(ctx, classID, menu)
	if err != nil {
		return zero, err
	}
	return parse(page.Doc)
}

func (c *Client) ClassAttendance(ctx context.Context, id string) (Attendance, error) {
	return ClassPage(ctx, c, id, "Frequência", ParseAttendance)
}

func (c *Client) ClassGrades(ctx context.Context, id string) (ClassGrades, error) {
	return ClassPage(ctx, c, id, "Ver Notas", ParseClassGrades)
}

func (c *Client) ClassTasks(ctx context.Context, id string) ([]Task, error) {
	return ClassPage(ctx, c, id, "Tarefas", ParseTasks)
}

func (c *Client) ClassFiles(ctx context.Context, id string) ([]FileItem, error) {
	return ClassPage(ctx, c, id, "Arquivos", ParseFiles)
}

func (c *Client) ClassNews(ctx context.Context, id string) ([]NewsItem, error) {
	return ClassPage(ctx, c, id, "Notícias", ParseNewsList)
}

func (c *Client) ClassEvaluations(ctx context.Context, id string) ([]Evaluation, error) {
	return ClassPage(ctx, c, id, "Avaliações", ParseEvaluations)
}

// ClassNewsDetail opens one news item from the class news list.
func (c *Client) ClassNewsDetail(ctx context.Context, classID, newsID string) (NewsItem, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	list, err := c.classMenu(ctx, classID, "Notícias")
	if err != nil {
		return NewsItem{}, err
	}
	l, ok := list.FindLinkByParam("id", newsID)
	if !ok {
		return NewsItem{}, ErrNotFound
	}
	page, err := c.clickPage(ctx, list, l)
	if err != nil {
		return NewsItem{}, err
	}
	return ParseNewsDetail(page.Doc)
}

// ClassFile downloads a file, either a topic material (hash id, found on the
// main page) or an entry of the "Arquivos" list (numeric id). The caller must
// close the body and then call release.
func (c *Client) ClassFile(ctx context.Context, classID, fileID string) (*http.Response, func(), error) {
	c.mu.Lock()
	resp, err := c.classFile(ctx, classID, fileID)
	if err != nil {
		c.mu.Unlock()
		return nil, nil, err
	}
	return resp, c.mu.Unlock, nil
}

func (c *Client) classFile(ctx context.Context, classID, fileID string) (*http.Response, error) {
	page, err := c.enterClass(ctx, classID)
	if err != nil {
		return nil, err
	}
	l, ok := findFileLink(page, fileID)
	if !ok {
		if page, err = c.clickClassMenu(ctx, page, "Arquivos"); err != nil {
			return nil, err
		}
		if l, ok = findFileLink(page, fileID); !ok {
			return nil, ErrNotFound
		}
	}
	resp, err := c.click(ctx, page, l)
	if err != nil {
		return nil, err
	}
	if strings.HasPrefix(resp.Header.Get("Content-Type"), "text/html") && resp.Header.Get("Content-Disposition") == "" {
		// SIGAA answers with an HTML page when the file is gone.
		resp.Body.Close()
		return nil, ErrNotFound
	}
	return resp, nil
}

func findFileLink(page *Page, fileID string) (Link, bool) {
	return page.FindLink(func(_ *goquery.Selection, l Link) bool {
		if l.FormID != "formAva" || l.Param("id") != fileID {
			return false
		}
		for _, kv := range l.Params {
			if strings.Contains(kv[0], "Tarefa") {
				return false
			}
		}
		return true
	})
}

// --- navigation helpers (callers hold c.mu) ---

var classIDRe = regexp.MustCompile(`^[0-9A-F]{40}$`)

// enterClass makes classID the current turma virtual and returns its main page.
// Always starts from the portal: old ViewStates expire and the server-side
// "current class" may have been changed by a previous operation.
func (c *Client) enterClass(ctx context.Context, classID string) (*Page, error) {
	if !classIDRe.MatchString(classID) {
		return nil, ErrNotFound
	}
	portal, err := c.get(ctx, portalPath)
	if err != nil {
		return nil, err
	}
	l, ok := portal.FindLink(func(_ *goquery.Selection, l Link) bool {
		return strings.HasPrefix(l.FormID, "form_acessarTurmaVirtual") && l.Param("frontEndIdTurma") == classID
	})
	if !ok {
		return nil, ErrNotFound
	}
	page, err := c.clickPage(ctx, portal, l)
	if err != nil {
		return nil, err
	}
	if page.Doc.Find("#linkNomeTurma").Length() == 0 {
		return nil, parseErr("turma", "did not land on the turma virtual")
	}
	return page, nil
}

func (c *Client) classMenu(ctx context.Context, classID, label string) (*Page, error) {
	page, err := c.enterClass(ctx, classID)
	if err != nil {
		return nil, err
	}
	return c.clickClassMenu(ctx, page, label)
}

func (c *Client) clickClassMenu(ctx context.Context, page *Page, label string) (*Page, error) {
	if !allowedClassMenu[label] {
		return nil, fmt.Errorf("%w: class menu %q", ErrForbiddenAction, label)
	}
	l, ok := page.FindLinkByText(classMenuForm, label)
	if !ok {
		return nil, parseErr("turma", "menu entry %q not found", label)
	}
	return c.clickPage(ctx, page, l)
}

func (c *Client) portalMenu(ctx context.Context, action string) (*Page, error) {
	resp, err := c.portalMenuRaw(ctx, action)
	if err != nil {
		return nil, err
	}
	return readPage(resp)
}

// portalMenuRaw triggers a "Menu Discente" entry. Those are JSCookMenu items:
// the page declares them as '<menuId>:A]#{ bean.method }' strings and a click
// submits the menu form with that string as jscook_action.
func (c *Client) portalMenuRaw(ctx context.Context, action string) (*http.Response, error) {
	if !allowedPortalActions[action] {
		return nil, fmt.Errorf("%w: portal action %q", ErrForbiddenAction, action)
	}
	portal, err := c.get(ctx, portalPath)
	if err != nil {
		return nil, err
	}
	l, ok := portalMenuLink(portal, action)
	if !ok {
		return nil, parseErr("portal", "menu action %q not found", action)
	}
	return c.click(ctx, portal, l)
}

func portalMenuLink(portal *Page, action string) (Link, bool) {
	re := regexp.MustCompile(`'([^']*:A\]#\{\s*` + regexp.QuoteMeta(action) + `\s*\})'`)
	m := re.FindStringSubmatch(portal.HTML)
	if m == nil {
		return Link{}, false
	}
	form := portal.Doc.Find(`input[name="jscook_action"]`).Closest("form").AttrOr("id", "")
	if form == "" {
		return Link{}, false
	}
	return Link{FormID: form, Params: [][2]string{{"jscook_action", m[1]}}}, true
}
