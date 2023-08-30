FROM golang:1.21 as builder

WORKDIR /usr/src/app

COPY go.mod go.sum ./
RUN go mod download && go mod verify

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o ./nats-julia-sidecar

FROM alpine:3.17
RUN ldd; exit 0
COPY --from=builder /usr/src/app/nats-julia-sidecar /

CMD ["/nats-julia-sidecar"]