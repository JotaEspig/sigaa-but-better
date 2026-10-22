// Command server runs the SIGAA But Better BFF. Configuration is read from
// the environment; see README.md for the full list.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"golang.org/x/time/rate"

	"github.com/jotaespig/sigaa-but-better/server/internal/api"
	"github.com/jotaespig/sigaa-but-better/server/internal/session"
	"github.com/jotaespig/sigaa-but-better/server/internal/sigaa"
)

func env(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return def
}

func envBool(key string, def bool) bool {
	v, err := strconv.ParseBool(env(key, strconv.FormatBool(def)))
	if err != nil {
		return def
	}
	return v
}

func envInt(key string, def int) int {
	v, err := strconv.Atoi(env(key, strconv.Itoa(def)))
	if err != nil {
		return def
	}
	return v
}

func envDuration(key string, def time.Duration) time.Duration {
	v, err := time.ParseDuration(env(key, def.String()))
	if err != nil {
		return def
	}
	return v
}

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	cfg := api.Config{
		SigaaBaseURL: env("SIGAA_BASE_URL", "https://sig.ifc.edu.br"),
		StaticDir:    env("STATIC_DIR", ""),
		CookieSecure: envBool("COOKIE_SECURE", true),
		TrustProxy:   envBool("TRUST_PROXY", false),
	}
	addr := ":" + env("PORT", "8080")

	store := session.NewStore(session.Options{
		IdleTTL:   envDuration("SESSION_IDLE_TTL", 30*time.Minute),
		MaxTTL:    envDuration("SESSION_MAX_TTL", 12*time.Hour),
		RateLimit: rate.Every(time.Second / 2), // 2 SIGAA loads/s per user…
		RateBurst: 20,                          // …after an initial burst
		OnExpire: func(s *session.Session) {
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
			_ = s.Client.Logout(ctx)
		},
	})
	limiter := sigaa.NewLimiter(envInt("SIGAA_MAX_CONCURRENCY", 8))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go store.Janitor(ctx, time.Minute)

	srv := &http.Server{
		Addr:              addr,
		Handler:           api.New(cfg, store, limiter).Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}
	go func() {
		slog.Info("listening", "addr", addr, "sigaa", cfg.SigaaBaseURL, "static", cfg.StaticDir, "secureCookie", cfg.CookieSecure)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdown)
}
