# syntax=docker/dockerfile:1

FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM golang:1.27-alpine AS server
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/sbb ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=server /out/sbb /app/sbb
COPY --from=web /web/dist /app/public
ENV STATIC_DIR=/app/public PORT=8080
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/app/sbb"]
