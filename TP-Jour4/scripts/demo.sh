#!/bin/bash
# Script de démonstration pour le projet Solar Monitoring GitOps

set -e

echo "========================================"
echo "  Solar Monitoring - Script de Démo    "
echo "========================================"

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pause() {
    echo ""
    echo -e "${YELLOW}Appuyez sur Entrée pour continuer...${NC}"
    read
}

# 1. Vérification du cluster
echo ""
echo -e "${CYAN}1. Vérification du cluster Kubernetes${NC}"
echo "--------------------------------------"
kubectl cluster-info
echo ""
kubectl get nodes
pause

# 2. État des pods
echo ""
echo -e "${CYAN}2. État des pods dans solar-prod${NC}"
echo "---------------------------------"
kubectl get pods -n solar-prod -o wide
pause

# 3. Vérification des métriques
echo ""
echo -e "${CYAN}3. Test des métriques du simulateur${NC}"
echo "------------------------------------"
echo "Récupération des métriques depuis le simulateur..."
kubectl exec -n solar-prod deployment/prometheus -- wget -qO- http://solar-simulator:3000/metrics 2>/dev/null | grep "^solar_power_kw"
pause

# 4. Données en temps réel
echo ""
echo -e "${CYAN}4. Données en temps réel via l'API${NC}"
echo "----------------------------------"
echo "Récupération des données actuelles..."
kubectl exec -n solar-prod deployment/prometheus -- wget -qO- http://solar-simulator:3000/api/data 2>/dev/null | head -100
pause

# 5. Vérification de Prometheus
echo ""
echo -e "${CYAN}5. Vérification de Prometheus${NC}"
echo "-----------------------------"
echo "Targets Prometheus:"
kubectl exec -n solar-prod deployment/prometheus -- wget -qO- http://localhost:9090/api/v1/targets 2>/dev/null | head -50
pause

# 6. Vérification des alertes
echo ""
echo -e "${CYAN}6. État des alertes${NC}"
echo "-------------------"
echo "Alertes actives:"
kubectl exec -n solar-prod deployment/prometheus -- wget -qO- "http://localhost:9090/api/v1/alerts" 2>/dev/null
pause

# 7. Instructions pour les interfaces web
echo ""
echo -e "${CYAN}7. Accès aux interfaces web${NC}"
echo "---------------------------"
echo ""
echo "Pour accéder aux interfaces, ouvrez 3 terminaux et exécutez :"
echo ""
echo -e "${GREEN}Terminal 1 - Grafana:${NC}"
echo "  kubectl port-forward svc/grafana -n solar-prod 3001:3000"
echo "  → http://localhost:3001 (admin/admin123)"
echo ""
echo -e "${GREEN}Terminal 2 - Prometheus:${NC}"
echo "  kubectl port-forward svc/prometheus -n solar-prod 9090:9090"
echo "  → http://localhost:9090"
echo ""
echo -e "${GREEN}Terminal 3 - ArgoCD:${NC}"
echo "  kubectl port-forward svc/argocd-server -n argocd 8080:443"
echo "  → https://localhost:8080 (admin/<voir setup.sh>)"
echo ""

echo "========================================"
echo "  Fin de la démonstration              "
echo "========================================"
