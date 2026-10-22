.PHONY: dev-server dev-web test lint build docker

dev-server:            ## Go BFF on :8080 (plain-HTTP cookie for localhost)
	cd server && COOKIE_SECURE=false go run ./cmd/server

dev-web:               ## Vite on :5173, proxies /api to :8080
	cd web && npm run dev

test:
	cd server && go vet ./... && go test -race ./...
	cd web && npm run typecheck && npm test -- --run

lint:
	cd server && test -z "$$(gofmt -l .)"
	cd web && npm run lint

build:
	cd web && npm run build
	cd server && CGO_ENABLED=0 go build -o bin/sbb ./cmd/server

docker:
	docker build -t sigaa-but-better .
