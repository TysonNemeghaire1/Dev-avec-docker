# Postmortem Template - TechMarket Platform

**Date de l'incident** : [YYYY-MM-DD]  
**Auteur** : [Votre nom]  
**Réviseurs** : [Noms des réviseurs]  
**Statut** : Draft / In Review / Final

---

## 📋 Résumé Exécutif

[2-3 phrases résumant l'incident, son impact et la cause racine]

**Exemple** : Le 15 janvier 2026, le payment-service a subi une panne de 12 minutes causée par un déploiement défectueux. 5% des transactions ont échoué, impactant environ 200 utilisateurs. La cause racine était l'absence de readiness probe, permettant au load balancer de router du trafic vers des pods non prêts.

---

## 📊 Impact

| Métrique | Valeur |
|----------|--------|
| **Durée totale** | XX minutes |
| **Utilisateurs impactés** | ~XXX utilisateurs |
| **Transactions échouées** | XXX transactions |
| **Perte de revenus estimée** | XXX € |
| **Success Rate minimum** | XX% (SLO: 99.9%) |
| **Error Budget consommé** | XX% du budget mensuel |

**Services affectés** :
- ❌ payment-service (DOWN)
- ⚠️ backend-api (Dégradé)
- ✅ frontend-app (OK)

---

## ⏱️ Chronologie

| Heure | Événement | Acteur/Système |
|-------|-----------|----------------|
| 14:00:00 | Déploiement de payment-service v1.2.0 | CI/CD Pipeline |
| 14:00:15 | Premiers pods démarrés, marqués "Ready" | Kubernetes |
| 14:00:20 | Alertes "HighErrorRate" déclenchées | Prometheus |
| 14:00:25 | Équipe SRE notifiée via PagerDuty | Alertmanager |
| 14:01:00 | Investigation démarrée | SRE Engineer |
| 14:02:00 | Identification: pods non prêts reçoivent du trafic | SRE Engineer |
| 14:03:00 | Décision: Rollback vers v1.1.0 | SRE Engineer |
| 14:05:00 | Rollback exécuté | kubectl |
| 14:08:00 | Nouveaux pods healthy | Kubernetes |
| 14:10:00 | Success Rate revient à 100% | Prometheus |
| 14:12:00 | Incident résolu, monitoring continu | SRE Team |

---

## 🔍 Cause Racine (Root Cause Analysis)

### Méthode des 5 Pourquoi

1. **Pourquoi le service était-il indisponible ?**
   - Parce que les requêtes HTTP retournaient des erreurs 503.

2. **Pourquoi les requêtes retournaient-elles 503 ?**
   - Parce que les pods recevaient du trafic alors qu'ils n'étaient pas prêts.

3. **Pourquoi les pods recevaient-ils du trafic alors qu'ils n'étaient pas prêts ?**
   - Parce que Kubernetes les marquait comme "Ready" trop tôt.

4. **Pourquoi Kubernetes les marquait-il comme "Ready" trop tôt ?**
   - Parce qu'il n'y avait pas de readinessProbe configurée.

5. **Pourquoi n'y avait-il pas de readinessProbe ?**
   - Parce que le template de déploiement (Golden Path) ne l'incluait pas par défaut.

### Cause Racine

**Absence de readinessProbe dans le Deployment**, permettant à Kubernetes de router du trafic vers des pods qui n'avaient pas encore terminé leur initialisation (connexion DB, chargement de config, etc.).

---

## ✅ Ce qui a bien fonctionné

- ✅ **Détection rapide** : Alertes Prometheus déclenchées en 20 secondes
- ✅ **Notification efficace** : Équipe SRE alertée immédiatement via PagerDuty
- ✅ **Runbook clair** : Procédure de rollback documentée et exécutée rapidement
- ✅ **Communication** : Status page mise à jour en temps réel
- ✅ **Monitoring** : Métriques détaillées ont permis d'identifier rapidement le problème

---

## ❌ Ce qui a mal fonctionné

- ❌ **Absence de readinessProbe** : Erreur de configuration de base
- ❌ **Tests pré-production insuffisants** : Le problème aurait dû être détecté en staging
- ❌ **Déploiement trop rapide** : Rollout à 100% immédiat, pas de Canary
- ❌ **Pas de PodDisruptionBudget** : Aucune garantie de disponibilité minimale
- ❌ **Documentation manquante** : Les développeurs ne savaient pas qu'une readinessProbe était nécessaire

---

## 🔧 Actions Correctives

| Action | Responsable | Deadline | Statut |
|--------|-------------|----------|--------|
| Ajouter readinessProbe au payment-service | Team Payments | 2026-01-16 | ✅ Done |
| Mettre à jour le Golden Path template avec readinessProbe obligatoire | Platform Team | 2026-01-18 | 🔄 In Progress |
| Créer une ClusterPolicy Kyverno pour exiger readinessProbe | Platform Team | 2026-01-20 | ⏳ Todo |
| Implémenter Canary deployments avec Argo Rollouts | DevOps Team | 2026-01-25 | ⏳ Todo |
| Ajouter des tests de charge en staging | QA Team | 2026-01-30 | ⏳ Todo |
| Créer un PodDisruptionBudget pour tous les services critiques | SRE Team | 2026-01-22 | ⏳ Todo |
| Documenter les best practices de health checks | Tech Writers | 2026-02-01 | ⏳ Todo |

---

## 📚 Leçons Apprises

### Pour les Développeurs
- **Toujours configurer readinessProbe et livenessProbe** : Ce n'est pas optionnel pour un service en production
- **Tester en conditions réelles** : Les tests unitaires ne suffisent pas, il faut des tests d'intégration et de charge

### Pour la Platform Team
- **Golden Paths doivent inclure les best practices** : Sécurité et fiabilité par défaut
- **Policy as Code** : Automatiser la validation avec Kyverno pour éviter les erreurs humaines

### Pour l'Organisation
- **Progressive Delivery** : Ne jamais déployer à 100% immédiatement, utiliser Canary ou Blue/Green
- **Error Budget** : Cet incident a consommé 27% du budget mensuel, il faut ralentir les déploiements

---

## 📎 Annexes

### Logs Pertinents

```
2026-01-15 14:00:20 payment-service-7d9f8b-xyz [ERROR] Database connection timeout
2026-01-15 14:00:21 payment-service-7d9f8b-xyz [ERROR] Failed to initialize service
2026-01-15 14:00:22 payment-service-7d9f8b-xyz [ERROR] HTTP 503: Service Unavailable
```

### Métriques

![Success Rate Graph](link-to-grafana-dashboard)

### Références
- [Kubernetes Best Practices: Health Checks](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Google SRE Book: Postmortem Culture](https://sre.google/sre-book/postmortem-culture/)

---

## 🤝 Remerciements

Merci à l'équipe SRE pour la réactivité, à l'équipe Payments pour la collaboration, et à tous ceux qui ont contribué à la résolution rapide de cet incident.

---

**Note** : Ce postmortem est blameless. L'objectif est d'apprendre et d'améliorer nos systèmes, pas de pointer du doigt des individus.
