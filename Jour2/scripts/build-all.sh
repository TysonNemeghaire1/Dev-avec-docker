#!/bin/bash

# Script de build de toutes les images Docker
# Master 2 Full Stack - Docker Optimization TP

echo "=== 🐳 BUILD DE TOUTES LES IMAGES DOCKER ==="
echo "Date: $(date)"
echo ""

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

# Fonction pour build une image
build_image() {
    local dockerfile=$1
    local image_name=$2
    local context=$3
    
    echo -e "${BLUE}🔨 Building $image_name...${NC}"
    echo "Dockerfile: $dockerfile"
    echo "Context: $context"
    echo ""
    
    if docker buildx build --load -f "$dockerfile" -t "$image_name" "$context"; then
        show_status "success" "Image $image_name construite avec succès"
        
        # Afficher la taille de l'image
        local size=$(docker images "$image_name" --format "{{.Size}}")
        echo "Taille: $size"
        echo ""
    else
        show_status "error" "Échec de la construction de $image_name"
        echo ""
        return 1
    fi
}

# Vérifier que Docker est en cours d'exécution
if ! docker info > /dev/null 2>&1; then
    show_status "error" "Docker n'est pas en cours d'exécution"
    exit 1
fi

# Activer BuildKit pour de meilleures performances
export DOCKER_BUILDKIT=1

echo -e "${YELLOW}🚀 Démarrage du build de toutes les images...${NC}"
echo ""

# Build des images Node.js
echo -e "${BLUE}📦 NODE.JS IMAGES${NC}"
echo ""

cd node-api

# Build image standard (anti-pattern)
if [ -f "Dockerfile.standard" ]; then
    build_image "Dockerfile.standard" "node-api:standard" "."
else
    show_status "warning" "Dockerfile.standard non trouvé"
fi

# Build image multi-stage
if [ -f "Dockerfile.multi-stage" ]; then
    build_image "Dockerfile.multi-stage" "node-api:multi-stage" "."
else
    show_status "warning" "Dockerfile.multi-stage non trouvé"
fi

# Build image distroless
if [ -f "Dockerfile.distroless" ]; then
    build_image "Dockerfile.distroless" "node-api:distroless" "."
else
    show_status "warning" "Dockerfile.distroless non trouvé"
fi

cd ..

# Build des images Python
echo -e "${BLUE}🐍 PYTHON IMAGES${NC}"
echo ""

cd python-api

# Build image distroless Python
if [ -f "Dockerfile.python-distroless" ]; then
    build_image "Dockerfile.python-distroless" "python-api:distroless" "."
else
    show_status "warning" "Dockerfile.python-distroless non trouvé"
fi

cd ..

# Build des images Java
echo -e "${BLUE}☕ JAVA IMAGES${NC}"
echo ""

cd java-api

# Build image distroless Java
if [ -f "Dockerfile.java-distroless" ]; then
    build_image "Dockerfile.java-distroless" "java-api:distroless" "."
else
    show_status "warning" "Dockerfile.java-distroless non trouvé"
fi

cd ..

echo -e "${BLUE}📊 RÉSUMÉ DES IMAGES CONSTRUITES${NC}"
echo ""

# Afficher toutes les images construites
echo "Images disponibles:"
docker images | grep -E "(node-api|python-api|java-api)" | while read line; do
    echo "  $line"
done

echo ""
echo -e "${GREEN}🎉 TOUS LES BUILDS TERMINÉS !${NC}"
echo ""

# Proposer de lancer les tests
echo -e "${YELLOW}🧪 Voulez-vous lancer les tests des applications ? (y/n)${NC}"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${BLUE}🚀 Lancement des tests...${NC}"
    
    # Test Node.js
    echo "Test Node.js distroless..."
    if docker run -d -p 3000:3000 --name node-test node-api:distroless; then
        sleep 5
        if curl -s http://localhost:3000/health > /dev/null; then
            show_status "success" "Node.js API fonctionne"
        else
            show_status "error" "Node.js API ne répond pas"
        fi
        docker rm -f node-test > /dev/null 2>&1
    fi
    
    # Test Python
    echo "Test Python distroless..."
    if docker run -d -p 8000:8000 --name python-test python-api:distroless; then
        sleep 5
        if curl -s http://localhost:8000/health > /dev/null; then
            show_status "success" "Python API fonctionne"
        else
            show_status "error" "Python API ne répond pas"
        fi
        docker rm -f python-test > /dev/null 2>&1
    fi
    
    # Test Java
    echo "Test Java distroless..."
    if docker run -d -p 8080:8080 --name java-test java-api:distroless; then
        sleep 10  # Java prend plus de temps à démarrer
        if curl -s http://localhost:8080/api/health > /dev/null; then
            show_status "success" "Java API fonctionne"
        else
            show_status "error" "Java API ne répond pas"
        fi
        docker rm -f java-test > /dev/null 2>&1
    fi
fi

echo ""
echo -e "${BLUE}📈 Prochaines étapes:${NC}"
echo "1. Exécutez ./scripts/analyze.sh pour analyser les images"
echo "2. Exécutez ./scripts/green-impact.sh pour calculer l'impact Green IT"
echo "3. Testez les images distroless avec dive et trivy"
echo ""

echo "=== ✅ BUILD TERMINÉ ==="
echo "Date: $(date)"
