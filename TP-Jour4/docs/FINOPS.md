# Analyse FinOps - Solar Monitoring

## Hypothèses de coût (cluster cloud équivalent)

| Ressource | Tarif |
|-----------|-------|
| CPU | 0.05 €/h par vCPU |
| Stockage | 0.10 €/GB/mois |
| Réseau sortant | 0.09 €/GB |

## Analyse des ressources actuelles

### Tableau de coûts par composant

| Composant | CPU Request | CPU Limit | Memory Request | Memory Limit | Stockage | Coût CPU/mois | Coût Stockage/mois | **Total/mois** |
|-----------|-------------|-----------|----------------|--------------|----------|---------------|--------------------|----|
| Solar Simulator | 100m | 200m | 128Mi | 256Mi | 0 GB | 3.60 € | 0 € | **3.60 €** |
| Prometheus | 100m | 500m | 256Mi | 512Mi | 10 GB | 3.60 € | 1.00 € | **4.60 €** |
| Grafana | 100m | 200m | 128Mi | 256Mi | 2 GB | 3.60 € | 0.20 € | **3.80 €** |
| AlertManager | 50m | 100m | 64Mi | 128Mi | 1 GB | 1.80 € | 0.10 € | **1.90 €** |
| **TOTAL** | **350m** | **1000m** | **576Mi** | **1152Mi** | **13 GB** | **12.60 €** | **1.30 €** | **13.90 €** |

### Calcul détaillé

**Coût CPU** (basé sur les requests, qui garantissent l'allocation) :
- Formula : `CPU_request (en vCPU) × 0.05 €/h × 24h × 30j`
- Solar Simulator : 0.1 vCPU × 0.05 × 24 × 30 = **3.60 €/mois**
- Prometheus : 0.1 vCPU × 0.05 × 24 × 30 = **3.60 €/mois**
- Grafana : 0.1 vCPU × 0.05 × 24 × 30 = **3.60 €/mois**
- AlertManager : 0.05 vCPU × 0.05 × 24 × 30 = **1.80 €/mois**

**Coût Stockage** :
- Prometheus (TSDB 15j) : 10 GB × 0.10 = **1.00 €/mois**
- Grafana (dashboards) : 2 GB × 0.10 = **0.20 €/mois**
- AlertManager : 1 GB × 0.10 = **0.10 €/mois**

**Coût Réseau** (estimé) :
- Trafic métriques interne : négligeable (intra-cluster)
- Trafic dashboard externe : ~5 GB/mois × 0.09 = **0.45 €/mois**

### Coût total mensuel estimé : **~14.35 €/mois**

---

## Optimisations proposées

### Optimisation 1 : Réduction des ressources Prometheus

**Problème** : Prometheus est surdimensionné pour un simulateur avec 3 fermes.

**Avant** :
```yaml
resources:
  requests:
    cpu: "100m"
    memory: "256Mi"
  limits:
    cpu: "500m"
    memory: "512Mi"
```

**Après** :
```yaml
resources:
  requests:
    cpu: "50m"
    memory: "128Mi"
  limits:
    cpu: "200m"
    memory: "256Mi"
```

**Économie** :
- CPU : 0.05 vCPU × 0.05 × 24 × 30 = **1.80 €/mois**
- Mémoire : réduction de 50%
- **Total : -1.80 €/mois (-13%)**

---

### Optimisation 2 : Réduction de la rétention Prometheus

**Problème** : 15 jours de rétention avec stockage persistant est excessif pour un PoC.

**Avant** :
```yaml
args:
  - "--storage.tsdb.retention.time=15d"
# Stockage estimé : 10 GB
```

**Après** :
```yaml
args:
  - "--storage.tsdb.retention.time=7d"
# Stockage estimé : 5 GB
```

**Économie** :
- Stockage : 5 GB × 0.10 = **0.50 €/mois**
- **Total : -0.50 €/mois (-4%)**

---

### Optimisation 3 : Utilisation d'un scrape interval adaptatif

**Problème** : Scrape toutes les 30s pour des données qui changent lentement.

**Avant** :
```yaml
global:
  scrape_interval: 30s
```

**Après** :
```yaml
global:
  scrape_interval: 60s  # Données solaires = variations lentes

scrape_configs:
  - job_name: 'solar-simulator'
    scrape_interval: 30s  # Garder 30s pour les alertes critiques
```

**Économie** :
- Réduction de 50% du volume de données stockées
- Réduction de la charge CPU Prometheus
- Stockage : -2 GB = **0.20 €/mois**
- CPU indirect : **~0.50 €/mois**
- **Total : -0.70 €/mois (-5%)**

---

## Résumé des optimisations

| Optimisation | Économie/mois | Impact |
|--------------|---------------|--------|
| Réduction ressources Prometheus | -1.80 € | -13% |
| Réduction rétention 15j → 7j | -0.50 € | -4% |
| Scrape interval adaptatif | -0.70 € | -5% |
| **TOTAL** | **-3.00 €** | **-21%** |

### Coût optimisé : **~11.35 €/mois** (vs 14.35 € initial)

---

## Recommandations supplémentaires

### Court terme (sans impact fonctionnel)
1. ✅ Appliquer les 3 optimisations ci-dessus
2. Utiliser `emptyDir` au lieu de PVC pour les environnements de dev
3. Désactiver les métriques Prometheus par défaut non utilisées

### Moyen terme (production)
1. Utiliser **Prometheus Operator** avec ServiceMonitors pour une gestion plus fine
2. Implémenter **VPA (Vertical Pod Autoscaler)** pour ajuster automatiquement les ressources
3. Utiliser **Thanos** ou **Cortex** pour le stockage long terme externalisé

### Long terme (multi-cluster)
1. Centraliser le monitoring avec un Prometheus fédéré
2. Utiliser **Grafana Cloud** (tier gratuit : 10k métriques) pour réduire l'infra
3. Implémenter du **downsampling** pour les données historiques
