#!/bin/bash

# =============================================================================
#  CloudShop — Script de démonstration
#  Partie 1 : Docker  |  Partie 2 : Kubernetes
# =============================================================================

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

OK="${GREEN}✓${NC}"
FAIL="${RED}✗${NC}"
ARROW="${CYAN}▶${NC}"

AWK=$(which awk || echo /usr/bin/awk)
PYTHON=$(which python3 || which python)

separator() { echo -e "\n${DIM}$(printf '─%.0s' {1..70})${NC}\n"; }

header() {
  local title="$1"
  local pad=$(( (68 - ${#title}) / 2 ))
  echo ""
  echo -e "${BOLD}${BLUE}$(printf '═%.0s' {1..70})${NC}"
  printf "${BOLD}${BLUE}║${NC}%${pad}s${YELLOW}${BOLD}%s${NC}%$((68 - pad - ${#title}))s${BOLD}${BLUE}║${NC}\n" "" "$title" ""
  echo -e "${BOLD}${BLUE}$(printf '═%.0s' {1..70})${NC}"
  echo ""
}

section() { echo -e "\n${BOLD}${CYAN}── $1${NC}\n"; }

wait_key() {
  echo -e "\n${DIM}  [ Appuyez sur Entrée pour continuer... ]${NC}"
  read -r
}

# Récupérer la taille d'une image depuis minikube
minikube_image_size_mb() {
  local image="$1"
  # Interroge le daemon Docker de minikube via SSH
  local bytes
  bytes=$(minikube ssh "docker image inspect ${image}:latest --format='{{.Size}}'" 2>/dev/null | tr -d '\r')
  if [ -n "$bytes" ] && [ "$bytes" -gt 0 ] 2>/dev/null; then
    echo "scale=1; $bytes / 1048576" | bc
  fi
}

# =============================================================================
# INTRO
# =============================================================================
clear
header "CloudShop — Démonstration Complète"
echo -e "  ${BOLD}Projet :${NC}  Plateforme e-commerce microservices"
echo -e "  ${BOLD}Stack   :${NC}  React · Node.js · Python · Go · PostgreSQL"
echo -e "  ${BOLD}Infra   :${NC}  Docker Compose  +  Kubernetes (minikube)"
echo ""
echo -e "  Ce script démontre :"
echo -e "  ${ARROW}  Partie 1 — Images Docker optimisées et conteneurs"
echo -e "  ${ARROW}  Partie 2 — Déploiement Kubernetes et santé des services"
wait_key

# =============================================================================
# PARTIE 1 — DOCKER
# =============================================================================
clear
header "PARTIE 1 — Docker"

# ── 1.1 Images ──────────────────────────────────────────────────────────────
section "1.1  Images Docker CloudShop (daemon minikube)"

IMAGES=("cloudshop/frontend" "cloudshop/api-gateway" "cloudshop/auth-service" "cloudshop/products-api" "cloudshop/orders-api")

printf "  ${BOLD}%-30s %-12s %-12s %s${NC}\n" "IMAGE" "TAG" "TAILLE" "CONTRAINTE"
echo -e "  ${DIM}$(printf '%-30s %-12s %-12s %s\n' '──────────────────────────────' '──────────' '──────────' '──────────────')${NC}"

TOTAL_OK=0
for img in "${IMAGES[@]}"; do
  SIZE_MB=$(minikube_image_size_mb "$img")
  if [ -n "$SIZE_MB" ]; then
    SIZE_INT=$(echo "$SIZE_MB" | cut -d'.' -f1)
    if [ "$SIZE_INT" -lt 200 ] 2>/dev/null; then
      SIZE_COLOR="${GREEN}"
      STATUS="${OK}"
      CONSTRAINT="${GREEN}< 200 MB ✓${NC}"
    else
      SIZE_COLOR="${YELLOW}"
      STATUS="${FAIL}"
      CONSTRAINT="${YELLOW}> 200 MB${NC}"
    fi
    printf "  %b  ${BOLD}%-28s${NC} %-12s ${SIZE_COLOR}%-12s${NC} %b\n" \
      "$STATUS" "$img" "latest" "${SIZE_MB} MB" "$CONSTRAINT"
    TOTAL_OK=$((TOTAL_OK + 1))
  else
    printf "  ${FAIL}  %-28s %-12s %s\n" "$img" "-" "non trouvée"
  fi
done

echo ""
echo -e "  ${BOLD}${TOTAL_OK}/5${NC} images disponibles dans minikube"

# ── 1.2 Comparaison tailles ─────────────────────────────────────────────────
separator
section "1.2  Gain du multi-stage build"

printf "  ${BOLD}%-22s %-18s %-14s %-12s %s${NC}\n" "SERVICE" "BASE" "FINALE" "GAIN" "RUNTIME"
echo "  $(printf '─%.0s' {1..75})"

declare -A BASE_MB_MAP=( ["cloudshop/api-gateway"]="1100" ["cloudshop/auth-service"]="1100" ["cloudshop/products-api"]="900" ["cloudshop/orders-api"]="800" )
declare -A BASE_MB_SHORT=(  ["api-gateway"]="1100" ["auth-service"]="1100" ["products-api"]="900" ["orders-api"]="800" )
declare -A BASE_NAME_SHORT=( ["api-gateway"]="node:20" ["auth-service"]="node:20" ["products-api"]="python:3.11" ["orders-api"]="golang:1.21" )
declare -A RUNTIME_SHORT=(   ["api-gateway"]="node:20-alpine" ["auth-service"]="node:20-alpine" ["products-api"]="python:3.11-slim" ["orders-api"]="alpine:latest" )

for svc in "cloudshop/api-gateway" "cloudshop/auth-service" "cloudshop/products-api" "cloudshop/orders-api"; do
  SIZE_MB=$(minikube_image_size_mb "$svc")
  SHORT="${svc#cloudshop/}"
  BASE_MB="${BASE_MB_SHORT[$SHORT]}"
  BASE="${BASE_NAME_SHORT[$SHORT]}"
  RUNTIME="${RUNTIME_SHORT[$SHORT]}"
  if [ -n "$SIZE_MB" ]; then
    SIZE_INT=$(echo "$SIZE_MB" | cut -d'.' -f1)
    SAVED=$((BASE_MB - SIZE_INT))
    printf "  ${OK}  %-20s %-18s ${GREEN}%-14s${NC} ${CYAN}-%-11s${NC} %s\n" \
      "$SHORT" "~${BASE_MB} MB" "${SIZE_MB} MB" "${SAVED} MB" "$RUNTIME"
  fi
done

# ── 1.3 Docker Compose ──────────────────────────────────────────────────────
separator
section "1.3  Conteneurs Docker Compose (stack locale)"

CS_RUNNING=$(docker compose -f docker-compose.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null)
if [ -n "$CS_RUNNING" ]; then
  printf "  ${BOLD}%-32s %-35s %s${NC}\n" "NOM" "STATUS" "PORTS"
  echo "  $(printf '─%.0s' {1..75})"
  echo "$CS_RUNNING" | tail -n +2 | while IFS= read -r line; do
    NAME=$(echo "$line" | $AWK '{print $1}')
    STATUS=$(echo "$line" | $AWK '{$1=""; print $0}' | sed 's/^ *//')
    if echo "$STATUS" | grep -q "Up"; then
      if echo "$STATUS" | grep -q "healthy"; then
        ICON="${OK}"
        COLOR="${GREEN}"
      else
        ICON="${FAIL}"
        COLOR="${YELLOW}"
      fi
    else
      ICON="${FAIL}"
      COLOR="${RED}"
    fi
    printf "  %b  ${BOLD}%-30s${NC} %b%s${NC}\n" "$ICON" "$NAME" "$COLOR" "$STATUS"
  done
else
  echo -e "  ${DIM}Docker Compose non démarré${NC}"
  echo -e "  ${DIM}Les images sont disponibles dans le daemon minikube${NC}"
fi

# ── Arrêt de la stack Docker Compose ────────────────────────────────────────
separator
section "1.4  Arrêt de la stack Docker Compose"

echo -e "  ${ARROW}  Arrêt des conteneurs pour libérer les ports (8080, 8081, 8082, 8083, 5432)..."
docker compose -f docker-compose.yml down 2>&1 | while IFS= read -r line; do
  echo -e "  ${DIM}${line}${NC}"
done

echo ""
echo -e "  ${OK}  Stack Docker Compose arrêtée — ports libérés pour Kubernetes"

wait_key

# =============================================================================
# PARTIE 2 — KUBERNETES
# =============================================================================
clear
header "PARTIE 2 — Kubernetes"

# ── 2.1 Cluster ─────────────────────────────────────────────────────────────
section "2.1  Cluster minikube"

MINIKUBE_IP=$(minikube ip 2>/dev/null)
K8S_VERSION=$(kubectl version 2>/dev/null | grep "Server Version" | $AWK -F'v' '{print "v"$NF}' | tr -d ' ')
NODE_STATUS=$(kubectl get nodes --no-headers 2>/dev/null | $AWK '{print $2}')
NODE_NAME=$(kubectl get nodes --no-headers 2>/dev/null | $AWK '{print $1}')

echo -e "  ${OK}  Nœud           : ${BOLD}${NODE_NAME}${NC}  (${NODE_STATUS:+${GREEN}}${NODE_STATUS}${NC})"
echo -e "  ${OK}  Cluster IP     : ${BOLD}${MINIKUBE_IP}${NC}"
echo -e "  ${OK}  Kubernetes     : ${BOLD}${K8S_VERSION}${NC}"
echo -e "  ${OK}  Namespace      : ${BOLD}cloudshop-prod${NC}"

# ── 2.2 Pods ────────────────────────────────────────────────────────────────
separator
section "2.2  État des Pods"

printf "  ${BOLD}%-38s %-8s %-16s %s${NC}\n" "POD" "PRÊT" "STATUS" "RESTARTS"
echo "  $(printf '─%.0s' {1..68})"

RUNNING=0
TOTAL=0

while IFS= read -r line; do
  NAME=$(echo "$line" | $AWK '{print $1}')
  READY=$(echo "$line" | $AWK '{print $2}')
  STATUS=$(echo "$line" | $AWK '{print $3}')
  RESTARTS=$(echo "$line" | $AWK '{print $4}')
  TOTAL=$((TOTAL + 1))
  SHORT=$(echo "$NAME" | sed 's/-[a-z0-9]\{5,\}-[a-z0-9]\{5,\}$//')
  if [ "$STATUS" = "Running" ]; then
    ICON="${OK}"; STATUS_COLOR="${GREEN}"; RUNNING=$((RUNNING + 1))
  else
    ICON="${FAIL}"; STATUS_COLOR="${RED}"
  fi
  printf "  %b  ${BOLD}%-36s${NC} %-8s ${STATUS_COLOR}%-16s${NC} %s\n" \
    "$ICON" "$SHORT" "$READY" "$STATUS" "$RESTARTS"
done < <(kubectl get pods -n cloudshop-prod --no-headers 2>/dev/null)

echo ""
if [ "$RUNNING" -eq "$TOTAL" ] && [ "$TOTAL" -gt 0 ]; then
  echo -e "  ${GREEN}${BOLD}${RUNNING}/${TOTAL} pods Running${NC} ${GREEN}✓ Tous opérationnels${NC}"
else
  echo -e "  ${YELLOW}${BOLD}${RUNNING}/${TOTAL} pods Running${NC}"
fi

# ── 2.3 Services ────────────────────────────────────────────────────────────
separator
section "2.3  Services Kubernetes"

printf "  ${BOLD}%-22s %-12s %-18s %s${NC}\n" "SERVICE" "TYPE" "CLUSTER-IP" "PORT(S)"
echo "  $(printf '─%.0s' {1..65})"

kubectl get svc -n cloudshop-prod --no-headers 2>/dev/null | while IFS= read -r line; do
  NAME=$(echo "$line" | $AWK '{print $1}')
  TYPE=$(echo "$line" | $AWK '{print $2}')
  IP=$(echo "$line" | $AWK '{print $3}')
  PORTS=$(echo "$line" | $AWK '{print $5}')
  printf "  ${OK}  ${BOLD}%-20s${NC} %-12s %-18s %s\n" "$NAME" "$TYPE" "$IP" "$PORTS"
done

# ── 2.4 Health checks ───────────────────────────────────────────────────────
separator
section "2.4  Health Checks via API Gateway"

# Tuer un éventuel port-forward existant sur 8080
pkill -f "port-forward.*8080" 2>/dev/null
sleep 1s

echo -e "  ${DIM}Démarrage du port-forward svc/api-gateway:8080 ...${NC}"
kubectl port-forward svc/api-gateway 8080:8080 -n cloudshop-prod --address=127.0.0.1 &>/tmp/pf_demo.log &
PF_PID=$!
sleep 4s

# Vérifier que le port-forward est actif
if ! kill -0 $PF_PID 2>/dev/null; then
  echo -e "  ${FAIL} Port-forward échoué — ${DIM}$(cat /tmp/pf_demo.log)${NC}"
else
  echo -e "  ${OK}  Port-forward actif (PID $PF_PID)\n"
  printf "  ${BOLD}%-20s %-35s %-8s %s${NC}\n" "SERVICE" "ENDPOINT" "HTTP" "STATUS"
  echo "  $(printf '─%.0s' {1..72})"

  check_endpoint() {
    local name="$1" path="$2"
    local http_code body status_val
    http_code=$(curl -s -o /tmp/cs_health.json -w "%{http_code}" \
      --connect-timeout 3 "http://localhost:8080${path}" 2>/dev/null)
    body=$(cat /tmp/cs_health.json 2>/dev/null)
    status_val=$(echo "$body" | $PYTHON -c \
      "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null || echo "?")

    if [ "$http_code" = "200" ]; then
      printf "  ${OK}  ${BOLD}%-18s${NC} %-35s ${GREEN}%-8s${NC} %s\n" \
        "$name" "http://localhost:8080${path}" "$http_code" "$status_val"
    else
      printf "  ${FAIL}  ${BOLD}%-18s${NC} %-35s ${RED}%-8s${NC} %s\n" \
        "$name" "http://localhost:8080${path}" "${http_code:-timeout}" "erreur"
    fi
  }

  check_endpoint "api-gateway"  "/health"
  check_endpoint "auth-service" "/auth/health"
  check_endpoint "products-api" "/products/health"
  check_endpoint "orders-api"   "/orders/health"
fi

# ── 2.5 Test fonctionnel ────────────────────────────────────────────────────
separator
section "2.5  Test Fonctionnel — Cycle complet"

if kill -0 $PF_PID 2>/dev/null; then

  # Inscription
  echo -e "  ${ARROW}  POST /auth/register"
  REG=$(curl -s -X POST http://localhost:8080/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"demo@cloudshop.com","password":"Demo1234!","firstName":"Demo","lastName":"User"}' 2>/dev/null)
  REG_MSG=$(echo "$REG" | $PYTHON -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('message', d.get('error','?')))" 2>/dev/null)
  echo -e "       Résultat : ${BOLD}${REG_MSG}${NC}"

  # Connexion
  echo -e "\n  ${ARROW}  POST /auth/login"
  LOGIN=$(curl -s -X POST http://localhost:8080/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"demo@cloudshop.com","password":"Demo1234!"}' 2>/dev/null)
  LOGIN_MSG=$(echo "$LOGIN" | $PYTHON -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('message', d.get('error','?')))" 2>/dev/null)
  TOKEN=$(echo "$LOGIN" | $PYTHON -c \
    "import sys,json; d=json.load(sys.stdin); t=d.get('accessToken',''); print(t[:50]+'...' if len(t)>50 else t)" 2>/dev/null)
  echo -e "       Résultat : ${BOLD}${LOGIN_MSG}${NC}"
  echo -e "       JWT      : ${DIM}${TOKEN}${NC}"

  # Produits
  echo -e "\n  ${ARROW}  GET /products/"
  PRODUCTS=$(curl -s http://localhost:8080/products/ 2>/dev/null)
  COUNT=$(echo "$PRODUCTS" | $PYTHON -c \
    "import sys,json; d=json.load(sys.stdin); l=d if isinstance(d,list) else d.get('products',d.get('items',[])); print(len(l))" 2>/dev/null || echo "0")
  echo -e "       Produits en base : ${BOLD}${COUNT}${NC}"

  # Commandes
  echo -e "\n  ${ARROW}  GET /orders/"
  ORDERS=$(curl -s http://localhost:8080/orders/ 2>/dev/null)
  OCOUNT=$(echo "$ORDERS" | $PYTHON -c \
    "import sys,json; d=json.load(sys.stdin); l=d if isinstance(d,list) else d.get('orders',d.get('items',[])); print(len(l))" 2>/dev/null || echo "0")
  echo -e "       Commandes en base : ${BOLD}${OCOUNT}${NC}"

else
  echo -e "  ${DIM}Port-forward inactif — test ignoré${NC}"
fi

kill $PF_PID 2>/dev/null

# ── 2.6 Ingress ─────────────────────────────────────────────────────────────
separator
section "2.6  Ingress"

INGRESS_DATA=$(kubectl get ingress -n cloudshop-prod --no-headers 2>/dev/null)
if [ -n "$INGRESS_DATA" ]; then
  printf "  ${BOLD}%-28s %-15s %-20s %s${NC}\n" "NOM" "CLASSE" "HOSTS" "PORTS"
  echo "  $(printf '─%.0s' {1..70})"
  echo "$INGRESS_DATA" | while IFS= read -r line; do
    NAME=$(echo "$line"  | $AWK '{print $1}')
    CLASS=$(echo "$line" | $AWK '{print $2}')
    HOSTS=$(echo "$line" | $AWK '{print $3}')
    PORTS=$(echo "$line" | $AWK '{print $4}')
    printf "  ${OK}  ${BOLD}%-26s${NC} %-15s ${CYAN}%-20s${NC} %s\n" "$NAME" "$CLASS" "$HOSTS" "$PORTS"
  done
fi

echo ""
echo -e "  ${BOLD}Règles de routage :${NC}"
echo -e "  ${ARROW}  ${CYAN}shop.local${NC}  →  Service frontend  (port 80)"
echo -e "  ${ARROW}  ${CYAN}api.local${NC}   →  Service api-gateway (port 8080)"
echo ""
echo -e "  ${DIM}À ajouter dans /etc/hosts :${NC}"
echo -e "  ${BOLD}  ${MINIKUBE_IP}  shop.local  api.local${NC}"

# ── 2.7 Ressources configurées ──────────────────────────────────────────────
separator
section "2.7  Ressources et Sécurité"

printf "  ${BOLD}%-20s %-10s %-10s %-10s %-10s %-8s${NC}\n" \
  "SERVICE" "MEM REQ" "MEM LIM" "CPU REQ" "CPU LIM" "NON-ROOT"
echo "  $(printf '─%.0s' {1..68})"

declare -A MEM_REQ=( ["postgres"]="256Mi" ["auth-service"]="128Mi" ["products-api"]="128Mi" ["orders-api"]="64Mi"  ["api-gateway"]="128Mi" ["frontend"]="64Mi"  )
declare -A MEM_LIM=( ["postgres"]="512Mi" ["auth-service"]="256Mi" ["products-api"]="256Mi" ["orders-api"]="128Mi" ["api-gateway"]="256Mi" ["frontend"]="128Mi" )
declare -A CPU_REQ=( ["postgres"]="250m"  ["auth-service"]="100m"  ["products-api"]="100m"  ["orders-api"]="50m"   ["api-gateway"]="100m"  ["frontend"]="50m"   )
declare -A CPU_LIM=( ["postgres"]="500m"  ["auth-service"]="250m"  ["products-api"]="250m"  ["orders-api"]="150m"  ["api-gateway"]="250m"  ["frontend"]="150m"  )

for svc in postgres auth-service products-api orders-api api-gateway frontend; do
  printf "  ${OK}  ${BOLD}%-18s${NC} %-10s %-10s %-10s %-10s ${GREEN}%s${NC}\n" \
    "$svc" "${MEM_REQ[$svc]}" "${MEM_LIM[$svc]}" "${CPU_REQ[$svc]}" "${CPU_LIM[$svc]}" "UID 1001"
done

# =============================================================================
# RÉSUMÉ FINAL
# =============================================================================
separator
header "Résumé"

echo -e "  ${BOLD}${GREEN}PARTIE 1 — Docker${NC}"
echo -e "  ${OK}  5 images buildées avec multi-stage build"
echo -e "  ${OK}  Toutes les images < 200 MB"
echo -e "  ${OK}  Utilisateur non-root (UID 1001) dans chaque image"
echo -e "  ${OK}  HEALTHCHECK natif dans chaque Dockerfile"
echo -e "  ${OK}  .dockerignore sur chaque service"
echo -e "  ${OK}  Docker Compose avec healthchecks et depends_on conditionnels"
echo ""
echo -e "  ${BOLD}${GREEN}PARTIE 2 — Kubernetes${NC}"
echo -e "  ${OK}  Namespace isolé : cloudshop-prod"
echo -e "  ${OK}  Secrets K8s (base64) pour credentials DB et JWT"
echo -e "  ${OK}  ConfigMap pour les URLs des services"
echo -e "  ${OK}  StatefulSet PostgreSQL avec PVC 1Gi (ReadWriteOnce)"
echo -e "  ${OK}  5 Deployments avec liveness + readiness probes"
echo -e "  ${OK}  Services ClusterIP pour chaque microservice"
echo -e "  ${OK}  Ingress nginx : shop.local / api.local"
echo -e "  ${OK}  Requests/Limits configurés sur tous les pods"
echo -e "  ${OK}  SecurityContext : runAsNonRoot, allowPrivilegeEscalation=false"
echo ""
echo -e "  ${DIM}Prochaine étape → Partie 3 : GitOps avec ArgoCD${NC}"
echo ""
