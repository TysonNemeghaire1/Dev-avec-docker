# Architecture - Solar Monitoring GitOps

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                     Git Repository                               │
│              (Source de vérité GitOps)                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Pull-based sync
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Kubernetes Cluster (Minikube)                    │
│                                                                  │
│  ┌──────────────┐                                               │
│  │   ArgoCD     │ ←── Namespace: argocd                         │
│  │   (GitOps)   │                                               │
│  └──────────────┘                                               │
│          │                                                       │
│          ▼                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Namespace: solar-prod                         │  │
│  │                                                            │  │
│  │  ┌─────────────────┐    ┌─────────────────┐               │  │
│  │  │ Solar Simulator │───▶│   Prometheus    │               │  │
│  │  │    (Node.js)    │    │   (Métriques)   │               │  │
│  │  │   Port: 3000    │    │   Port: 9090    │               │  │
│  │  └─────────────────┘    └────────┬────────┘               │  │
│  │                                  │                         │  │
│  │                    ┌─────────────┼─────────────┐          │  │
│  │                    ▼             ▼             ▼          │  │
│  │            ┌───────────┐  ┌───────────┐  ┌───────────┐    │  │
│  │            │  Grafana  │  │AlertManager│  │   Rules   │    │  │
│  │            │Port: 3000 │  │Port: 9093  │  │  (YAML)   │    │  │
│  │            └───────────┘  └───────────┘  └───────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Composants

### 1. Solar Simulator (Application)

**Rôle** : Simule les données de 3 fermes solaires photovoltaïques

- **Technologie** : Node.js 18 + Express + prom-client
- **Port** : 3000
- **Endpoints** :
  - `GET /health` - Healthcheck
  - `GET /ready` - Readiness
  - `GET /metrics` - Métriques Prometheus
  - `GET /api/farms` - Liste des fermes
  - `GET /api/data` - Données actuelles

**Fermes simulées** :
| Ferme | Location | Panneaux | Capacité |
|-------|----------|----------|----------|
| Provence | Marseille | 5000 | 2.0 MW |
| Occitanie | Montpellier | 3500 | 1.4 MW |
| Aquitaine | Bordeaux | 4200 | 1.68 MW |

### 2. Prometheus (Métriques)

**Rôle** : Collecte et stockage des métriques time-series

- **Image** : prom/prometheus:v2.48.0
- **Port** : 9090
- **Rétention** : 15 jours
- **Scrape interval** : 30 secondes

### 3. Grafana (Visualisation)

**Rôle** : Dashboards et visualisation des métriques

- **Image** : grafana/grafana:10.2.2
- **Port** : 3000
- **Credentials** : admin / admin123

**Dashboard "Solar Farm Monitoring"** :
1. Production Totale (Gauge)
2. Historique Production par Ferme (Time Series)
3. Carte de Chaleur Température (Heatmap)
4. Taux de Disponibilité SLO (Stat)
5. Revenus Journaliers (Bar Chart)
6. Alertes Actives (Table)

### 4. AlertManager (Alertes)

**Rôle** : Gestion et routage des alertes

- **Image** : prom/alertmanager:v0.26.0
- **Port** : 9093

### 5. ArgoCD (GitOps)

**Rôle** : Déploiement continu depuis Git

- **Namespace** : argocd
- **Port** : 443 (HTTPS)

## Métriques exposées

| Métrique | Type | Description |
|----------|------|-------------|
| `solar_power_kw` | Gauge | Production totale par ferme (kW) |
| `solar_power_watts` | Gauge | Production par panneau (W) |
| `solar_irradiance_wm2` | Gauge | Irradiance solaire (W/m²) |
| `solar_panel_temperature_celsius` | Gauge | Température panneau (°C) |
| `solar_ambient_temperature_celsius` | Gauge | Température ambiante (°C) |
| `solar_inverter_status` | Gauge | État onduleur (1=OK, 0=KO) |
| `solar_efficiency_percent` | Gauge | Rendement (%) |
| `solar_daily_revenue_euros` | Counter | Revenus journaliers (€) |
| `solar_availability_ratio` | Gauge | Ratio de disponibilité |
| `solar_anomaly_total` | Counter | Anomalies détectées |

## Règles d'alerting

| Alerte | Condition | Sévérité |
|--------|-----------|----------|
| SolarPanelOverheating | Température > 65°C pendant 10min | Critical |
| InverterFailure | Status onduleur = 0 pendant 2min | Critical |
| LowProductionEfficiency | Production < 50% théorique pendant 15min | Warning |
| SensorDataLoss | Capteur indisponible pendant 5min | Warning |
| SLOAvailabilityBreach | Disponibilité < 99.5% pendant 5min | Critical |

## Ressources Kubernetes

| Composant | CPU Request | CPU Limit | Memory Request | Memory Limit |
|-----------|-------------|-----------|----------------|--------------|
| Solar Simulator | 100m | 200m | 128Mi | 256Mi |
| Prometheus | 100m | 500m | 256Mi | 512Mi |
| Grafana | 100m | 200m | 128Mi | 256Mi |
| AlertManager | 50m | 100m | 64Mi | 128Mi |
