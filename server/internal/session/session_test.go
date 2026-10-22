package session

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jotaespig/sigaa-but-better/server/internal/sigaa"
)

func TestStoreIdleExpiry(t *testing.T) {
	now := time.Unix(0, 0)
	st := NewStore(Options{IdleTTL: time.Minute, MaxTTL: time.Hour, RateLimit: 1, RateBurst: 1})
	st.now = func() time.Time { return now }
	s := st.Create(sigaa.SessionInfo{Name: "A"}, nil)

	now = now.Add(50 * time.Second)
	if _, ok := st.Get(s.ID); !ok {
		t.Fatal("session should be alive")
	}
	now = now.Add(50 * time.Second) // 50s since last touch
	if _, ok := st.Get(s.ID); !ok {
		t.Fatal("touch should have extended the idle timer")
	}
	now = now.Add(2 * time.Minute)
	if _, ok := st.Get(s.ID); ok {
		t.Fatal("session should have expired")
	}
	if st.Len() != 0 {
		t.Fatal("expired session should be deleted")
	}
}

func TestStoreMaxTTL(t *testing.T) {
	now := time.Unix(0, 0)
	st := NewStore(Options{IdleTTL: time.Hour, MaxTTL: 90 * time.Minute, RateLimit: 1, RateBurst: 1})
	st.now = func() time.Time { return now }
	s := st.Create(sigaa.SessionInfo{}, nil)
	for i := 0; i < 3; i++ {
		now = now.Add(40 * time.Minute)
		_, ok := st.Get(s.ID)
		if want := i < 2; ok != want {
			t.Fatalf("step %d: alive=%v, want %v", i, ok, want)
		}
	}
}

func TestCacheCollapsesConcurrentLoads(t *testing.T) {
	c := NewCache()
	var loads atomic.Int32
	release := make(chan struct{})
	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			v, _, err := c.GetOrLoad("k", time.Minute, false, func() (any, error) {
				loads.Add(1)
				<-release
				return 42, nil
			})
			if err != nil || v.(int) != 42 {
				t.Errorf("got %v, %v", v, err)
			}
		}()
	}
	time.Sleep(20 * time.Millisecond)
	close(release)
	wg.Wait()
	if n := loads.Load(); n != 1 {
		t.Errorf("loads = %d, want 1", n)
	}
	// Cached now; refresh forces a new load.
	c.GetOrLoad("k", time.Minute, false, func() (any, error) { loads.Add(1); return 1, nil })
	c.GetOrLoad("k", time.Minute, true, func() (any, error) { loads.Add(1); return 1, nil })
	if n := loads.Load(); n != 2 {
		t.Errorf("loads = %d, want 2", n)
	}
}

func TestCacheDoesNotStoreErrors(t *testing.T) {
	c := NewCache()
	boom := errors.New("boom")
	if _, _, err := c.GetOrLoad("k", time.Minute, false, func() (any, error) { return nil, boom }); err != boom {
		t.Fatal(err)
	}
	v, _, err := c.GetOrLoad("k", time.Minute, false, func() (any, error) { return "ok", nil })
	if err != nil || v != "ok" {
		t.Fatalf("got %v, %v", v, err)
	}
}
