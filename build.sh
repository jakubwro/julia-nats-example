cd julia-worker/nats-julia-sidecar &&
docker build . -t nats-julia-sidecar:0.0.1 &&
cd ../JuliaWorkerExample &&
docker build . -t julia-worker:0.0.1 &&
kind load docker-image nats-julia-sidecar:0.0.1 julia-worker:0.0.1

