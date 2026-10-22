// Package session keeps per-user SIGAA clients in memory. Nothing is persisted:
// a restart logs everybody out, which is the intended trade-off (no credentials
// or academic data of third parties at rest).
package session

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"sync"
	"time"

	"golang.org/x/time/rate"

	"github.com/jotaespig/sigaa-but-better/server/internal/sigaa"
)

type Session struct {
	ID      string
	Info    sigaa.SessionInfo
	Client  *sigaa.Client
	Cache   *Cache
	Limiter *rate.Limiter

	created  time.Time
	mu       sync.Mutex
	lastSeen time.Time
}

func (s *Session) touch(now time.Time) {
	s.mu.Lock()
	s.lastSeen = now
	s.mu.Unlock()
}

func (s *Session) expired(now time.Time, idle, max time.Duration) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return now.Sub(s.lastSeen) > idle || now.Sub(s.created) > max
}

type Options struct {
	IdleTTL time.Duration
	MaxTTL  time.Duration
	// Per-session budget of requests that reach SIGAA (cache misses).
	RateLimit rate.Limit
	RateBurst int
	// OnExpire runs (in a goroutine) when the janitor drops a session.
	OnExpire func(*Session)
}

type Store struct {
	opts Options
	mu   sync.Mutex
	m    map[string]*Session
	now  func() time.Time
}

func NewStore(opts Options) *Store {
	return &Store{opts: opts, m: map[string]*Session{}, now: time.Now}
}

func newID() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err) // crypto/rand never fails on supported platforms
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

func (st *Store) Create(info sigaa.SessionInfo, client *sigaa.Client) *Session {
	now := st.now()
	s := &Session{
		ID:       newID(),
		Info:     info,
		Client:   client,
		Cache:    NewCache(),
		Limiter:  rate.NewLimiter(st.opts.RateLimit, st.opts.RateBurst),
		created:  now,
		lastSeen: now,
	}
	st.mu.Lock()
	st.m[s.ID] = s
	st.mu.Unlock()
	return s
}

// Get returns a live session and refreshes its idle timer.
func (st *Store) Get(id string) (*Session, bool) {
	st.mu.Lock()
	s, ok := st.m[id]
	st.mu.Unlock()
	if !ok {
		return nil, false
	}
	now := st.now()
	if s.expired(now, st.opts.IdleTTL, st.opts.MaxTTL) {
		st.Delete(id)
		return nil, false
	}
	s.touch(now)
	return s, true
}

func (st *Store) Delete(id string) *Session {
	st.mu.Lock()
	defer st.mu.Unlock()
	s := st.m[id]
	delete(st.m, id)
	return s
}

func (st *Store) Len() int {
	st.mu.Lock()
	defer st.mu.Unlock()
	return len(st.m)
}

// Janitor drops expired sessions until ctx is done.
func (st *Store) Janitor(ctx context.Context, every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			now := st.now()
			var dead []*Session
			st.mu.Lock()
			for id, s := range st.m {
				if s.expired(now, st.opts.IdleTTL, st.opts.MaxTTL) {
					dead = append(dead, s)
					delete(st.m, id)
				}
			}
			st.mu.Unlock()
			if st.opts.OnExpire != nil {
				for _, s := range dead {
					go st.opts.OnExpire(s)
				}
			}
		}
	}
}
