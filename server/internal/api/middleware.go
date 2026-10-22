package api

import (
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

const contentSecurityPolicy = "default-src 'self'; " +
	"img-src 'self' data: https:; " + // teacher content may embed external images
	"style-src 'self' 'unsafe-inline'; " +
	"script-src 'self'; connect-src 'self'; font-src 'self'; " +
	"object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Content-Security-Policy", contentSecurityPolicy)
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusRecorder) Flush() {
	if f, ok := s.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// logRequests logs method, path, status and latency. Never bodies or headers:
// the login body carries a password.
func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		defer func() {
			if v := recover(); v != nil {
				slog.Error("panic", "path", r.URL.Path, "panic", v)
				http.Error(w, "internal error", http.StatusInternalServerError)
				return
			}
			if strings.HasPrefix(r.URL.Path, "/api/") {
				slog.Info("http", "method", r.Method, "path", r.URL.Path, "status", rec.status, "ms", time.Since(start).Milliseconds())
			}
		}()
		next.ServeHTTP(rec, r)
	})
}

// ipLimiter rate-limits by client IP (used for login attempts).
type ipLimiter struct {
	mu         sync.Mutex
	limit      rate.Limit
	burst      int
	m          map[string]*ipEntry
	trustProxy bool
}

type ipEntry struct {
	lim  *rate.Limiter
	seen time.Time
}

func newIPLimiter(limit rate.Limit, burst int, trustProxy bool) *ipLimiter {
	return &ipLimiter{limit: limit, burst: burst, m: map[string]*ipEntry{}, trustProxy: trustProxy}
}

func (l *ipLimiter) allow(r *http.Request) bool {
	ip := clientIP(r, l.trustProxy)
	l.mu.Lock()
	defer l.mu.Unlock()
	e, ok := l.m[ip]
	if !ok {
		e = &ipEntry{lim: rate.NewLimiter(l.limit, l.burst)}
		l.m[ip] = e
	}
	e.seen = time.Now()
	if len(l.m) > 10000 {
		for k, v := range l.m {
			if time.Since(v.seen) > 10*time.Minute {
				delete(l.m, k)
			}
		}
	}
	return e.lim.Allow()
}

func clientIP(r *http.Request, trustProxy bool) string {
	if trustProxy {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			return strings.TrimSpace(strings.Split(xff, ",")[0])
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
