cd julia-worker/nats-julia-sidecar &&
docker build . -t ghcr.io/jakubwro/nats-julia-sidecar:0.0.1 &&
cd ../JuliaWorkerExample &&
docker build . -t ghcr.io/jakubwro/julia-worker:0.0.1 &&
docker push ghcr.io/jakubwro/nats-julia-sidecar:0.0.1 &&
docker push ghcr.io/jakubwro/julia-worker:0.0.1


