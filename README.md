# julia-nats-example

Experiments with NATS JetStream and Julia workers.

This project is just to test cluster setup.

Goals:
* Create Julia client for NATS to remove a need for sidecar handling communication.
* Find way to interrupt worker to cancel current computation without restart of whole container. Currently sidecar sends SIGINT to the process after timeout.

## Architecture diagram

![architecture-overview-2](https://github.com/jakubwro/julia-nats-example/assets/6503171/4a8f8a38-9ddd-4afc-83dd-aa8248cdeec3)

## Setup

### Cluster

```
brew install kind
kind create cluster --config kind-config.yaml
docker pull julia:1.9.3
docker pull alpine:3.17
kind load docker-image julia:1.9.3
kind load docker-image alpine:3.17

```

### Apply k8s configs

```
cd k8s
npm install
npm run compile && cdk8s synth 
kubectl apply -f dist/julia-nats-example.k8s.yaml -n some_namespace
```


