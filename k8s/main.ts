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
                "prometheus.yml": fs.readFileSync('prometheus.yaml', 'utf8')
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
                        containers: [
                            {
                                name: 'julia-worker',
                                image: 'julia-worker:0.0.1',
                                imagePullPolicy: "Never",
                            },
                            {
                                name: 'nats-julia-sidecar',
                                image: 'nats-julia-sidecar:0.0.1',
                                imagePullPolicy: "Never",
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