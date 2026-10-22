package api

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// spaHandler serves the Vite build. Unknown paths get index.html so client-side
// routes (/turmas/…) survive a reload; hashed assets are cached forever.
func spaHandler(dir string) http.Handler {
	files := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		p := path.Clean("/" + r.URL.Path)
		if p != "/" {
			if info, err := os.Stat(filepath.Join(dir, filepath.FromSlash(p))); err == nil && !info.IsDir() {
				if strings.HasPrefix(p, "/assets/") {
					w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
				}
				files.ServeHTTP(w, r)
				return
			}
		}
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, filepath.Join(dir, "index.html"))
	})
}
