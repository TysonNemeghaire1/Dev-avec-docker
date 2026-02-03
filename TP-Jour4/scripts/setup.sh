#!/bin/bash
# Script de setup pour le projet Solar Monitoring GitOps

set -e

echo "==================================="
echo "  Solar Monitoring - Setup Script  "
echo "==================================="

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonctions
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 est installé"
        return 0
    else
        echo -e "${RED}✗${NC} $1 n'est pas installé"
        return 1
    fi
}

# 1. Vérification des prérequis
echo ""
echo "1. Vérification des prérequis..."
echo "--------------------------------"

MISSING=0
check_command docker || MISSING=1
check_command kubectl || MISSING=1
check_command minikube || MISSING=1
check_command node || MISSING=1

if [ $MISSING -eq 1 ]; then
    echo -e "${RED}Certains prérequis manquent. Installez-les avant de continuer.${NC}"
    exit 1
fi

# 2. Démarrage de Minikube
echo ""
echo "2. Vérification de Minikube..."
echo "------------------------------"

if minikube status | grep -q "Running"; then
    echo -e "${GREEN}✓${NC} Minikube est déjà en cours d'exécution"
else
    echo -e "${YELLOW}→${NC} Démarrage de Minikube..."
    minikube start --memory=4096 --cpus=2
fi

# 3. Installation d'ArgoCD
echo ""
echo "3. Installation d'ArgoCD..."
echo "---------------------------"

if kubectl get namespace argocd &> /dev/null; then
    echo -e "${GREEN}✓${NC} Namespace argocd existe déjà"
else
    kubectl create namespace argocd
fi

kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml --server-side --force-conflicts 2>/dev/null || true

echo "Attente du démarrage d'ArgoCD..."
kubectl wait --for=condition=available --timeout=300s deployment/argocd-server -n argocd

ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
echo -e "${GREEN}✓${NC} ArgoCD installé"
echo -e "   URL: https://localhost:8080"
echo -e "   User: admin"
echo -e "   Password: $ARGOCD_PASSWORD"

# 4. Création du namespace
echo ""
echo "4. Création du namespace solar-prod..."
echo "--------------------------------------"

kubectl create namespace solar-prod 2>/dev/null || echo -e "${GREEN}✓${NC} Namespace solar-prod existe déjà"

# 5. Construction de l'image Docker
echo ""
echo "5. Construction de l'image Docker..."
echo "------------------------------------"

cd "$(dirname "$0")/../src/solar-simulator"
docker build -t solar-simulator:latest .
minikube image load solar-simulator:latest
echo -e "${GREEN}✓${NC} Image construite et chargée dans Minikube"

# 6. Déploiement des composants
echo ""
echo "6. Déploiement des composants..."
echo "--------------------------------"

cd "$(dirname "$0")/.."

kubectl apply -f k8s/apps/solar-simulator/configmap.yaml
kubectl apply -f k8s/apps/solar-simulator/deployment.yaml
kubectl apply -f k8s/apps/solar-simulator/service.yaml

kubectl apply -f k8s/monitoring/prometheus/
kubectl apply -f k8s/monitoring/alertmanager/
kubectl apply -f k8s/monitoring/grafana/

echo "Attente du démarrage des pods..."
sleep 10
kubectl wait --for=condition=ready --timeout=120s pod -l app=solar-simulator -n solar-prod
kubectl wait --for=condition=ready --timeout=120s pod -l app=prometheus -n solar-prod
kubectl wait --for=condition=ready --timeout=120s pod -l app=grafana -n solar-prod

echo -e "${GREEN}✓${NC} Tous les composants sont déployés"

# 7. Affichage des informations d'accès
echo ""
echo "==================================="
echo "  Installation terminée !          "
echo "==================================="
echo ""
echo "Services disponibles :"
echo ""
echo "1. ArgoCD:"
echo "   kubectl port-forward svc/argocd-server -n argocd 8080:443"
echo "   URL: https://localhost:8080"
echo "   User: admin / Password: $ARGOCD_PASSWORD"
echo ""
echo "2. Grafana:"
echo "   kubectl port-forward svc/grafana -n solar-prod 3001:3000"
echo "   URL: http://localhost:3001"
echo "   User: admin / Password: admin123"
echo ""
echo "3. Prometheus:"
echo "   kubectl port-forward svc/prometheus -n solar-prod 9090:9090"
echo "   URL: http://localhost:9090"
echo ""
echo "4. Solar Simulator:"
echo "   kubectl port-forward svc/solar-simulator -n solar-prod 3000:3000"
echo "   URL: http://localhost:3000"
echo ""
