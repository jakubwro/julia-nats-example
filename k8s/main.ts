import { Construct } from 'constructs';
import { App, Chart, ChartProps } from 'cdk8s';
import { KubeDeployment, KubeService, IntOrString } from './imports/k8s';
import * as fs from 'fs';
import { ConfigMap } from 'cdk8s-plus-25';

export class MyChart extends Chart {
    constructor(scope: Construct, id: string, props: ChartProps = {}) {
        super(scope, id, props);

        const label = { app: 'julia-nats' };

        new KubeService(this, 'nats-service', {
            metadata: { name: "nats" },
            spec: {
                selector: { "app": "nats" },
                type: 'LoadBalancer',
                ports: [
                    { name: "nats-metrics", port: 8222, targetPort: IntOrString.fromString("nats-mt-svc") },
                    { name: "nats-endpoint", port: 4222, targetPort: IntOrString.fromNumber(4222) }
                ],
            }
        });

        new KubeService(this, 'nats-exporter', {
            metadata: { name: "nats-exporter" },
            spec: {
                selector: { "app": "nats-exporter" },
                type: 'LoadBalancer',
                ports: [{ name: "nats-exporter", port: 7777, targetPort: IntOrString.fromNumber(7777) }],
            }
        });

        new KubeService(this, 'prometheus-service', {
            metadata: { name: "prometheus" },

            spec: {
                selector: { "app": "prometheus" },
                type: 'LoadBalancer',
                ports: [{ name: "prometheus-svc", port: 9090, targetPort: IntOrString.fromNumber(9090) }],
                // selector: label
            }
        });

        new KubeDeployment(this, 'nats-deployment', {
            metadata: { name: "nats", labels: { "app.kubernetes.io/name": "nats" } },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: { "app": "nats" },
                },
                template: {
                    metadata: { labels: { "app": "nats" } },
                    spec: {
                        containers: [
                            {
                                name: 'nats',
                                image: 'nats',
                                ports: [
                                    { containerPort: 4222, name: "a" },
                                    { containerPort: 6222, name: "b" },
                                    { containerPort: 8222, name: "nats-mt-svc" }
                                ],
                                volumeMounts: [
                                    {
                                        name: "nats-config-volume",
                                        mountPath: "nats-server.conf",
                                        subPath: "nats-server.conf"
                                    }
                                ]
                            }
                        ],
                        volumes: [
                            {
                                name: "nats-config-volume",
                                configMap: {
                                    name: "nats-config"
                                }
                            },
                        ]
                    }
                }
            }
        });

        new KubeDeployment(this, 'prometheus-nats-exporter-deployment', {
            metadata: { name: "nats-exporter", labels: { "app.kubernetes.io/name": "nats-exporter" } },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: { "app": "nats-exporter" }
                },
                template: {
                    metadata: { labels: { "app": "nats-exporter" } },
                    spec: {
                        containers: [
                            {
                                name: 'prometheus-nats-exporter',
                                image: 'natsio/prometheus-nats-exporter',
                                args: ["-varz", "-jsz=all", "http://nats:8222"],
                                ports: [{ containerPort: 7777 }]
                            }
                        ],
                        initContainers: [
                            {
                                name: "wait-for-nats-metrics",
                                image: "busybox",
                                args: ['sh', '-c', "until nslookup nats.$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace).svc.cluster.local; do echo waiting for nats; sleep 2; done"]
                            }
                        ]
                    }
                }
            }
        });

        new KubeDeployment(this, 'prometheus-deployment', {
            metadata: { name: "prometheus", labels: { "app.kubernetes.io/name": "prometheus" } },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: { "app": "prometheus" }
                },
                template: {
                    metadata: { labels: { "app": "prometheus" } },
                    spec: {
                        containers: [
                            {
                                name: 'prometheus',
                                image: 'bitnami/prometheus',
                                ports: [{ containerPort: 9090 }],
                                volumeMounts: [
                                    {
                                        name: "prometheus-config-volume",
                                        mountPath: "/etc/prometheus/prometheus.yml",
                                        subPath: "prometheus.yml"
                                    }
                                ]
                            }
                        ],
                        volumes: [
                            {
                                name: "prometheus-config-volume",
                                configMap: {
                                    name: "prometheus-config"
                                }
                            }
                        ]
                    },
                },

            }
        });

        new KubeDeployment(this, 'grafana-deployment', {
            metadata: { name: "grafana", labels: { "app.kubernetes.io/name": "grafana" } },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: label
                },
                template: {
                    metadata: { labels: label },
                    spec: {
                        containers: [
                            {
                                name: 'grafana',
                                image: 'grafana/grafana',
                                ports: [{ containerPort: 3000 }],
                                volumeMounts: [
                                    {
                                        name: "grafana-config-volume",
                                        mountPath: "/etc/grafana/provisioning",
                                    },
                                    {
                                        name: "grafana-ini-volume",
                                        mountPath: "/etc/grafana/grafana.ini",
                                        subPath: "grafana.ini"
                                    },
                                    {
                                        name: "grafana-dashboards-config",
                                        mountPath: "/var/lib/grafana/dashboards",
                                    }
                                ]
                            }
                        ],
                        volumes: [
                            {
                                name: "grafana-config-volume",
                                configMap: {
                                    name: "grafana-config",
                                    items: [
                                        {
                                            key: "all.yaml",
                                            path: "dashboards/all.yaml"
                                        },
                                        {
                                            key: "prometheus.yaml",
                                            path: "datasources/prometheus.yaml"
                                        }
                                    ]
                                }
                            },
                            {
                                name: "grafana-ini-volume",
                                configMap: {
                                    name: "grafana-ini"
                                }
                            },
                            {
                                name: "grafana-dashboards-config",
                                configMap: {
                                    name: "grafana-dashboards-config",
                                    items: [
                                        {
                                            key: "nats.json",
                                            path: "nats.json"
                                        },
                                        {
                                            key: "jetstream.json",
                                            path: "jetstream.json"
                                        },
                                        {
                                            key: "prometheus-2.0.json",
                                            path: "prometheus-2.0.json"
                                        },
                                    ]
                                }
                            }
                        ]
                    }
                }
            }
        });

        new ConfigMap(this, "prometheus-config", {
            metadata: { name: "prometheus-config" },
            data: {
                "prometheus.yml": fs.readFileSync('prometheus/prometheus.yaml', 'utf8')
            }
        });

        new ConfigMap(this, "grafana-config", {
            metadata: { name: "grafana-config" },
            data: {
                "all.yaml": fs.readFileSync('grafana/provisioning/dashboards/all.yaml', 'utf8'),
                "prometheus.yaml": fs.readFileSync('grafana/provisioning/datasources/prometheus.yaml', 'utf8')
            }
        });

        new ConfigMap(this, "grafana-dashboards-config", {
            metadata: { name: "grafana-dashboards-config" },
            data: {
                "nats.json": fs.readFileSync('grafana/dashboards/nats.json', 'utf8'),
                "jetstream.json": fs.readFileSync('grafana/dashboards/jetstream.json', 'utf8'),
                "prometheus-2.0.json": fs.readFileSync('grafana/dashboards/prometheus-2.0.json', 'utf8'),
            }
        });

        new ConfigMap(this, "grafana-ini", {
            metadata: { name: "grafana-ini" },
            data: {
                "grafana.ini": fs.readFileSync('grafana/grafana.ini', 'utf8'),
            }
        });

        new ConfigMap(this, "nats-config", {
            metadata: { name: "nats-config" },
            data: {
                "nats-server.conf": fs.readFileSync('nats/nats-server.conf', 'utf8'),
            }
        });

        new KubeDeployment(this, 'julia-worker-deployment', {
            metadata: { name: "julia-worker", labels: { "app.kubernetes.io/name": "julia-worker" } },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: { "app": "julia-worker" }
                },
                template: {
                    metadata: { labels: { "app": "julia-worker" } },
                    spec: {
                        shareProcessNamespace: true,
                        // TODO: handle SIGINT to julia process instad of default SIGTERM, probably with custom operator
                        // https://docs.julialang.org/en/v1/manual/faq/#catch-ctrl-c
                        // https://docs.julialang.org/en/v1/base/base/#Base.atexit
                        // https://docs.julialang.org/en/v1/base/base/#Core.InterruptException
                        // https://docs.julialang.org/en/v1/base/c/#Base.exit_on_sigint
                        // https://github.com/kubernetes/kubernetes/issues/24957
                        // https://github.com/kubernetes/enhancements/issues/1977
                        // https://github.com/kubernetes/enhancements/issues/1977
                        // https://github.com/stakater/Reloader
                        // https://stackoverflow.com/questions/49172671/multiple-liveness-probes-in-kuberenetes
                        volumes: [
                            {
                                name: "liveness-probe-volume",
                                emptyDir: {}
                            }
                        ],
                        containers: [
                            {
                                name: 'julia-worker',
                                image: 'ghcr.io/jakubwro/julia-worker:0.0.1',
                                imagePullPolicy: "Always",
                                volumeMounts: [{ name: "liveness-probe-volume", mountPath: "/tmp/liveness" }],
                                livenessProbe: {
                                    exec: {
                                      command: [
                                        "cat",
                                        "/tmp/liveness/healthy",
                                      ],
                                    //   command: ['sh', '-c',  "[ $(stat -c %Y  /tmp/liveness/done) -lt $(($(stat -c %Y  /tmp/liveness/start)+10)) ]"]
                                    },
                                    initialDelaySeconds: 5,
                                    periodSeconds: 5
                                  }
                            },
                            {
                                name: 'nats-julia-sidecar',
                                image: 'ghcr.io/jakubwro/nats-julia-sidecar:0.0.1',
                                imagePullPolicy: "Always",
                                volumeMounts: [{ name: "liveness-probe-volume", mountPath: "/tmp/liveness" }],
                            }
                        ],
                        initContainers: [
                            {
                                name: "init-liveness-check",
                                image: "busybox",
                                volumeMounts: [{ name: "liveness-probe-volume", mountPath: "/tmp/liveness" }],
                                args: ['sh', '-c', "touch /tmp/liveness/healthy"]
                            }
                        ]
                    }
                }
            }
        })

    }
}

const app = new App();
new MyChart(app, 'julia-nats-example');
app.synth();
