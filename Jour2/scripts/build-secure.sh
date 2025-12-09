#!/bin/bash

# Script de build sécurisé avec scan de vulnérabilités
# TP Docker Avancé - Master 2 Full Stack

set -euo pipefail

# Couleurs pour l'affichage
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Fonction pour afficher le statut
show_status() {
    local status=$1
    local message=$2
    if [ "$status" = "success" ]; then
        echo -e "${GREEN}✅ $message${NC}"
    elif [ "$status" = "error" ]; then
        echo -e "${RED}❌ $message${NC}"
    elif [ "$status" = "info" ]; then
        echo -e "${BLUE}ℹ️  $message${NC}"
    elif [ "$status" = "warning" ]; then
        echo -e "${YELLOW}⚠️  $message${NC}"
    fi
}

echo "=== 🔒 BUILD SÉCURISÉ DES IMAGES DOCKER ==="
echo "Date: $(date)"
echo ""

# Vérifier que Docker est en cours d'exécution
if ! docker info > /dev/null 2>&1; then
    show_status "error" "Docker n'est pas en cours d'exécution. Veuillez démarrer Docker Desktop."
    exit 1
fi

# Activer BuildKit pour des builds optimisés
export DOCKER_BUILDKIT=1

# Fonction pour scanner les vulnérabilités
scan_vulnerabilities() {
    local image_name=$1
    local image_tag=$2
    local full_image="${image_name}:${image_tag}"
    
    show_status "info" "Scan de vulnérabilités pour $full_image"
    
    # Scanner avec Trivy
    if command -v trivy &> /dev/null; then
        show_status "info" "Scan Trivy en cours..."
        trivy image --severity CRITICAL,HIGH --format table "$full_image" || true
    else
        show_status "warning" "Trivy non disponible, utilisation via Docker"
        docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
            aquasec/trivy image --severity CRITICAL,HIGH --format table "$full_image" || true
    fi
    
    echo ""
}

# Fonction pour analyser la taille avec Dive
analyze_size() {
    local image_name=$1
    local image_tag=$2
    local full_image="${image_name}:${image_tag}"
    
    show_status "info" "Analyse de la taille avec Dive pour $full_image"
    
    # Analyser avec Dive
    if command -v dive &> /dev/null; then
        show_status "info" "Analyse Dive en cours..."
        dive "$full_image" --ci || true
    else
        show_status "warning" "Dive non disponible, utilisation via Docker"
        docker run --rm -it \
            -v /var/run/docker.sock:/var/run/docker.sock \
            wagoodman/dive "$full_image" --ci || true
    fi
    
    echo ""
}

# Fonction pour construire une image avec sécurité

build_secure_image() {
    local service_name=$1
    local dockerfile_path=$2
    local image_tag="distroless-secure"
    
    show_status "info" "Construction de l'image $service_name avec sécurité renforcée"
    
    # Build avec BuildKit et cache optimisé
    docker buildx build --load \
        --file "$dockerfile_path" \
        --tag "${service_name}:${image_tag}" \
        --tag "${service_name}:latest" \
        --progress=plain \
        --no-cache \
        .
    
    if [ $? -eq 0 ]; then
        show_status "success" "Image $service_name construite avec succès"
        
        # Scanner les vulnérabilités
        scan_vulnerabilities "$service_name" "$image_tag"
        
        # Analyser la taille
        analyze_size "$service_name" "$image_tag"
        
        return 0
    else
        show_status "error" "Échec de la construction de l'image $service_name"
        return 1
    fi
}

# Fonction pour tester une image
test_image() {
    local service_name=$1
    local image_tag=$2
    local port=$3
    local health_endpoint=$4
    
    show_status "info" "Test de l'image $service_name:$image_tag"
    
    # Démarrer le conteneur
    local container_id
    container_id=$(docker run -d --name "test-${service_name}" -p "${port}:${port}" "${service_name}:${image_tag}")
    
    if [ $? -eq 0 ]; then
        show_status "success" "Conteneur démarré: $container_id"
        
        # Attendre que le service soit prêt
        sleep 5
        
        # Tester l'endpoint de santé
        if curl -f "http://localhost:${port}${health_endpoint}" > /dev/null 2>&1; then
            show_status "success" "Service $service_name répond correctement"
        else
            show_status "warning" "Service $service_name ne répond pas sur l'endpoint de santé"
        fi
        
        # Nettoyer
        docker stop "test-${service_name}" > /dev/null 2>&1
        docker rm "test-${service_name}" > /dev/null 2>&1
        
        return 0
    else
        show_status "error" "Impossible de démarrer le conteneur $service_name"
        return 1
    fi
}

# Construction des images sécurisées
echo -e "${BLUE}🏗️  Construction des images avec sécurité renforcée...${NC}"
echo ""

# Obtenir le répertoire de base du script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

# Python API
show_status "info" "Construction de l'API Python avec Debian 12 distroless"
cd "$BASE_DIR/python-api"
build_secure_image "python-api" "Dockerfile.python-distroless"
cd "$BASE_DIR"

# Java API
show_status "info" "Construction de l'API Java avec Debian 12 distroless"
cd "$BASE_DIR/java-api"
build_secure_image "java-api" "Dockerfile.java-distroless"
cd "$BASE_DIR"

# Node.js API
show_status "info" "Construction de l'API Node.js avec Debian 12 distroless"
cd "$BASE_DIR/node-api"
build_secure_image "node-api" "Dockerfile.distroless"
cd "$BASE_DIR"

echo ""
echo -e "${BLUE}🧪 Tests des images construites...${NC}"
echo ""

# Tests des images
test_image "python-api" "distroless-secure" "8000" "/health"
test_image "java-api" "distroless-secure" "8080" "/actuator/health"
test_image "node-api" "distroless-secure" "3000" "/health"

echo ""
echo -e "${GREEN}🎉 Build sécurisé terminé !${NC}"
echo ""
echo -e "${BLUE}📊 Résumé des images construites :${NC}"
docker images | grep -E "(python-api|java-api|node-api)" | grep "distroless-secure"

echo ""
echo -e "${YELLOW}💡 Prochaines étapes :${NC}"
echo "1. Vérifiez les rapports de vulnérabilités ci-dessus"
echo "2. Analysez les tailles d'images avec Dive"
echo "3. Testez les APIs avec les scripts de test"
echo "4. Documentez les améliorations de sécurité"
