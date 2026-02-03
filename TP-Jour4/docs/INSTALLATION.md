# Installation - Solar Monitoring GitOps

## Prérequis

- Docker Desktop (ou Docker Engine)
- kubectl
- minikube
- Node.js 18+
- Git

## Installation rapide

```bash
# 1. Cloner le repository
git clone <votre-repo>
cd solar-monitoring-gitops

# 2. Exécuter le script de setup
./scripts/setup.sh
```

## Installation manuelle

### 1. Démarrer Minikube

```bash
minikube start --memory=4096 --cpus=2
```

### 2. Installer ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Attendre le démarrage
kubectl wait --for=condition=available --timeout=300s deployment/argocd-server -n argocd

# Récupérer le mot de passe
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

### 3. Créer le namespace

```bash
kubectl create namespace solar-prod
```

### 4. Construire l'image Docker

```bash
cd src/solar-simulator
npm install --registry https://registry.npmjs.org
npm test
docker build -t solar-simulator:latest .
minikube image load solar-simulator:latest
```

### 5. Déployer les composants

```bash
cd ../..

# Application
kubectl apply -f k8s/apps/solar-simulator/configmap.yaml
kubectl apply -f k8s/apps/solar-simulator/deployment.yaml
kubectl apply -f k8s/apps/solar-simulator/service.yaml

# Monitoring
kubectl apply -f k8s/monitoring/prometheus/
kubectl apply -f k8s/monitoring/alertmanager/
kubectl apply -f k8s/monitoring/grafana/
```

### 6. Vérifier le déploiement

```bash
kubectl get pods -n solar-prod
```

## Accès aux services

### ArgoCD

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```
- URL: https://localhost:8080
- User: admin
- Password: (voir commande ci-dessus)

### Grafana

```bash
kubectl port-forward svc/grafana -n solar-prod 3001:3000
```
- URL: http://localhost:3001
- User: admin
- Password: admin123

### Prometheus

```bash
kubectl port-forward svc/prometheus -n solar-prod 9090:9090
```
- URL: http://localhost:9090

### Solar Simulator API

```bash
kubectl port-forward svc/solar-simulator -n solar-prod 3000:3000
```
- URL: http://localhost:3000
- Métriques: http://localhost:3000/metrics
- API: http://localhost:3000/api/data

## Troubleshooting

### Les pods ne démarrent pas

```bash
# Vérifier les événements
kubectl describe pod <pod-name> -n solar-prod

# Vérifier les logs
kubectl logs <pod-name> -n solar-prod
```

### L'image n'est pas trouvée

```bash
# Recharger l'image dans minikube
minikube image load solar-simulator:latest

# Vérifier que l'image est présente
minikube image list | grep solar
```

### Prometheus ne collecte pas les métriques

```bash
# Vérifier que le simulateur répond
kubectl exec -n solar-prod deployment/prometheus -- wget -qO- http://solar-simulator:3000/metrics

# Vérifier les targets Prometheus
# Aller sur http://localhost:9090/targets
```

### ArgoCD n'est pas accessible

```bash
# Vérifier que les pods sont running
kubectl get pods -n argocd

# Redémarrer le port-forward
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

## Nettoyage

```bash
# Supprimer les ressources
kubectl delete namespace solar-prod
kubectl delete namespace argocd

# Arrêter minikube
minikube stop

# Supprimer le cluster
minikube delete
```
