import { Construct } from 'constructs';
import { App, Chart, ChartProps } from 'cdk8s';
import { KubeDeployment, KubeService, IntOrString } from './imports/k8s';

export class MyChart extends Chart {
    constructor(scope: Construct, id: string, props: ChartProps = {}) {
        super(scope, id, props);

        // define resources here

        const label = { app: 'julia-nats' };

        new KubeService(this, 'nats-service', {
            metadata: { name: "nats" },
            spec: {
                publishNotReadyAddresses: true,
                selector: { "app": "nats" },
                type: 'LoadBalancer',
                ports: [{ name: "nats-metrics", port: 8222, targetPort: IntOrString.fromString("nats-mt-svc") }],
            }
        });

        new KubeService(this, 'prometheus-service', {
            metadata: { name: "prometheus" },

            spec: {
                publishNotReadyAddresses: true,
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
                    matchLabels: {"app" : "nats"},
                },
                template: {
                    metadata: { labels: {"app" : "nats"} },
                    spec: {
                        containers: [
                            {
                                name: 'nats',
                                image: 'nats',
                                ports: [
                                    { containerPort: 4222, name: "a" },
                                    { containerPort: 6222, name: "b" },
                                    { containerPort: 8222, name: "nats-mt-svc" }
                                ]
                            }
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

        new KubeDeployment(this, 'prometheus-deployment', {
            metadata: { name: "prometheus", labels: { "app.kubernetes.io/name": "prometheus" } },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: { "app": "prometheus" } 
                },
                template: {
                    metadata: { labels: { "app": "prometheus" }  },
                    spec: {
                        containers: [
                            {
                                name: 'prometheus',
                                image: 'bitnami/prometheus',
                                ports: [{ containerPort: 9090 }]
                            }
                        ]
                    }
                }
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
                                ports: [{ containerPort: 3000 }]
                            }
                        ]
                    }
                }
            }
        });
    }
}

const app = new App();
new MyChart(app, 'julia-nats-example');
app.synth();
