// Package api exposes the JSON API consumed by web/ and serves its static build.
package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/text/encoding/charmap"
	"golang.org/x/time/rate"

	"github.com/jotaespig/sigaa-but-better/server/internal/session"
	"github.com/jotaespig/sigaa-but-better/server/internal/sigaa"
)

const (
	cookieName     = "sbb_sid"
	loadTimeout    = 60 * time.Second
	maxLoginBody   = 4 << 10
	downloadMaxDur = 10 * time.Minute
)

type Config struct {
	SigaaBaseURL string
	StaticDir    string
	CookieSecure bool
	TrustProxy   bool
}

type Server struct {
	cfg          Config
	store        *session.Store
	limiter      sigaa.Limiter
	loginLimiter *ipLimiter
}

func New(cfg Config, store *session.Store, limiter sigaa.Limiter) *Server {
	return &Server{
		cfg:     cfg,
		store:   store,
		limiter: limiter,
		// 5 attempts, then one every 12 s per IP.
		loginLimiter: newIPLimiter(rate.Every(12*time.Second), 5, cfg.TrustProxy),
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/auth/login", s.login)
	mux.HandleFunc("POST /api/auth/logout", s.logout)
	mux.HandleFunc("GET /api/session", s.withSession(func(w http.ResponseWriter, r *http.Request, sess *session.Session) {
		writeData(w, sess.Info, time.Now())
	}))

	mux.HandleFunc("GET /api/dashboard", cached(s, 2*time.Minute, func(ctx context.Context, r *http.Request, c *sigaa.Client) (sigaa.Dashboard, error) {
		return c.Dashboard(ctx)
	}))
	mux.HandleFunc("GET /api/grades", cached(s, 5*time.Minute, func(ctx context.Context, r *http.Request, c *sigaa.Client) (sigaa.GradesReport, error) {
		return c.Grades(ctx)
	}))
	mux.HandleFunc("GET /api/classes/{id}", cached(s, 5*time.Minute, func(ctx context.Context, r *http.Request, c *sigaa.Client) (sigaa.ClassOverview, error) {
		return c.ClassOverview(ctx, r.PathValue("id"))
	}))
	mux.HandleFunc("GET /api/classes/{id}/attendance", cached(s, 10*time.Minute, func(ctx context.Context, r *http.Request, c *sigaa.Client) (sigaa.Attendance, error) {
		return c.ClassAttendance(ctx, r.PathValue("id"))
	}))
	mux.HandleFunc("GET /api/classes/{id}/grades", cached(s, 5*time.Minute, func(ctx context.Context, r *http.Request, c *sigaa.Client) (sigaa.ClassGrades, error) {
		return c.ClassGrades(ctx, r.PathValue("id"))
	}))
	mux.HandleFunc("GET /api/classes/{id}/tasks", cached(s, 5*time.Minute, func(ctx context.Context, r *http.Request, c *sigaa.Client) ([]sigaa.Task, error) {
		return c.ClassTasks(ctx, r.PathValue("id"))
	}))
	mux.HandleFunc("GET /api/classes/{id}/files", cached(s, 10*time.Minute, func(ctx context.Context, r *http.Request, c *sigaa.Client) ([]sigaa.FileItem, error) {
		return c.ClassFiles(ctx, r.PathValue("id"))
	}))
	mux.HandleFunc("GET /api/classes/{id}/news", cached(s, 5*time.Minute, func(ctx context.Context, r *http.Request, c *sigaa.Client) ([]sigaa.NewsItem, error) {
		return c.ClassNews(ctx, r.PathValue("id"))
	}))
	mux.HandleFunc("GET /api/classes/{id}/news/{newsId}", cached(s, 30*time.Minute, func(ctx context.Context, r *http.Request, c *sigaa.Client) (sigaa.NewsItem, error) {
		if !opaqueIDRe.MatchString(r.PathValue("newsId")) {
			return sigaa.NewsItem{}, sigaa.ErrNotFound
		}
		return c.ClassNewsDetail(ctx, r.PathValue("id"), r.PathValue("newsId"))
	}))
	mux.HandleFunc("GET /api/classes/{id}/evaluations", cached(s, 10*time.Minute, func(ctx context.Context, r *http.Request, c *sigaa.Client) ([]sigaa.Evaluation, error) {
		return c.ClassEvaluations(ctx, r.PathValue("id"))
	}))

	mux.HandleFunc("GET /api/classes/{id}/files/{fileId}", s.withSession(func(w http.ResponseWriter, r *http.Request, sess *session.Session) {
		if !opaqueIDRe.MatchString(r.PathValue("fileId")) {
			writeError(w, r, sigaa.ErrNotFound)
			return
		}
		s.download(w, r, sess, func(ctx context.Context) (*http.Response, func(), error) {
			return sess.Client.ClassFile(ctx, r.PathValue("id"), r.PathValue("fileId"))
		})
	}))
	// Never cached: every emission registers an authentication code in SIGAA.
	mux.HandleFunc("GET /api/documents/transcript", s.withSession(func(w http.ResponseWriter, r *http.Request, sess *session.Session) {
		s.download(w, r, sess, sess.Client.Transcript)
	}))

	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, r, &apiError{http.StatusNotFound, "NOT_FOUND", "Rota inexistente."})
	})
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "ok")
	})
	if s.cfg.StaticDir != "" {
		// Plain "/" (not "GET /"): a method-qualified catch-all conflicts with "/api/".
		mux.Handle("/", spaHandler(s.cfg.StaticDir))
	}
	return logRequests(securityHeaders(mux))
}

var opaqueIDRe = regexp.MustCompile(`^[0-9A-Za-z]{1,64}$`)

// --- auth ---

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func requireJSON(r *http.Request) bool {
	ct, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
	return ct == "application/json"
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	if !requireJSON(r) {
		writeError(w, r, errBadRequest)
		return
	}
	if !s.loginLimiter.allow(r) {
		writeError(w, r, errRateLimited)
		return
	}
	var req loginRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxLoginBody)).Decode(&req); err != nil ||
		strings.TrimSpace(req.Username) == "" || req.Password == "" {
		writeError(w, r, errBadRequest)
		return
	}
	client, err := sigaa.NewClient(s.cfg.SigaaBaseURL, s.limiter)
	if err != nil {
		writeError(w, r, err)
		return
	}
	info, err := client.Login(r.Context(), strings.TrimSpace(req.Username), req.Password)
	req.Password = ""
	if err != nil {
		writeError(w, r, err)
		return
	}
	if c, err := r.Cookie(cookieName); err == nil {
		s.dropSession(c.Value)
	}
	sess := s.store.Create(info, client)
	http.SetCookie(w, s.cookie(sess.ID, 0))
	writeData(w, info, time.Now())
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if !requireJSON(r) {
		writeError(w, r, errBadRequest)
		return
	}
	if c, err := r.Cookie(cookieName); err == nil {
		s.dropSession(c.Value)
	}
	http.SetCookie(w, s.cookie("", -1))
	w.WriteHeader(http.StatusNoContent)
}

// dropSession forgets a session and logs it out of SIGAA in the background.
func (s *Server) dropSession(id string) {
	if sess := s.store.Delete(id); sess != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
			_ = sess.Client.Logout(ctx)
		}()
	}
}

func (s *Server) cookie(value string, maxAge int) *http.Cookie {
	return &http.Cookie{
		Name:     cookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	}
}

type sessionHandler func(http.ResponseWriter, *http.Request, *session.Session)

func (s *Server) withSession(h sessionHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(cookieName)
		if err != nil {
			writeError(w, r, errUnauthenticated)
			return
		}
		sess, ok := s.store.Get(c.Value)
		if !ok {
			http.SetCookie(w, s.cookie("", -1))
			writeError(w, r, errUnauthenticated)
			return
		}
		h(w, r, sess)
	}
}

// fail writes err and, when SIGAA says the session is gone, drops ours too.
func (s *Server) fail(w http.ResponseWriter, r *http.Request, sess *session.Session, err error) {
	if errors.Is(err, sigaa.ErrSessionExpired) {
		s.store.Delete(sess.ID)
		http.SetCookie(w, s.cookie("", -1))
	}
	writeError(w, r, err)
}

// cached wraps a SIGAA read with the per-session cache and rate limit.
// The cache key is the request path, so it naturally includes path params.
func cached[T any](s *Server, ttl time.Duration, load func(context.Context, *http.Request, *sigaa.Client) (T, error)) http.HandlerFunc {
	return s.withSession(func(w http.ResponseWriter, r *http.Request, sess *session.Session) {
		refresh := r.URL.Query().Get("refresh") == "1"
		v, at, err := sess.Cache.GetOrLoad(r.URL.Path, ttl, refresh, func() (any, error) {
			if !sess.Limiter.Allow() {
				return nil, errRateLimited
			}
			// Detached from the request: concurrent callers share this load.
			ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), loadTimeout)
			defer cancel()
			return load(ctx, r, sess.Client)
		})
		if err != nil {
			s.fail(w, r, sess, err)
			return
		}
		writeData(w, v, at)
	})
}

// --- downloads ---

var inlineTypes = map[string]bool{
	"application/pdf": true, "image/png": true, "image/jpeg": true, "image/gif": true, "image/webp": true,
}

func (s *Server) download(w http.ResponseWriter, r *http.Request, sess *session.Session, open func(context.Context) (*http.Response, func(), error)) {
	if !sess.Limiter.Allow() {
		writeError(w, r, errRateLimited)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), downloadMaxDur)
	defer cancel()
	resp, release, err := open(ctx)
	if err != nil {
		s.fail(w, r, sess, err)
		return
	}
	defer release()
	defer resp.Body.Close()

	ctype, _, err := mime.ParseMediaType(resp.Header.Get("Content-Type"))
	if err != nil || ctype == "" {
		ctype = "application/octet-stream"
	}
	disposition := "attachment"
	if inlineTypes[ctype] {
		disposition = "inline"
	}
	h := w.Header()
	h.Set("Content-Type", ctype)
	h.Set("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": upstreamFilename(resp)}))
	// Teacher uploads are untrusted: never let them run as our origin.
	h.Set("Content-Security-Policy", "sandbox")
	h.Set("Cache-Control", "private, no-store")
	if cl := resp.Header.Get("Content-Length"); cl != "" {
		h.Set("Content-Length", cl)
	}
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, resp.Body)
}

func upstreamFilename(resp *http.Response) string {
	_, params, err := mime.ParseMediaType(resp.Header.Get("Content-Disposition"))
	name := ""
	if err == nil {
		name = params["filename"]
	}
	if !utf8.ValidString(name) {
		// SIGAA sends ISO-8859-1 bytes in headers.
		if dec, err := charmap.ISO8859_1.NewDecoder().String(name); err == nil {
			name = dec
		}
	}
	name = strings.Map(func(r rune) rune {
		if r < 0x20 || r == '/' || r == '\\' || r == '"' {
			return '_'
		}
		return r
	}, name)
	if name == "" {
		name = "arquivo"
	}
	return name
}
