package sigaa

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"
	"golang.org/x/net/html/charset"
)

const (
	userAgent      = "SIGAA-But-Better/1.0 (+https://github.com/jotaespig/sigaa-but-better)"
	portalPath     = "/sigaa/portais/discente/discente.jsf"
	loginPagePath  = "/sigaa/verTelaLogin.do"
	logoutPath     = "/sigaa/logar.do?dispatch=logOff"
	maxPageBytes   = 8 << 20
	requestTimeout = 20 * time.Second
)

// Limiter bounds concurrent requests to SIGAA across all users.
type Limiter chan struct{}

func NewLimiter(n int) Limiter { return make(Limiter, n) }

func (l Limiter) acquire(ctx context.Context) error {
	select {
	case l <- struct{}{}:
		return nil
	case <-ctx.Done():
		return fmt.Errorf("%w: %v", ErrUnavailable, ctx.Err())
	}
}

func (l Limiter) release() { <-l }

// Client is one user's SIGAA session. SIGAA keeps navigation state on the
// server (e.g. the "current" turma virtual), so every high-level operation
// holds mu for its whole sequence of requests.
type Client struct {
	base    *url.URL
	http    *http.Client
	limiter Limiter
	mu      sync.Mutex
}

func NewClient(baseURL string, limiter Limiter) (*Client, error) {
	base, err := url.Parse(baseURL)
	if err != nil {
		return nil, err
	}
	jar, _ := cookiejar.New(nil)
	return &Client{
		base:    base,
		limiter: limiter,
		http: &http.Client{
			Jar:     jar,
			Timeout: requestTimeout,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				// No need to download the "session expired" page; do() detects it.
				if isExpiredURL(req.URL) {
					return http.ErrUseLastResponse
				}
				if len(via) >= 10 {
					return errors.New("too many redirects")
				}
				return nil
			},
		},
	}, nil
}

func (c *Client) resolve(ref string) string {
	u, err := c.base.Parse(ref)
	if err != nil {
		return c.base.String() + ref
	}
	return u.String()
}

// do sends a request and returns the raw response; the caller closes the body.
// It turns SIGAA's "session expired" redirect into ErrSessionExpired.
func (c *Client) do(ctx context.Context, method, ref string, form url.Values) (*http.Response, error) {
	resp, err := c.rawDo(ctx, method, ref, form)
	if err != nil {
		return nil, err
	}
	if isExpiredURL(resp.Request.URL) || isExpiredRedirect(resp) {
		resp.Body.Close()
		return nil, ErrSessionExpired
	}
	return resp, nil
}

func isExpiredRedirect(resp *http.Response) bool {
	if resp.StatusCode < 300 || resp.StatusCode >= 400 {
		return false
	}
	loc, err := resp.Location()
	return err == nil && isExpiredURL(loc)
}

func isExpiredURL(u *url.URL) bool {
	return strings.Contains(u.Path, "expirada.jsp") || strings.Contains(u.Path, "verTelaLogin")
}

// readPage decodes an HTML response (SIGAA serves ISO-8859-1) into a Page.
func readPage(resp *http.Response) (*Page, error) {
	defer resp.Body.Close()
	r, err := charset.NewReader(io.LimitReader(resp.Body, maxPageBytes), resp.Header.Get("Content-Type"))
	if err != nil {
		return nil, fmt.Errorf("%w: decode: %v", ErrUnavailable, err)
	}
	raw, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("%w: read: %v", ErrUnavailable, err)
	}
	return newPage(resp.Request.URL, string(raw))
}

func newPage(u *url.URL, html string) (*Page, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil, parseErr("html", "%v", err)
	}
	return &Page{URL: u, Doc: doc, HTML: html}, nil
}

func (c *Client) get(ctx context.Context, ref string) (*Page, error) {
	resp, err := c.do(ctx, http.MethodGet, ref, nil)
	if err != nil {
		return nil, err
	}
	return readPage(resp)
}

// click performs a JSF link click on page and returns the raw response.
// Every navigation POST in the app goes through here, so the guard lives here.
func (c *Client) click(ctx context.Context, page *Page, l Link) (*http.Response, error) {
	action, values, ok := page.formRequest(l)
	if !ok {
		return nil, parseErr(page.URL.Path, "form %q not found", l.FormID)
	}
	if err := checkReadOnly(values); err != nil {
		return nil, err
	}
	return c.do(ctx, http.MethodPost, action, values)
}

func (c *Client) clickPage(ctx context.Context, page *Page, l Link) (*Page, error) {
	resp, err := c.click(ctx, page, l)
	if err != nil {
		return nil, err
	}
	return readPage(resp)
}

// Login authenticates against SIGAA. The password is only used for this POST.
func (c *Client) Login(ctx context.Context, username, password string) (SessionInfo, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// The login page itself matches isExpiredURL, so the login flow uses raw requests.
	resp, err := c.rawGet(ctx, loginPagePath)
	if err != nil {
		return SessionInfo{}, err
	}
	page, err := readPage(resp)
	if err != nil {
		return SessionInfo{}, err
	}
	form := page.Doc.Find(`form[name="loginForm"]`)
	action, ok := form.Attr("action")
	if !ok {
		return SessionInfo{}, parseErr("login", "loginForm not found")
	}
	values := url.Values{}
	form.Find(`input[type="hidden"]`).Each(func(_ int, in *goquery.Selection) {
		if name := in.AttrOr("name", ""); name != "" {
			values.Set(name, in.AttrOr("value", ""))
		}
	})
	values.Set("width", "1920")
	values.Set("height", "1080")
	values.Set("user.login", username)
	values.Set("user.senha", password)

	resp, err = c.rawPost(ctx, action, values)
	if err != nil {
		return SessionInfo{}, err
	}
	page, err = readPage(resp)
	if err != nil {
		return SessionInfo{}, err
	}
	if page.Doc.Find(`form[name="loginForm"]`).Length() > 0 {
		return SessionInfo{}, ErrInvalidCredentials
	}
	if !strings.Contains(page.URL.Path, "/portais/discente/") {
		// Intermediate screens (notices, vínculo choice) sometimes still allow
		// going straight to the portal.
		page, err = c.get(ctx, portalPath)
		if err != nil || !strings.Contains(page.URL.Path, "/portais/discente/") {
			return SessionInfo{}, ErrUnsupportedAccount
		}
	}
	d, err := ParsePortal(page.Doc)
	if err != nil {
		return SessionInfo{}, err
	}
	return SessionInfo{Name: d.Profile.Name, Matricula: d.Profile.Matricula}, nil
}

// rawGet/rawPost skip the expired-URL check; only the login flow uses them.
func (c *Client) rawGet(ctx context.Context, ref string) (*http.Response, error) {
	return c.rawDo(ctx, http.MethodGet, ref, nil)
}

func (c *Client) rawPost(ctx context.Context, ref string, form url.Values) (*http.Response, error) {
	return c.rawDo(ctx, http.MethodPost, ref, form)
}

func (c *Client) rawDo(ctx context.Context, method, ref string, form url.Values) (*http.Response, error) {
	if err := c.limiter.acquire(ctx); err != nil {
		return nil, err
	}
	defer c.limiter.release()
	var body io.Reader
	if form != nil {
		body = strings.NewReader(form.Encode())
	}
	req, err := http.NewRequestWithContext(ctx, method, c.resolve(ref), body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept-Language", "pt-BR,pt;q=0.9")
	if form != nil {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	if resp.StatusCode >= 500 {
		resp.Body.Close()
		return nil, fmt.Errorf("%w: HTTP %d", ErrUnavailable, resp.StatusCode)
	}
	return resp, nil
}

// Logout ends the SIGAA session. Best effort: errors are ignored by callers.
func (c *Client) Logout(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	resp, err := c.rawGet(ctx, logoutPath)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

type SessionInfo struct {
	Name      string `json:"name"`
	Matricula string `json:"matricula"`
}
