package sigaa

import (
	"errors"
	"fmt"
)

var (
	// ErrSessionExpired means SIGAA redirected to expirada.jsp (or back to the login page).
	ErrSessionExpired = errors.New("sigaa: session expired")
	// ErrInvalidCredentials means the login form was shown again after logOn.
	ErrInvalidCredentials = errors.New("sigaa: invalid credentials")
	// ErrUnsupportedAccount means login worked but did not reach the student portal
	// (multiple vínculos, mandatory notices, non-student user…).
	ErrUnsupportedAccount = errors.New("sigaa: account did not land on the student portal")
	// ErrUnavailable covers network errors, timeouts and 5xx answers.
	ErrUnavailable = errors.New("sigaa: unavailable")
	// ErrNotFound means the requested class, file or news item is not reachable.
	ErrNotFound = errors.New("sigaa: not found")
	// ErrForbiddenAction is raised by the read-only guard. It is a bug, never user input.
	ErrForbiddenAction = errors.New("sigaa: action refused by read-only guard")
)

// ParseError signals that SIGAA's markup no longer matches what a parser expects.
type ParseError struct {
	Page string
	What string
}

func (e *ParseError) Error() string {
	return fmt.Sprintf("sigaa: parse %s: %s", e.Page, e.What)
}

func parseErr(page, format string, args ...any) error {
	return &ParseError{Page: page, What: fmt.Sprintf(format, args...)}
}
