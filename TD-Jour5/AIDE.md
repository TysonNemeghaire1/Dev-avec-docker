# 📖 Guide d'Aide - TP Platform Engineering

Ce document contient des aides, exemples et explications pour vous guider dans le TP.

---

## 🎯 BLOC 1 - Backstage

### Aide 1.1 - Installation Backstage

```bash
# Ajouter le repo Helm Bitnami
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Installer Backstage
helm install backstage bitnami/backstage \
  --namespace backstage \
  --create-namespace \
  --set postgresql.enabled=true \
  --set service.type=NodePort \
  --set service.nodePorts.backend=30000 \
  --timeout 10m

# Attendre que tous les pods soient prêts
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=backstage -n backstage --timeout=300s

# Obtenir l'URL d'accès
echo "Backstage URL: http://localhost:30000"
```

### Aide 1.2 - Structure catalog-info.yaml

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: NOM_DU_SERVICE
  description: Description du service
  annotations:
    # Lien vers le repo GitHub
    github.com/project-slug: VOTRE_USER/VOTRE_REPO
    # ID pour le plugin Kubernetes
    backstage.io/kubernetes-id: NOM_DU_SERVICE
    # Lien vers la documentation
    backstage.io/techdocs-ref: dir:.
  tags:
    - nodejs
    - api
    - production
  links:
  - url: https://github.com/VOTRE_USER/VOTRE_REPO
    title: Repository
    icon: github
spec:
  type: service
  lifecycle: production  # ou experimental, deprecated
  owner: team-backend    # Nom de l'équipe propriétaire
  system: techmarket-platform
  dependsOn:
  - component:default/postgres-db
  providesApis:
  - payment-api
```

### Aide 1.3 - Enregistrer un composant dans Backstage

```bash
# Méthode 1: Via l'interface web
# 1. Allez sur http://localhost:30000
# 2. Cliquez sur "Create..." puis "Register Existing Component"
# 3. Entrez l'URL de votre catalog-info.yaml sur GitHub
# Exemple: https://github.com/VOTRE_USER/VOTRE_REPO/blob/main/catalog-info.yaml

# Méthode 2: Via un fichier de configuration
# Créez un fichier catalog-locations.yaml
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: backstage-catalog-locations
  namespace: backstage
data:
  locations.yaml: |
    catalog:
      locations:
      - type: url
        target: https://github.com/VOTRE_USER/frontend-app/blob/main/catalog-info.yaml
      - type: url
        target: https://github.com/VOTRE_USER/backend-api/blob/main/catalog-info.yaml
      - type: url
        target: https://github.com/VOTRE_USER/payment-service/blob/main/catalog-info.yaml
EOF
```

---

## 🔒 BLOC 2 - Kyverno & Cosign

### Aide 2.1 - Installation Kyverno

```bash
# Ajouter le repo Helm
helm repo add kyverno https://kyverno.github.io/kyverno/
helm repo update

# Installer Kyverno en mode HA
helm install kyverno kyverno/kyverno \
  --namespace kyverno \
  --create-namespace \
  --set replicaCount=3 \
  --set resources.limits.memory=512Mi

# Vérifier l'installation
kubectl get pods -n kyverno
kubectl get crd | grep kyverno.io

# Vous devriez voir ces CRDs:
# - clusterpolicies.kyverno.io
# - policies.kyverno.io
# - policyreports.wgpolicyk8s.io
```

### Aide 2.2 - Structure d'une ClusterPolicy Kyverno

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: nom-de-la-policy
  annotations:
    policies.kyverno.io/title: Titre descriptif
    policies.kyverno.io/category: Security
    policies.kyverno.io/severity: high
    policies.kyverno.io/description: |
      Description détaillée de ce que fait la policy
spec:
  # Mode de validation
  validationFailureAction: Enforce  # ou Audit (ne bloque pas, juste log)
  
  # Arrière-plan: applique la policy aux ressources existantes
  background: true
  
  rules:
  - name: nom-de-la-regle
    # Quelles ressources cibler
    match:
      any:
      - resources:
          kinds:
          - Pod
          - Deployment
    
    # Validation (pour bloquer)
    validate:
      message: "Message d'erreur si la validation échoue"
      pattern:
        spec:
          containers:
          - name: "*"
            # Pattern à respecter
            image: "!*:latest"  # ! signifie "ne doit PAS matcher"
```

### Aide 2.3 - Tester une Policy

```bash
# Créer un pod de test qui devrait être bloqué
kubectl run test-nginx --image=nginx:latest

# Si la policy fonctionne, vous verrez:
# Error from server: admission webhook "validate.kyverno.svc" denied the request

# Vérifier les policy reports
kubectl get policyreport -A

# Voir les détails d'un rapport
kubectl describe policyreport <report-name> -n <namespace>
```

### Aide 2.4 - Mutation avec Kyverno

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: add-labels
spec:
  background: true
  rules:
  - name: add-cost-center
    match:
      any:
      - resources:
          kinds:
          - Pod
    # Mutation au lieu de validation
    mutate:
      patchStrategicMerge:
        metadata:
          labels:
            +(cost-center): "techmarket"  # + signifie "ajouter si absent"
            +(managed-by): "platform-team"
```

### Aide 2.5 - Cosign : Signature d'images

```bash
# Prérequis: Authentification à GitHub Container Registry
export GITHUB_TOKEN="votre_token_github"
echo $GITHUB_TOKEN | docker login ghcr.io -u VOTRE_USER --password-stdin

# Build et push de l'image
docker build -t ghcr.io/VOTRE_USER/payment-service:v1.0.0 ./payment-service
docker push ghcr.io/VOTRE_USER/payment-service:v1.0.0

# Signature keyless (utilise votre identité GitHub via OIDC)
cosign sign --yes ghcr.io/VOTRE_USER/payment-service:v1.0.0

# Vous serez redirigé vers GitHub pour autoriser l'authentification
# Un certificat éphémère sera généré par Fulcio
# La signature sera stockée dans Rekor (log de transparence)

# Vérification de la signature
cosign verify \
  --certificate-identity=VOTRE_EMAIL@example.com \
  --certificate-oidc-issuer=https://github.com/login/oauth \
  ghcr.io/VOTRE_USER/payment-service:v1.0.0

# Output attendu:
# Verification for ghcr.io/...
# The following checks were performed on each of these signatures:
#   - The cosign claims were validated
#   - Existence of the claims in the transparency log was verified offline
#   - The code-signing certificate was verified using trusted certificate authority certificates
```

### Aide 2.6 - Vérification de signature avec Kyverno

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
spec:
  validationFailureAction: Enforce
  background: false  # Important: ne pas vérifier les pods existants
  webhookTimeoutSeconds: 30  # Timeout pour la vérification
  
  rules:
  - name: check-signature
    match:
      any:
      - resources:
          kinds:
          - Pod
    verifyImages:
    - imageReferences:
      - "ghcr.io/VOTRE_USER/*"
      attestors:
      - entries:
        - keyless:
            subject: "VOTRE_EMAIL@example.com"
            issuer: "https://github.com/login/oauth"
            rekor:
              url: https://rekor.sigstore.dev
```

---

## 📊 BLOC 3 - SRE & Chaos

### Aide 3.1 - Recording Rules Prometheus

```yaml
groups:
- name: payment-service-slo
  interval: 30s
  rules:
  # Success Rate: ratio de requêtes réussies
  - record: payment_service:success_rate:ratio
    expr: |
      sum(rate(http_requests_total{service="payment",code!~"5.."}[5m]))
      /
      sum(rate(http_requests_total{service="payment"}[5m]))
  
  # Latency P95
  - record: payment_service:latency:p95
    expr: |
      histogram_quantile(0.95,
        sum(rate(http_request_duration_seconds_bucket{service="payment"}[5m])) by (le)
      )
  
  # Alertes basées sur les SLOs
  - alert: HighErrorRate
    expr: payment_service:success_rate:ratio < 0.999
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Payment service error rate too high"
      description: "Success rate is {{ $value }}, below SLO of 99.9%"
```

### Aide 3.2 - Calcul Error Budget

```
Formule Error Budget:
Error Budget = (100% - SLO) × Période

Exemple pour SLO 99.9% sur 30 jours:
- Error Budget = (100% - 99.9%) × 30 jours
- Error Budget = 0.1% × 30 jours
- Error Budget = 0.001 × 30 × 24 × 60 minutes
- Error Budget = 43.2 minutes

Burn Rate (taux de consommation):
Si vous avez 5 minutes de downtime en 1 jour:
- Burn Rate = 5 min / (43.2 min / 30 jours)
- Burn Rate = 5 / 1.44 = 3.47x
- Vous consommez votre budget 3.47x plus vite que prévu
```

### Aide 3.3 - Installation Litmus

```bash
# Ajouter le repo Helm
helm repo add litmuschaos https://litmuschaos.github.io/litmus-helm/
helm repo update

# Installer Litmus
helm install chaos litmuschaos/litmus \
  --namespace litmus \
  --create-namespace \
  --set portal.frontend.service.type=NodePort \
  --set portal.frontend.service.nodePort=30002

# Attendre que tout soit prêt
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=litmus -n litmus --timeout=300s

# Obtenir les credentials par défaut
echo "Chaos Center URL: http://localhost:30002"
echo "Username: admin"
echo "Password: litmus"

# Installer les experiments de base
kubectl apply -f https://hub.litmuschaos.io/api/chaos/master?file=charts/generic/experiments.yaml -n litmus
```

### Aide 3.4 - Préparer l'application pour le Chaos

```bash
# L'application doit avoir des labels appropriés
kubectl label deployment payment-service app=payment-service

# Créer un ServiceAccount pour Litmus
kubectl create serviceaccount litmus-admin -n default

# Donner les permissions nécessaires
kubectl create clusterrolebinding litmus-admin \
  --clusterrole=cluster-admin \
  --serviceaccount=default:litmus-admin
```

### Aide 3.5 - Structure d'un Postmortem

Un bon postmortem doit être:
- **Blameless**: Ne jamais pointer du doigt une personne
- **Factuel**: S'appuyer sur des données (logs, métriques)
- **Actionnable**: Proposer des améliorations concrètes
- **Partagé**: Diffusé à toute l'équipe pour apprentissage

Structure recommandée:
1. **Résumé exécutif** (2-3 lignes)
2. **Impact** (combien d'utilisateurs, combien de temps)
3. **Chronologie** (timeline précise)
4. **Cause racine** (5 Why's)
5. **Ce qui a bien fonctionné**
6. **Ce qui a mal fonctionné**
7. **Actions correctives** (avec responsables et deadlines)
8. **Leçons apprises**

---

## 🚀 BLOC 4 - Tekton

### Aide 4.1 - Installation Tekton

```bash
# Installer Tekton Pipelines
kubectl apply -f https://storage.googleapis.com/tekton-releases/pipeline/latest/release.yaml

# Installer Tekton Dashboard
kubectl apply -f https://storage.googleapis.com/tekton-releases/dashboard/latest/release.yaml

# Exposer le Dashboard
kubectl patch svc tekton-dashboard -n tekton-pipelines \
  --type='json' \
  -p='[{"op":"replace","path":"/spec/type","value":"NodePort"},{"op":"add","path":"/spec/ports/0/nodePort","value":30001}]'

# Vérifier l'installation
kubectl get pods -n tekton-pipelines

# Accéder au Dashboard
echo "Tekton Dashboard: http://localhost:30001"

# Installer Tekton CLI (tkn)
# Mac: brew install tektoncd-cli
# Linux: https://github.com/tektoncd/cli/releases
```

### Aide 4.2 - Concepts Tekton

```
TASK: Unité de travail réutilisable (ex: build, test, deploy)
  ├── Steps: Commandes exécutées séquentiellement
  ├── Params: Paramètres d'entrée
  └── Workspaces: Volumes partagés

PIPELINE: Orchestration de Tasks
  ├── Tasks: Liste de tasks à exécuter
  ├── runAfter: Définit les dépendances
  └── Params: Paramètres propagés aux tasks

PIPELINERUN: Exécution d'un Pipeline
  ├── pipelineRef: Référence au Pipeline
  ├── params: Valeurs des paramètres
  └── workspaces: Montage des volumes
```

### Aide 4.3 - Secrets pour Tekton

```bash
# Secret pour GitHub Container Registry
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=VOTRE_USER \
  --docker-password=$GITHUB_TOKEN \
  --docker-email=VOTRE_EMAIL

# Lier le secret au ServiceAccount
kubectl patch serviceaccount default \
  -p '{"secrets":[{"name":"ghcr-secret"}]}'

# Secret pour Cosign (si vous utilisez des clés)
kubectl create secret generic cosign-key \
  --from-file=cosign.key=./cosign.key \
  --from-file=cosign.pub=./cosign.pub
```

### Aide 4.4 - Task Git Clone

```yaml
apiVersion: tekton.dev/v1beta1
kind: Task
metadata:
  name: git-clone
spec:
  params:
  - name: url
    type: string
  - name: revision
    type: string
    default: main
  workspaces:
  - name: output
  steps:
  - name: clone
    image: gcr.io/tekton-releases/github.com/tektoncd/pipeline/cmd/git-init:latest
    script: |
      #!/bin/sh
      git clone $(params.url) $(workspaces.output.path)
      cd $(workspaces.output.path)
      git checkout $(params.revision)
```

### Aide 4.5 - Débugger un Pipeline

```bash
# Lister les PipelineRuns
tkn pipelinerun list

# Voir les logs en temps réel
tkn pipelinerun logs <pipelinerun-name> -f

# Décrire un PipelineRun (voir les erreurs)
tkn pipelinerun describe <pipelinerun-name>

# Voir les logs d'une task spécifique
kubectl logs <pod-name> -c step-<step-name>

# Supprimer un PipelineRun échoué
kubectl delete pipelinerun <pipelinerun-name>
```

---

## 🔧 Commandes Utiles Générales

### Débug Kubernetes

```bash
# Voir tous les événements récents
kubectl get events --sort-by='.lastTimestamp' -A

# Décrire une ressource (voir les erreurs)
kubectl describe <resource-type> <resource-name> -n <namespace>

# Logs d'un pod
kubectl logs <pod-name> -n <namespace> -f

# Logs du container précédent (si crash)
kubectl logs <pod-name> -n <namespace> --previous

# Shell dans un pod
kubectl exec -it <pod-name> -n <namespace> -- /bin/sh

# Port-forward pour accéder à un service
kubectl port-forward svc/<service-name> 8080:80 -n <namespace>
```

### Nettoyage

```bash
# Supprimer toutes les ressources d'un namespace
kubectl delete all --all -n <namespace>

# Supprimer un namespace complet
kubectl delete namespace <namespace>

# Supprimer le cluster Kind
kind delete cluster --name techmarket

# Nettoyer les images Docker locales
docker system prune -a
```

---

## 📚 Ressources Supplémentaires

### Cheat Sheets
- [Kubernetes Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Helm Cheat Sheet](https://helm.sh/docs/intro/cheatsheet/)
- [PromQL Cheat Sheet](https://promlabs.com/promql-cheat-sheet/)

### Exemples de Code
- [Backstage Examples](https://github.com/backstage/backstage/tree/master/packages/catalog-model/examples)
- [Kyverno Policies](https://kyverno.io/policies/)
- [Tekton Catalog](https://hub.tekton.dev/)
- [Litmus Experiments](https://hub.litmuschaos.io/)

### Vidéos Recommandées
- [Backstage in 100 Seconds](https://www.youtube.com/watch?v=85TQEpNCaU0)
- [Kyverno Deep Dive](https://www.youtube.com/watch?v=DREjzfTzNpA)
- [Chaos Engineering Principles](https://www.youtube.com/watch?v=vbyjpMeYitA)

---

**Bon courage ! N'hésitez pas à demander de l'aide au formateur. 🚀**
