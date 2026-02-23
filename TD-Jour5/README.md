# TP JOUR 5 - Platform Engineering & SRE Avancé
## Master 2 Full Stack - Docker & Kubernetes

![Platform Engineering](https://img.shields.io/badge/Platform-Engineering-blue)
![Kubernetes](https://img.shields.io/badge/Kubernetes-1.30-326CE5?logo=kubernetes)
![Backstage](https://img.shields.io/badge/Backstage-IDP-9BF0E1?logo=backstage)
![Kyverno](https://img.shields.io/badge/Kyverno-Policy-5B8DEE)
![Tekton](https://img.shields.io/badge/Tekton-CI/CD-FD495C?logo=tekton)

---

## 📚 Vue d'ensemble

Ce TP de 3 heures vous guide dans la construction d'une **Internal Developer Platform (IDP)** pour TechMarket, une marketplace e-commerce. Vous allez mettre en place les pratiques de Platform Engineering et SRE utilisées par les entreprises tech leaders (Google, Netflix, Spotify).

### 🎯 Objectifs pédagogiques

- ✅ Déployer et configurer **Backstage** comme portail IDP
- ✅ Implémenter **Policy as Code** avec Kyverno
- ✅ Sécuriser la **supply chain** avec Cosign et Sigstore
- ✅ Définir et monitorer des **SLOs** (Service Level Objectives)
- ✅ Pratiquer le **Chaos Engineering** avec Litmus
- ✅ Créer des **pipelines CI/CD sécurisés** avec Tekton

### 🏗️ Architecture de la Plateforme TechMarket

```
┌─────────────────────────────────────────────────────────────┐
│                    BACKSTAGE PORTAL (IDP)                    │
│  Software Catalog | Templates | TechDocs | Kubernetes Plugin │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   KUBERNETES CLUSTER                         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Frontend   │  │   Backend    │  │   Payment    │     │
│  │   (React)    │→ │   (Node.js)  │→ │   Service    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         ↓                  ↓                  ↓             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            KYVERNO ADMISSION CONTROLLER              │  │
│  │  ✓ Deny :latest  ✓ Require resources  ✓ Verify Sign │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              PROMETHEUS + GRAFANA                     │  │
│  │  SLIs: Success Rate, Latency P95, Error Budget       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              LITMUS CHAOS ENGINE                      │  │
│  │  Experiments: pod-delete, network-latency             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↑
                    ┌─────────────────┐
                    │  TEKTON PIPELINE │
                    │  Build → Scan →  │
                    │  Sign → Deploy   │
                    └─────────────────┘
```

---

## 📂 Contenu du TP

- **ENONCE.md** : Énoncé complet du TP (4 blocs de 45 minutes)
- **AIDE.md** : Guide d'aide avec exemples et troubleshooting
- **kind-config.yaml** : Configuration du cluster Kubernetes local
- **backstage/** : Exemples de catalog et templates
- **kyverno/** : Exemples de policies
- **prometheus/** : Exemples de SLO rules
- **sre/** : Templates de postmortem
- **litmus/** : Dossier pour les chaos experiments
- **tekton/** : Dossier pour les pipelines CI/CD
- **microservices/** : Application TechMarket complète (frontend, backend, payment-service)

---

## 🚀 Démarrage rapide

### Prérequis

```bash
# Vérifier les versions des outils
kubectl version --client  # v1.28+
helm version              # v3.12+
docker version            # v24+
kind version              # v0.20+
cosign version            # v2.0+
tkn version               # v0.32+
```

**Comptes nécessaires** :
- Compte GitHub (pour OAuth et GitHub Container Registry)
- Token GitHub avec permissions `repo`, `read:packages`, `write:packages`

### Installation (15 min)

#### 1. Créer le cluster Kubernetes

```bash
# Créer le cluster Kind avec la configuration fournie
kind create cluster --name techmarket --config kind-config.yaml

# Vérifier que le cluster est opérationnel
kubectl cluster-info
kubectl get nodes
```

#### 2. Installer les composants

```bash
# Backstage
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install backstage bitnami/backstage \
  --namespace backstage --create-namespace \
  --set postgresql.enabled=true \
  --set service.type=NodePort \
  --set service.nodePorts.backend=30000

# Kyverno
helm repo add kyverno https://kyverno.github.io/kyverno/
helm install kyverno kyverno/kyverno \
  --namespace kyverno --create-namespace \
  --set replicaCount=3

# Litmus Chaos
helm repo add litmuschaos https://litmuschaos.github.io/litmus-helm/
helm install chaos litmuschaos/litmus \
  --namespace litmus --create-namespace \
  --set portal.frontend.service.type=NodePort \
  --set portal.frontend.service.nodePort=30002

# Tekton
kubectl apply -f https://storage.googleapis.com/tekton-releases/pipeline/latest/release.yaml
kubectl apply -f https://storage.googleapis.com/tekton-releases/dashboard/latest/release.yaml
```

#### 3. Accéder aux interfaces

```bash
# Backstage
echo "Backstage: http://localhost:30000"

# Litmus Chaos Center
echo "Litmus: http://localhost:30002"
echo "Username: admin / Password: litmus"

# Tekton Dashboard
kubectl port-forward -n tekton-pipelines svc/tekton-dashboard 9097:9097
echo "Tekton: http://localhost:9097"
```

---

## 📋 Déroulement du TP (3h)

### Bloc 1 - Platform Engineering & Backstage (45 min)

**Objectifs** :
- Déployer Backstage comme portail IDP
- Créer un Software Catalog pour les 3 microservices
- Créer un Software Template (Golden Path)
- Intégrer le plugin Kubernetes

**Voir** : `ENONCE.md` section "BLOC 1"

---

### Bloc 2 - Policy as Code & Supply Chain Security (45 min)

**Objectifs** :
- Déployer Kyverno comme admission controller
- Créer des ClusterPolicies (deny-latest, require-limits, add-labels)
- Signer des images avec Cosign (keyless)
- Vérifier les signatures à l'admission

**Voir** : `ENONCE.md` section "BLOC 2"

---

### Bloc 3 - SRE Culture & Chaos Engineering (45 min)

**Objectifs** :
- Définir des SLIs/SLOs pour le payment-service
- Installer Litmus Chaos
- Exécuter un chaos experiment (pod-delete)
- Rédiger un postmortem blameless

**Voir** : `ENONCE.md` section "BLOC 3"

---

### Bloc 4 - CI/CD Avancé avec Tekton (45 min)

**Objectifs** :
- Installer Tekton Pipelines
- Créer des Tasks (Kaniko, Trivy, Cosign, SBOM)
- Assembler un Pipeline complet
- Exécuter un PipelineRun

**Voir** : `ENONCE.md` section "BLOC 4"

---

## 📚 Ressources

### Documentation officielle
- [Backstage](https://backstage.io/docs)
- [Kyverno](https://kyverno.io/docs)
- [Cosign](https://docs.sigstore.dev/cosign/overview)
- [Litmus Chaos](https://docs.litmuschaos.io)
- [Tekton](https://tekton.dev/docs)

### Livres recommandés
- **Site Reliability Engineering** (Google) - [sre.google/books](https://sre.google/books/)
- **The DevOps Handbook** (Gene Kim)
- **Accelerate** (Nicole Forsgren)

### Certifications
- **CKA** (Certified Kubernetes Administrator)
- **CKS** (Certified Kubernetes Security Specialist)
- **FCSA** (CNCF Security Specialist)

---

## 🐛 Troubleshooting

Consultez le fichier **AIDE.md** pour :
- Solutions aux problèmes courants
- Commandes de débogage
- Exemples de code

---

## 🧹 Nettoyage

```bash
# Supprimer le cluster Kind
kind delete cluster --name techmarket

# Nettoyer les images Docker locales
docker system prune -a
```

---

## 🎉 Bon courage !

N'oubliez pas :
- **Lisez l'énoncé complet** avant de commencer
- **Consultez l'aide** en cas de blocage
- **Travaillez en équipe** et partagez vos découvertes
- **Amusez-vous** ! Le Platform Engineering est passionnant 🚀

---

**Formateur** : Ayoub Benhamdi  
**Date** : Janvier 2026  
**Durée** : 3 heures  
**Niveau** : Master 2 Full Stack
