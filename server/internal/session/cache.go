package session

import (
	"sync"
	"time"
)

type entry struct {
	value     any
	fetchedAt time.Time
	expires   time.Time
}

type call struct {
	done      chan struct{}
	value     any
	fetchedAt time.Time
	err       error
}

// Cache is a per-session TTL cache that also collapses concurrent loads of the
// same key (a page firing three identical queries scrapes SIGAA once).
type Cache struct {
	mu       sync.Mutex
	entries  map[string]entry
	inflight map[string]*call
	now      func() time.Time
}

func NewCache() *Cache {
	return &Cache{entries: map[string]entry{}, inflight: map[string]*call{}, now: time.Now}
}

// GetOrLoad returns the cached value for key unless it is stale or refresh is
// set, in which case load runs (once, even with concurrent callers).
func (c *Cache) GetOrLoad(key string, ttl time.Duration, refresh bool, load func() (any, error)) (any, time.Time, error) {
	c.mu.Lock()
	if e, ok := c.entries[key]; ok && !refresh && c.now().Before(e.expires) {
		c.mu.Unlock()
		return e.value, e.fetchedAt, nil
	}
	if cl, ok := c.inflight[key]; ok {
		c.mu.Unlock()
		<-cl.done
		return cl.value, cl.fetchedAt, cl.err
	}
	cl := &call{done: make(chan struct{})}
	c.inflight[key] = cl
	c.mu.Unlock()

	cl.value, cl.err = load()
	cl.fetchedAt = c.now()

	c.mu.Lock()
	delete(c.inflight, key)
	if cl.err == nil {
		c.entries[key] = entry{value: cl.value, fetchedAt: cl.fetchedAt, expires: cl.fetchedAt.Add(ttl)}
	}
	c.mu.Unlock()
	close(cl.done)
	return cl.value, cl.fetchedAt, cl.err
}
