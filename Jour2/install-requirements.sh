#!/bin/bash

# Script d'installation des prérequis pour le TP Docker Avancé
# Master 2 Full Stack - Docker Optimization

echo "=== INSTALLATION DES PRÉREQUIS TP DOCKER ==="
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

# Vérifier le système d'exploitation
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

OS=$(detect_os)
echo -e "${BLUE}🖥️  Système détecté: $OS${NC}"
echo ""

# Installation de Docker
install_docker() {
    echo -e "${BLUE}🐳 Installation de Docker...${NC}"
    
    if command -v docker &> /dev/null; then
        show_status "success" "Docker est déjà installé"
        docker --version
    else
        case $OS in
            "linux")
                # Installation Docker sur Linux
                show_status "info" "Installation de Docker sur Linux"
                curl -fsSL https://get.docker.com -o get-docker.sh
                sudo sh get-docker.sh
                sudo usermod -aG docker $USER
                show_status "success" "Docker installé. Redémarrez votre session pour utiliser Docker sans sudo."
                ;;
            "macos")
                # Installation Docker sur macOS
                show_status "info" "Installation de Docker Desktop sur macOS"
                if command -v brew &> /dev/null; then
                    brew install --cask docker
                else
                    show_status "warning" "Homebrew non trouvé. Installez Docker Desktop manuellement depuis https://docker.com"
                fi
                ;;
            "windows")
                show_status "info" "Installez Docker Desktop depuis https://docker.com"
                ;;
        esac
    fi
    echo ""
}

# Installation de Python et pip
install_python() {
    echo -e "${BLUE}🐍 Installation de Python et pip...${NC}"
    
    if command -v python3 &> /dev/null; then
        show_status "success" "Python3 est déjà installé"
        python3 --version
    else
        case $OS in
            "linux")
                sudo apt-get update
                sudo apt-get install -y python3 python3-pip python3-venv
                ;;
            "macos")
                if command -v brew &> /dev/null; then
                    brew install python
                else
                    show_status "warning" "Homebrew non trouvé. Installez Python manuellement"
                fi
                ;;
        esac
    fi
    
    # Vérifier pip
    if command -v pip3 &> /dev/null; then
        show_status "success" "pip3 est disponible"
        pip3 --version
    else
        show_status "error" "pip3 non trouvé"
    fi
    echo ""
}

# Installation de Node.js et npm
install_nodejs() {
    echo -e "${BLUE}📦 Installation de Node.js et npm...${NC}"
    
    if command -v node &> /dev/null; then
        show_status "success" "Node.js est déjà installé"
        node --version
        npm --version
    else
        case $OS in
            "linux")
                # Installation Node.js via NodeSource
                curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
                sudo apt-get install -y nodejs
                ;;
            "macos")
                if command -v brew &> /dev/null; then
                    brew install node
                else
                    show_status "warning" "Homebrew non trouvé. Installez Node.js manuellement"
                fi
                ;;
        esac
    fi
    echo ""
}

# Installation de Java et Maven
install_java() {
    echo -e "${BLUE}☕ Installation de Java et Maven...${NC}"
    
    if command -v java &> /dev/null; then
        show_status "success" "Java est déjà installé"
        java --version
    else
        case $OS in
            "linux")
                sudo apt-get update
                sudo apt-get install -y openjdk-17-jdk maven
                ;;
            "macos")
                if command -v brew &> /dev/null; then
                    brew install openjdk@17 maven
                else
                    show_status "warning" "Homebrew non trouvé. Installez Java manuellement"
                fi
                ;;
        esac
    fi
    
    # Vérifier Maven
    if command -v mvn &> /dev/null; then
        show_status "success" "Maven est disponible"
        mvn --version
    else
        show_status "error" "Maven non trouvé"
    fi
    echo ""
}

# Installation des outils d'analyse Docker
install_docker_tools() {
    echo -e "${BLUE}🔧 Installation des outils d'analyse Docker...${NC}"
    
    # Dive - Analyse des layers Docker
    if command -v dive &> /dev/null; then
        show_status "success" "Dive est déjà installé"
    else
        case $OS in
            "linux")
                wget https://github.com/wagoodman/dive/releases/download/v0.10.0/dive_0.10.0_linux_amd64.deb
                sudo apt install ./dive_0.10.0_linux_amd64.deb
                rm dive_0.10.0_linux_amd64.deb
                ;;
            "macos")
                if command -v brew &> /dev/null; then
                    brew install dive
                else
                    show_status "warning" "Homebrew non trouvé. Installez Dive manuellement"
                fi
                ;;
        esac
    fi
    
    # Trivy - Scanner de vulnérabilités
    if command -v trivy &> /dev/null; then
        show_status "success" "Trivy est déjà installé"
    else
        case $OS in
            "linux")
                sudo apt-get update
                sudo apt-get install wget apt-transport-https gnupg lsb-release
                wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
                echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
                sudo apt-get update
                sudo apt-get install trivy
                ;;
            "macos")
                if command -v brew &> /dev/null; then
                    brew install trivy
                else
                    show_status "warning" "Homebrew non trouvé. Installez Trivy manuellement"
                fi
                ;;
        esac
    fi
    
    # Syft - Génération de SBOM
    if command -v syft &> /dev/null; then
        show_status "success" "Syft est déjà installé"
    else
        case $OS in
            "linux")
                curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
                ;;
            "macos")
                if command -v brew &> /dev/null; then
                    brew install syft
                else
                    show_status "warning" "Homebrew non trouvé. Installez Syft manuellement"
                fi
                ;;
        esac
    fi
    echo ""
}

# Installation de Poetry pour Python
install_poetry() {
    echo -e "${BLUE}📚 Installation de Poetry...${NC}"
    
    if command -v poetry &> /dev/null; then
        show_status "success" "Poetry est déjà installé"
        poetry --version
    else
        show_status "info" "Installation de Poetry"
        curl -sSL https://install.python-poetry.org | python3 -
        
        # Ajouter Poetry au PATH
        if [ -f "$HOME/.local/bin/poetry" ]; then
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
            show_status "success" "Poetry installé. Redémarrez votre terminal ou exécutez: source ~/.bashrc"
        fi
    fi
    echo ""
}

# Installation de Homebrew sur macOS
install_homebrew() {
    if [[ "$OS" == "macos" ]] && ! command -v brew &> /dev/null; then
        echo -e "${BLUE}🍺 Installation de Homebrew...${NC}"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Ajouter Homebrew au PATH
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
        
        show_status "success" "Homebrew installé"
        echo ""
    fi
}

# Configuration de l'environnement
setup_environment() {
    echo -e "${BLUE}⚙️  Configuration de l'environnement...${NC}"
    
    # Activer BuildKit pour Docker
    echo 'export DOCKER_BUILDKIT=1' >> ~/.bashrc
    echo 'export DOCKER_BUILDKIT=1' >> ~/.zshrc
    export DOCKER_BUILDKIT=1
    
    show_status "success" "DOCKER_BUILDKIT activé"
    echo ""
}

# Vérification finale
final_check() {
    echo -e "${BLUE}🔍 Vérification finale des installations...${NC}"
    echo ""
    
    # Docker
    if command -v docker &> /dev/null; then
        show_status "success" "Docker: $(docker --version)"
    else
        show_status "error" "Docker non installé"
    fi
    
    # Python
    if command -v python3 &> /dev/null; then
        show_status "success" "Python: $(python3 --version)"
    else
        show_status "error" "Python3 non installé"
    fi
    
    # pip
    if command -v pip3 &> /dev/null; then
        show_status "success" "pip: $(pip3 --version)"
    else
        show_status "error" "pip3 non installé"
    fi
    
    # Node.js
    if command -v node &> /dev/null; then
        show_status "success" "Node.js: $(node --version)"
    else
        show_status "error" "Node.js non installé"
    fi
    
    # Java
    if command -v java &> /dev/null; then
        show_status "success" "Java: $(java --version | head -1)"
    else
        show_status "error" "Java non installé"
    fi
    
    # Maven
    if command -v mvn &> /dev/null; then
        show_status "success" "Maven: $(mvn --version | head -1)"
    else
        show_status "error" "Maven non installé"
    fi
    
    # Poetry
    if command -v poetry &> /dev/null; then
        show_status "success" "Poetry: $(poetry --version)"
    else
        show_status "warning" "Poetry non installé"
    fi
    
    # Dive
    if command -v dive &> /dev/null; then
        show_status "success" "Dive: $(dive --version)"
    else
        show_status "warning" "Dive non installé"
    fi
    
    # Trivy
    if command -v trivy &> /dev/null; then
        show_status "success" "Trivy: $(trivy --version)"
    else
        show_status "warning" "Trivy non installé"
    fi
    
    echo ""
}

# Menu principal
main_menu() {
    echo -e "${YELLOW}Que souhaitez-vous installer ?${NC}"
    echo "1. Tout installer (recommandé)"
    echo "2. Docker uniquement"
    echo "3. Python et pip uniquement"
    echo "4. Node.js et npm uniquement"
    echo "5. Java et Maven uniquement"
    echo "6. Outils d'analyse Docker uniquement"
    echo "7. Vérification uniquement"
    echo "8. Quitter"
    echo ""
    read -p "Votre choix (1-8): " choice
    
    case $choice in
        1)
            install_homebrew
            install_docker
            install_python
            install_nodejs
            install_java
            install_poetry
            install_docker_tools
            setup_environment
            final_check
            ;;
        2)
            install_docker
            final_check
            ;;
        3)
            install_python
            install_poetry
            final_check
            ;;
        4)
            install_nodejs
            final_check
            ;;
        5)
            install_java
            final_check
            ;;
        6)
            install_docker_tools
            final_check
            ;;
        7)
            final_check
            ;;
        8)
            echo "Au revoir !"
            exit 0
            ;;
        *)
            echo "Choix invalide"
            main_menu
            ;;
    esac
}

# Exécution du script
echo -e "${GREEN}🎓 TP Docker Avancé - Installation des prérequis${NC}"
echo ""

# Vérifier si le script est exécuté avec des arguments
if [ $# -eq 0 ]; then
    main_menu
else
    # Installation automatique si des arguments sont fournis
    case $1 in
        "all"|"tout")
            install_homebrew
            install_docker
            install_python
            install_nodejs
            install_java
            install_poetry
            install_docker_tools
            setup_environment
            final_check
            ;;
        "docker")
            install_docker
            final_check
            ;;
        "python")
            install_python
            install_poetry
            final_check
            ;;
        "node")
            install_nodejs
            final_check
            ;;
        "java")
            install_java
            final_check
            ;;
        "tools")
            install_docker_tools
            final_check
            ;;
        "check")
            final_check
            ;;
        *)
            echo "Usage: $0 [all|docker|python|node|java|tools|check]"
            echo "Ou exécutez sans arguments pour le menu interactif"
            ;;
    esac
fi

echo ""
echo -e "${GREEN}🎉 Installation terminée !${NC}"
echo ""
echo -e "${BLUE}📚 Prochaines étapes:${NC}"
echo "1. Redémarrez votre terminal"
echo "2. Naviguez vers le dossier TP: cd Jour2/TP"
echo "3. Exécutez: ./scripts/build-all.sh"
echo "4. Suivez les instructions du README.md"
echo ""
echo -e "${YELLOW}💡 Conseil: Redémarrez votre session pour que tous les PATH soient mis à jour${NC}"
