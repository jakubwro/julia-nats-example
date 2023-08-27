import { Construct } from 'constructs';
import { App, Chart, ChartProps } from 'cdk8s';
import { KubeDeployment, KubeService, IntOrString } from './imports/k8s';
import * as fs from 'fs';
import { ConfigMap } from 'cdk8s-plus-25';

export class MyChart extends Chart {
    constructor(scope: Construct, id: string, props: ChartProps = {}) {
        super(scope, id, props);

        // define resources here

        const label = { app: 'julia-nats' };

        new KubeService(this, 'nats-service', {
            metadata: { name: "nats" },
            spec: {
                selector: { "app": "nats" },
                type: 'LoadBalancer',
                ports: [{ name: "nats-metrics", port: 8222, targetPort: IntOrString.fromString("nats-mt-svc") }],
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
                        ]
                    }
                }
            }
        });

        // volumeMounts:
        // - name: config-volume
        //   mountPath: /etc/config

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
                                            key: "grafana-nats-dash.json",
                                            path: "grafana-nats-dash.json"
                                        },
                                        {
                                            key: "grafana-jetstream-dash.json",
                                            path: "grafana-jetstream-dash.json"
                                        },
                                    ]
                                }
                            }
                        ]
                    }
                }
            }
        });

        // new KubeIngress(this, 'ingress-asdf', {
        //     spec: {
        //         rules: [
        //             {
        //                 host: "asdf",
        //                 http: {
        //                     paths: []
        //                 }
        //             }
        //         ]
        //     }
        // })

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
                "grafana-nats-dash.json": fs.readFileSync('grafana/dashboards/grafana-nats-dash.json', 'utf8'),
                "grafana-jetstream-dash.json": fs.readFileSync('grafana/dashboards/grafana-jetstream-dash.json', 'utf8'),
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
    }
}

const app = new App();
new MyChart(app, 'julia-nats-example');
app.synth();
