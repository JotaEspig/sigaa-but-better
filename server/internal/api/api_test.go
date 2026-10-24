package api

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"golang.org/x/time/rate"

	"github.com/jotaespig/sigaa-but-better/server/internal/session"
	"github.com/jotaespig/sigaa-but-better/server/internal/sigaa"
)

const (
	compiladores = "080070D1573B0B8866AD2CA0D5ABFA393A61BC52"
	// A 2026.1 class: only reachable through "turmas anteriores".
	pastClass = "59A65EA8FABC280D5E86E4D90ECEBFF833A04B3D"
)

// fakeSIGAA serves the anonymized fixtures, emulating just enough of SIGAA.
type fakeSIGAA struct {
	t        *testing.T
	posts    atomic.Int32
	requests atomic.Int32
	expired  atomic.Bool
	lastForm atomic.Value
}

func (f *fakeSIGAA) page(w http.ResponseWriter, name string) {
	raw, err := os.ReadFile(filepath.Join("..", "sigaa", "testdata", name))
	if err != nil {
		f.t.Fatal(err)
	}
	w.Header().Set("Content-Type", "text/html; charset=UTF-8")
	_, _ = w.Write(raw)
}

func (f *fakeSIGAA) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.requests.Add(1)
	loggedIn := func() bool {
		c, err := r.Cookie("JSESSIONID")
		return err == nil && c.Value == "ok" && !f.expired.Load()
	}
	switch {
	case r.URL.Path == "/sigaa/verTelaLogin.do":
		f.page(w, "login.html")
	case strings.HasPrefix(r.URL.Path, "/sigaa/logar.do") && r.URL.Query().Get("dispatch") == "logOn":
		_ = r.ParseForm()
		if r.PostForm.Get("user.login") == "aluno" && r.PostForm.Get("user.senha") == "segredo" {
			http.SetCookie(w, &http.Cookie{Name: "JSESSIONID", Value: "ok", Path: "/"})
			http.Redirect(w, r, "/sigaa/portais/discente/discente.jsf", http.StatusFound)
			return
		}
		f.page(w, "login.html")
	case strings.HasPrefix(r.URL.Path, "/sigaa/logar.do"):
		w.WriteHeader(http.StatusOK)
	case r.URL.Path == "/sigaa/expirada.jsp":
		f.page(w, "expirada.html")
	case !loggedIn():
		http.Redirect(w, r, "/sigaa/expirada.jsp", http.StatusFound)
	case r.Method == http.MethodGet && r.URL.Path == "/sigaa/portais/discente/discente.jsf":
		f.page(w, "portal.html")
	case r.Method == http.MethodGet && r.URL.Path == "/sigaa/portais/discente/turmas.jsf":
		f.page(w, "turmas_anteriores.html")
	case r.Method == http.MethodPost:
		f.posts.Add(1)
		_ = r.ParseForm()
		f.lastForm.Store(r.PostForm.Encode())
		form := r.PostForm
		switch {
		case strings.Contains(form.Get("jscook_action"), "relatorioNotasAluno"):
			f.page(w, "notas_relatorio.html")
		case strings.Contains(form.Get("jscook_action"), "calendario.iniciarBusca"):
			f.page(w, "calendario_lista.html")
		case form.Get("form") == "form" && form.Get("id") == "35148029":
			f.page(w, "calendario.html")
		case strings.Contains(form.Get("jscook_action"), "solicitacaoRegistroAtividadeAutonomaMBean.listar"):
			f.page(w, "atividades_autonomas.html")
		case strings.Contains(form.Get("jscook_action"), "forum.listarForunsCurso"):
			f.page(w, "forum_curso.html")
		case form.Get("listagem") != "" && form.Get("idForumMensagem") == "35437619":
			f.page(w, "forum_topico.html")
		case form.Get("frontEndIdTurma") == compiladores:
			f.page(w, "turma_principal.html")
		case form.Get("frontEndIdTurma") == pastClass && form.Get("inciadoPelaBusca") == "true":
			f.page(w, "turma_principal.html")
		case form.Get("formMenu") != "" && hasKeySuffix(form, "_100"):
			f.page(w, "turma_frequencia.html")
		case form.Get("formMenu") != "" && hasKeySuffix(form, "_77"):
			f.page(w, "turma_plano.html")
		case form.Get("formMenu") != "" && hasKeySuffix(form, "_83"):
			f.page(w, "turma_participantes.html")
		case form.Get("formMenu") != "" && hasKeySuffix(form, "_126"):
			f.page(w, "turma_referencias.html")
		case form.Get("formMenu") != "" && hasKeySuffix(form, "_131"):
			f.page(w, "turma_avaliacoes.html")
		case form.Get("formMenu") != "" && hasKeySuffix(form, "_102"):
			f.page(w, "turma_notas.html")
		default:
			f.t.Errorf("unexpected POST %s %v", r.URL.Path, form)
			http.Error(w, "unexpected", http.StatusBadRequest)
		}
	default:
		http.NotFound(w, r)
	}
}

func hasKeySuffix(v map[string][]string, suffix string) bool {
	for k := range v {
		if strings.HasSuffix(k, suffix) {
			return true
		}
	}
	return false
}

type harness struct {
	t      *testing.T
	sigaa  *fakeSIGAA
	app    *httptest.Server
	client *http.Client
}

func newHarness(t *testing.T) *harness {
	f := &fakeSIGAA{t: t}
	upstream := httptest.NewServer(f)
	t.Cleanup(upstream.Close)
	store := session.NewStore(session.Options{IdleTTL: time.Hour, MaxTTL: time.Hour, RateLimit: rate.Inf, RateBurst: 1})
	srv := New(Config{SigaaBaseURL: upstream.URL}, store, sigaa.NewLimiter(4))
	app := httptest.NewServer(srv.Handler())
	t.Cleanup(app.Close)
	jar, _ := cookiejar.New(nil)
	return &harness{t: t, sigaa: f, app: app, client: &http.Client{Jar: jar}}
}

func (h *harness) do(method, path, body string) (int, map[string]any) {
	h.t.Helper()
	req, _ := http.NewRequest(method, h.app.URL+path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := h.client.Do(req)
	if err != nil {
		h.t.Fatal(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	var out map[string]any
	_ = json.Unmarshal(raw, &out)
	return resp.StatusCode, out
}

func errCode(m map[string]any) string {
	e, _ := m["error"].(map[string]any)
	s, _ := e["code"].(string)
	return s
}

func TestLoginAndReadFlow(t *testing.T) {
	h := newHarness(t)

	if code, body := h.do("GET", "/api/dashboard", ""); code != 401 || errCode(body) != "UNAUTHENTICATED" {
		t.Fatalf("unauthenticated dashboard = %d %v", code, body)
	}
	if code, body := h.do("POST", "/api/auth/login", `{"username":"aluno","password":"errada"}`); code != 401 || errCode(body) != "INVALID_CREDENTIALS" {
		t.Fatalf("bad login = %d %v", code, body)
	}
	code, body := h.do("POST", "/api/auth/login", `{"username":"aluno","password":"segredo"}`)
	if code != 200 || body["data"].(map[string]any)["name"] != "ALUNO EXEMPLO DA SILVA" {
		t.Fatalf("login = %d %v", code, body)
	}

	reqs := h.sigaa.requests.Load()
	code, body = h.do("GET", "/api/dashboard", "")
	if code != 200 {
		t.Fatalf("dashboard = %d %v", code, body)
	}
	if h.sigaa.requests.Load() != reqs {
		t.Error("the dashboard right after login should come from the portal the login landed on")
	}
	classes := body["data"].(map[string]any)["classes"].([]any)
	if len(classes) != 4 || body["fetchedAt"] == "" {
		t.Fatalf("dashboard body = %v", body)
	}

	if code, body = h.do("GET", "/api/grades", ""); code != 200 || len(body["data"].(map[string]any)["semesters"].([]any)) != 8 {
		t.Fatalf("grades = %d %v", code, body)
	}
	posts := h.sigaa.posts.Load()
	h.do("GET", "/api/grades", "")
	if h.sigaa.posts.Load() != posts {
		t.Error("second /api/grades should be served from cache")
	}
	h.do("GET", "/api/grades?refresh=1", "")
	if h.sigaa.posts.Load() != posts+1 {
		t.Error("refresh=1 should bypass the cache")
	}

	if code, body = h.do("GET", "/api/classes/"+compiladores, ""); code != 200 || body["data"].(map[string]any)["name"] != "COMPILADORES" {
		t.Fatalf("class = %d %v", code, body)
	}
	if code, body = h.do("GET", "/api/classes/"+compiladores+"/attendance", ""); code != 200 || body["data"].(map[string]any)["maxAbsences"].(float64) != 18 {
		t.Fatalf("attendance = %d %v", code, body)
	}
	posts = h.sigaa.posts.Load()
	code, body = h.do("GET", "/api/classes/"+compiladores+"/status", "")
	if code != 200 {
		t.Fatalf("status = %d %v", code, body)
	}
	st := body["data"].(map[string]any)
	if st["attendance"].(map[string]any)["maxAbsences"].(float64) != 18 || len(st["evaluations"].([]any)) == 0 || st["grades"].(map[string]any)["published"] != true {
		t.Fatalf("status = %v", st)
	}
	// Still on this turma after /attendance: three menu clicks, no portal or re-entry.
	if n := h.sigaa.posts.Load() - posts; n != 3 {
		t.Errorf("status used %d POSTs, want 3", n)
	}
	if code, body = h.do("GET", "/api/classes/NOT-A-CLASS/attendance", ""); code != 404 {
		t.Fatalf("bad class id = %d %v", code, body)
	}

	// SIGAA drops the session: the API must say so and forget ours.
	h.sigaa.expired.Store(true)
	if code, body = h.do("GET", "/api/dashboard?refresh=1", ""); code != 401 || errCode(body) != "SESSION_EXPIRED" {
		t.Fatalf("expired = %d %v", code, body)
	}
	if code, body = h.do("GET", "/api/session", ""); code != 401 || errCode(body) != "UNAUTHENTICATED" {
		t.Fatalf("session after expiry = %d %v", code, body)
	}
}

func TestNewPages(t *testing.T) {
	h := newHarness(t)
	h.do("POST", "/api/auth/login", `{"username":"aluno","password":"segredo"}`)
	data := func(path string) any {
		t.Helper()
		code, body := h.do("GET", path, "")
		if code != 200 {
			t.Fatalf("%s = %d %v", path, code, body)
		}
		return body["data"]
	}

	if cs := data("/api/past-classes").([]any); len(cs) != 48 {
		t.Errorf("past classes = %d", len(cs))
	}
	past := data("/api/classes/" + pastClass).(map[string]any)
	if past["period"] != "2026.1" || past["workloadHours"].(float64) != 60 {
		t.Errorf("past class overview = %v", past)
	}

	if cals := data("/api/calendars").([]any); len(cals) < 30 {
		t.Errorf("calendars = %d", len(cals))
	}
	if cal := data("/api/calendars/35148029").(map[string]any); cal["period"] != "2026.2" {
		t.Errorf("calendar = %v", cal)
	}
	if code, _ := h.do("GET", "/api/calendars/999", ""); code != 404 {
		t.Errorf("unknown calendar = %d", code)
	}

	if a := data("/api/complementary-activities").(map[string]any); len(a["groups"].([]any)) != 2 {
		t.Errorf("complementary = %v", a)
	}
	if topics := data("/api/forum").([]any); len(topics) < 20 {
		t.Errorf("forum = %d", len(topics))
	}
	if th := data("/api/forum/35437619").(map[string]any); len(th["posts"].([]any)) != 2 {
		t.Errorf("forum thread = %v", th)
	}

	if p := data("/api/classes/" + compiladores + "/plan").(map[string]any); p["officeHours"] != "Quinta-feira, 13:30-17:30" {
		t.Errorf("plan = %v", p)
	}
	reqs := h.sigaa.requests.Load()
	if p := data("/api/classes/" + compiladores + "/participants").(map[string]any); len(p["students"].([]any)) != 4 {
		t.Errorf("participants = %v", p)
	}
	// Right after /plan of the same class: one menu click from that page.
	if n := h.sigaa.requests.Load() - reqs; n != 1 {
		t.Errorf("participants after plan used %d requests, want 1", n)
	}
	if refs := data("/api/classes/" + compiladores + "/references").([]any); len(refs) != 8 {
		t.Errorf("references = %d", len(refs))
	}
	// Every POST above went through the guard; make sure none smuggled a submit button.
	if last, _ := h.sigaa.lastForm.Load().(string); strings.Contains(last, "postarmensagens") || strings.Contains(last, "buscar") {
		t.Errorf("submit button sent: %s", last)
	}
}

func TestLoginRequiresJSON(t *testing.T) {
	h := newHarness(t)
	resp, err := h.client.Post(h.app.URL+"/api/auth/login", "application/x-www-form-urlencoded", strings.NewReader("username=aluno&password=segredo"))
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 400 {
		t.Fatalf("form-encoded login should be rejected, got %d", resp.StatusCode)
	}
}

func TestLogout(t *testing.T) {
	h := newHarness(t)
	h.do("POST", "/api/auth/login", `{"username":"aluno","password":"segredo"}`)
	if code, _ := h.do("POST", "/api/auth/logout", `{}`); code != 204 {
		t.Fatalf("logout = %d", code)
	}
	if code, _ := h.do("GET", "/api/session", ""); code != 401 {
		t.Fatalf("session after logout = %d", code)
	}
}

func TestSecurityHeaders(t *testing.T) {
	h := newHarness(t)
	resp, err := h.client.Get(h.app.URL + "/api/session")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	for _, k := range []string{"Content-Security-Policy", "X-Content-Type-Options", "Referrer-Policy", "X-Frame-Options"} {
		if resp.Header.Get(k) == "" {
			t.Errorf("missing %s", k)
		}
	}
}

func TestStaticSPA(t *testing.T) {
	dir := t.TempDir()
	_ = os.MkdirAll(filepath.Join(dir, "assets"), 0o755)
	_ = os.WriteFile(filepath.Join(dir, "index.html"), []byte("<!doctype html>app"), 0o644)
	_ = os.WriteFile(filepath.Join(dir, "assets", "a.js"), []byte("js"), 0o644)
	store := session.NewStore(session.Options{IdleTTL: time.Hour, MaxTTL: time.Hour, RateLimit: rate.Inf, RateBurst: 1})
	app := httptest.NewServer(New(Config{SigaaBaseURL: "http://127.0.0.1:1", StaticDir: dir}, store, sigaa.NewLimiter(1)).Handler())
	defer app.Close()

	get := func(path string) (int, string, http.Header) {
		resp, err := http.Get(app.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		b, _ := io.ReadAll(resp.Body)
		return resp.StatusCode, string(b), resp.Header
	}
	if code, body, _ := get("/turmas/ABC"); code != 200 || !strings.Contains(body, "app") {
		t.Errorf("SPA fallback = %d %q", code, body)
	}
	if code, _, h := get("/assets/a.js"); code != 200 || !strings.Contains(h.Get("Cache-Control"), "immutable") {
		t.Errorf("asset = %d %v", code, h)
	}
	if code, body, _ := get("/api/nope"); code != 404 || !strings.Contains(body, "NOT_FOUND") {
		t.Errorf("unknown api = %d %q", code, body)
	}
	resp, _ := http.Post(app.URL+"/", "text/plain", nil)
	resp.Body.Close()
	if resp.StatusCode != 405 {
		t.Errorf("POST / = %d", resp.StatusCode)
	}
}
