package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/jotaespig/sigaa-but-better/server/internal/sigaa"
)

type envelope struct {
	Data      any    `json:"data"`
	FetchedAt string `json:"fetchedAt"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeData(w http.ResponseWriter, data any, fetchedAt time.Time) {
	writeJSON(w, http.StatusOK, envelope{Data: data, FetchedAt: fetchedAt.UTC().Format(time.RFC3339)})
}

type apiError struct {
	status  int
	code    string
	message string
}

func (e *apiError) Error() string { return e.code + ": " + e.message }

var (
	errUnauthenticated = &apiError{http.StatusUnauthorized, "UNAUTHENTICATED", "Faça login para continuar."}
	errRateLimited     = &apiError{http.StatusTooManyRequests, "RATE_LIMITED", "Muitas requisições. Aguarde alguns segundos."}
	errBadRequest      = &apiError{http.StatusBadRequest, "BAD_REQUEST", "Requisição inválida."}
)

// toAPIError maps internal errors to the public error contract (ARCHITECTURE.md).
func toAPIError(err error) *apiError {
	var ae *apiError
	var pe *sigaa.ParseError
	switch {
	case errors.As(err, &ae):
		return ae
	case errors.Is(err, sigaa.ErrSessionExpired):
		return &apiError{http.StatusUnauthorized, "SESSION_EXPIRED", "Sua sessão no SIGAA expirou. Entre novamente."}
	case errors.Is(err, sigaa.ErrInvalidCredentials):
		return &apiError{http.StatusUnauthorized, "INVALID_CREDENTIALS", "Usuário ou senha inválidos."}
	case errors.Is(err, sigaa.ErrUnsupportedAccount):
		return &apiError{http.StatusUnprocessableEntity, "UNSUPPORTED_ACCOUNT", "Seu acesso não abriu o Portal do Discente. Entre pelo SIGAA oficial e resolva avisos ou escolha de vínculo pendentes."}
	case errors.Is(err, sigaa.ErrNotFound):
		return &apiError{http.StatusNotFound, "NOT_FOUND", "Não encontrado no SIGAA."}
	case errors.Is(err, sigaa.ErrUnavailable):
		return &apiError{http.StatusBadGateway, "SIGAA_UNAVAILABLE", "O SIGAA não respondeu. Tente novamente em instantes."}
	case errors.As(err, &pe):
		return &apiError{http.StatusBadGateway, "PARSE_ERROR", "O SIGAA mudou de formato e não conseguimos ler esta página."}
	default:
		return &apiError{http.StatusInternalServerError, "INTERNAL", "Erro interno."}
	}
}

func writeError(w http.ResponseWriter, r *http.Request, err error) {
	ae := toAPIError(err)
	if ae.status >= 500 {
		slog.Error("request failed", "path", r.URL.Path, "err", err)
	}
	writeJSON(w, ae.status, map[string]any{"error": map[string]string{"code": ae.code, "message": ae.message}})
}
