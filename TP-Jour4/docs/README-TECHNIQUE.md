# Solar Monitoring GitOps - Documentation Technique

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 Kubernetes Cluster (Minikube)                    │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Namespace: solar-prod                         │  │
│  │                                                            │  │
│  │  ┌─────────────────┐    ┌─────────────────┐               │  │
│  │  │ Solar Simulator │───▶│   Prometheus    │               │  │
│  │  │    (Node.js)    │    │   (Métriques)   │               │  │
│  │  │   :3000/metrics │    │     :9090       │               │  │
│  │  └─────────────────┘    └────────┬────────┘               │  │
│  │                                  │                         │  │
│  │                    ┌─────────────┴─────────────┐          │  │
│  │                    ▼                           ▼          │  │
│  │            ┌───────────┐              ┌───────────┐        │  │
│  │            │  Grafana  │              │AlertManager│        │  │
│  │            │   :3000   │              │   :9093    │        │  │
│  │            └───────────┘              └───────────┘        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
# Installation complète
./scripts/setup.sh

# Ou manuellement
kubectl apply -f k8s/apps/solar-simulator/
kubectl apply -f k8s/monitoring/prometheus/
kubectl apply -f k8s/monitoring/alertmanager/
kubectl apply -f k8s/monitoring/grafana/
```

## Accès aux interfaces

| Service | Port-forward | URL | Credentials |
|---------|--------------|-----|-------------|
| Grafana | `kubectl port-forward svc/grafana -n solar-prod 3001:3000` | http://localhost:3001 | admin / admin123 |
| Prometheus | `kubectl port-forward svc/prometheus -n solar-prod 9090:9090` | http://localhost:9090 | - |
| Solar Simulator | `kubectl port-forward svc/solar-simulator -n solar-prod 3000:3000` | http://localhost:3000 | - |
| ArgoCD | `kubectl port-forward svc/argocd-server -n argocd 8080:443` | https://localhost:8080 | admin / (voir setup) |

## Métriques exposées

| Métrique | Type | Labels | Description |
|----------|------|--------|-------------|
| `solar_power_kw` | Gauge | farm | Production totale par ferme (kW) |
| `solar_power_watts` | Gauge | farm, panel_id | Production par panneau (W) |
| `solar_irradiance_wm2` | Gauge | farm | Irradiance solaire (W/m²) |
| `solar_panel_temperature_celsius` | Gauge | farm, panel_id | Température panneau (°C) |
| `solar_ambient_temperature_celsius` | Gauge | farm | Température ambiante (°C) |
| `solar_inverter_status` | Gauge | farm, inverter_id | État onduleur (1=OK, 0=KO) |
| `solar_voltage_volts` | Gauge | farm | Tension moyenne (V) |
| `solar_current_amps` | Gauge | farm | Courant moyen (A) |
| `solar_efficiency_percent` | Gauge | farm | Rendement global (%) |
| `solar_daily_revenue_euros` | Counter | farm | Revenus cumulés (€) |
| `solar_theoretical_power_kw` | Gauge | farm | Production théorique (kW) |
| `solar_availability_ratio` | Gauge | farm | Ratio de disponibilité (0-1) |
| `solar_anomaly_total` | Counter | farm, type, severity | Anomalies détectées |
| `solar_sensor_status` | Gauge | farm | État capteur (1=OK, 0=KO) |

## Alertes configurées

| Alerte | Condition | Durée | Sévérité |
|--------|-----------|-------|----------|
| **SolarPanelOverheating** | `solar_panel_temperature_celsius > 65` | 10 min | Critical |
| **InverterFailure** | `solar_inverter_status == 0` | 2 min | Critical |
| **LowProductionEfficiency** | Production < 50% théorique | 15 min | Warning |
| **SensorDataLoss** | `solar_sensor_status == 0` | 5 min | Warning |
| **SLOAvailabilityBreach** | `solar_availability_ratio < 0.995` | 5 min | Critical |

## Requêtes PromQL utiles

```promql
# Production totale (kW)
sum(solar_power_kw)

# Production par ferme
solar_power_kw

# Disponibilité moyenne (%)
avg(solar_availability_ratio) * 100

# Revenus totaux sur 1h
sum(increase(solar_daily_revenue_euros[1h]))

# Panneaux en surchauffe
solar_panel_temperature_celsius > 65

# Onduleurs en panne
solar_inverter_status == 0

# Ratio production réelle/théorique
solar_power_kw / solar_theoretical_power_kw

# Anomalies par type sur 24h
sum(increase(solar_anomaly_total[24h])) by (type)
```

## Troubleshooting

### 1. Pod en CrashLoopBackOff

```bash
# Vérifier les logs
kubectl logs -n solar-prod <pod-name> --previous

# Vérifier les events
kubectl describe pod -n solar-prod <pod-name>
```

### 2. Métriques non collectées

```bash
# Tester l'endpoint metrics
kubectl exec -n solar-prod deployment/prometheus -- \
  wget -qO- http://solar-simulator:3000/metrics

# Vérifier les targets Prometheus
# URL: http://localhost:9090/targets
```

### 3. Grafana ne montre pas de données

- Vérifier que Prometheus est UP dans les targets
- Vérifier la datasource dans Grafana (Configuration > Data Sources)
- Vérifier que le dashboard utilise la bonne datasource

### 4. Alertes ne se déclenchent pas

```bash
# Vérifier les règles chargées
kubectl exec -n solar-prod deployment/prometheus -- \
  wget -qO- http://localhost:9090/api/v1/rules

# Vérifier AlertManager
kubectl logs -n solar-prod deployment/alertmanager
```

### 5. Image Docker non trouvée

```bash
# Recharger l'image
cd src/solar-simulator
docker build -t solar-simulator:latest .
minikube image load solar-simulator:latest

# Redémarrer le pod
kubectl rollout restart deployment/solar-simulator -n solar-prod
```

## Améliorations futures

### 1. Haute disponibilité
- Déployer Prometheus en mode HA avec Thanos
- Ajouter des réplicas pour le simulateur
- Utiliser un PVC pour la persistence

### 2. Sécurité
- Implémenter RBAC granulaire
- Chiffrer les secrets avec SOPS/Sealed Secrets
- Ajouter NetworkPolicies

### 3. Observabilité avancée
- Ajouter des traces avec Jaeger/Tempo
- Implémenter des logs structurés avec Loki
- Ajouter des SLI/SLO avec Sloth
