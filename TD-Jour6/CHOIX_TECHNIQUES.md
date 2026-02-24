# CloudShop — Choix techniques : Dockerfiles & Docker Compose

**Projet :** CloudShop — Plateforme e-commerce microservices
**Date :** 24 février 2026
**Contexte :** M2 Full Stack — Docker & Kubernetes

---

## Vue d'ensemble de l'architecture

5 microservices conteneurisés indépendamment, orchestrés par Docker Compose :

| Service        | Image de base         | Port | Langage / Framework      |
|----------------|-----------------------|------|--------------------------|
| frontend       | node:20-alpine + nginx:alpine | 3000→80 | React + Vite            |
| api-gateway    | node:20-alpine        | 8080 | Node.js Express          |
| auth-service   | node:20-alpine        | 8081 | Node.js + JWT            |
| products-api   | python:3.11-slim      | 8082 | Python FastAPI + uvicorn |
| orders-api     | golang:1.21-alpine → alpine:latest | 8083 | Go              |
| postgres       | postgres:15-alpine    | 5432 | Base de données partagée |

---

## 1. Dockerfiles — Choix communs à tous les services

### Multi-stage builds (tous les services)

Tous les Dockerfiles utilisent un **build multi-stage** (builder + runtime). Ce pattern est justifié par :

- **Réduction de la taille des images** : les outils de compilation (gcc, go toolchain, npm devDependencies) ne sont pas embarqués dans l'image finale
- **Surface d'attaque réduite** : moins de binaires = moins de vecteurs de vulnérabilités
- **Respect de la contrainte** : images < 200 MB exigées dans le TD

### Utilisateur non-root (tous les services)

Chaque Dockerfile crée un utilisateur applicatif dédié (UID 1001) et bascule avec `USER appuser` avant de lancer le processus :

```dockerfile
RUN addgroup -g 1001 appgroup && adduser -D -u 1001 -G appgroup appuser
USER appuser
```

**Justification :** best practice de sécurité — si un attaquant compromet le processus, il n'a pas les droits root sur le système hôte. C'est également exigé explicitement dans le TD.

### HEALTHCHECK intégré (api-gateway, auth-service, products-api, orders-api)

Chaque Dockerfile déclare un `HEALTHCHECK` qui interroge l'endpoint `/health` du service. Cela permet à Docker de connaître l'état réel du service et au Compose de gérer les `depends_on` avec `condition: service_healthy`.

---

## 2. Dockerfiles — Choix spécifiques par service

### Frontend (React + Vite → Nginx)

**Pattern :** build Node.js → serveur Nginx statique

```
Stage 1 (builder) : node:20-alpine  →  npm ci + npm run build  →  /app/dist
Stage 2 (runtime) : nginx:alpine    →  copie de /app/dist
```

**Pourquoi nginx:alpine en runtime ?**
Une SPA React est du HTML/CSS/JS statique après compilation. Il n'y a aucune raison d'embarquer Node.js dans l'image finale. `nginx:alpine` (~7 MB) sert les assets statiquement, ce qui est plus performant et plus léger.

**nginx.conf :** configuration minimale avec `try_files $uri $uri/ /index.html` pour gérer le routing côté client (React Router).

**Permissions sur Nginx :** les répertoires `/var/cache/nginx`, `/var/log/nginx` et le PID file sont `chown`-és à `appuser` pour permettre à Nginx de tourner sans root.

---

### API Gateway (Node.js Express)

**Pattern :** builder installe uniquement les dépendances de production

```dockerfile
RUN npm ci --only=production && npm cache clean --force
```

**Justification :** `--only=production` exclut les `devDependencies` (ESLint, test runners, etc.), `npm cache clean` supprime le cache pour alléger l'image.

**Fonctionnalités embarquées dans le code :**
- `helmet` — headers HTTP de sécurité
- `express-rate-limit` — protection DDoS (100 req / 15 min)
- `http-proxy-middleware` — reverse proxy vers les 3 APIs backend
- Gestion des erreurs 503 si un service downstream est indisponible

---

### Auth Service (Node.js + JWT)

Même pattern que l'API Gateway. Les `LABEL` Docker (maintainer, version, description) ont été ajoutés pour la traçabilité des images en registre.

```dockerfile
LABEL maintainer="cloudshop-team"
LABEL version="1.0.0"
```

---

### Products API (Python FastAPI)

**Spécificité :** installation des packages Python dans `--user` home pour la séparation builder/runtime

```dockerfile
# Builder : installe dans /root/.local (mode user)
RUN pip install --no-cache-dir --user -r requirements.txt

# Runtime : copie le répertoire .local vers le home de appuser
COPY --from=builder /root/.local /home/appuser/.local
ENV PATH=/home/appuser/.local/bin:$PATH
```

**Pourquoi python:3.11-slim ?** L'image `-slim` exclut les outils de développement, manuels et fichiers de localisation (~60 MB de moins que l'image full). `gcc` est installé uniquement dans le stage builder pour compiler les éventuelles dépendances C, puis supprimé avec `rm -rf /var/lib/apt/lists/*`.

**Serveur ASGI :** `uvicorn` avec `--host 0.0.0.0` pour écouter sur toutes les interfaces réseau du conteneur.

---

### Orders API (Go)

**Pattern le plus agressif sur la taille** : Go compile vers un binaire statique, l'image finale est un `alpine:latest` nu.

```dockerfile
# Builder : golang:1.21-alpine
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o orders-api .

# Runtime : alpine:latest (pas de Go toolchain)
FROM alpine:latest
RUN apk --no-cache add ca-certificates
COPY --from=builder /app/orders-api .
```

**Pourquoi `CGO_ENABLED=0` ?** Désactive CGo pour produire un binaire **statiquement lié**, sans dépendance aux librairies C du système. Le binaire est donc portable sur n'importe quelle image Linux, même un `scratch`.

**Pourquoi `alpine` et pas `scratch` ?** `alpine` fournit `ca-certificates` (nécessaire pour les connexions HTTPS sortantes) et `wget` (utilisé par le HEALTHCHECK). Un `scratch` ne permettrait pas le healthcheck natif.

---

## 3. Docker Compose — Choix d'architecture

### Réseau dédié

```yaml
networks:
  cloudshop-net:
    driver: bridge
```

Tous les services sont sur un réseau `bridge` isolé. La communication inter-services se fait par **nom de service** (DNS interne Docker), sans exposition publique des ports internes. Seuls les ports nécessaires au développement sont mappés sur l'hôte.

### Gestion des secrets — Variables d'environnement + `.env`

Les credentials sensibles ne sont **jamais hardcodés** dans `docker-compose.yml` :

```yaml
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  JWT_SECRET: ${JWT_SECRET}
```

Un fichier `.env.example` est versionné (sans les vraies valeurs). Le `.env` réel est dans `.gitignore`. Ce pattern est compatible avec la gestion des Secrets Kubernetes pour la suite du TD.

### Healthchecks et `depends_on` conditionnels

```yaml
depends_on:
  postgres:
    condition: service_healthy
```

Le `condition: service_healthy` (et non le simple `depends_on`) garantit qu'un service ne démarre que quand ses dépendances sont **réellement prêtes**, et pas seulement démarrées. La chaîne de démarrage est :

```
postgres (healthy)
    └── auth-service (healthy)
    └── products-api (healthy)
    └── orders-api (healthy)
            └── api-gateway (healthy)
                    └── frontend
```

**Chaque healthcheck est adapté au langage du service :**

| Service        | Outil de healthcheck              | Justification                            |
|----------------|-----------------------------------|------------------------------------------|
| postgres       | `pg_isready`                      | outil natif PostgreSQL                   |
| auth-service   | `node -e http.get(...)`           | pas de curl/wget dans node:alpine        |
| api-gateway    | `node -e http.get(...)`           | idem                                     |
| products-api   | `python -c urllib.request...`     | pas de curl dans python:slim             |
| orders-api     | `wget --spider`                   | wget disponible dans alpine              |

### Volume persistant pour PostgreSQL

```yaml
volumes:
  postgres-data:

services:
  postgres:
    volumes:
      - postgres-data:/var/lib/postgresql/data
```

Le volume nommé `postgres-data` survit aux redémarrages (`docker-compose down`) mais est supprimé par `docker-compose down -v`. Ce comportement est intentionnel pour le développement local.

### Image officielle PostgreSQL Alpine

`postgres:15-alpine` a été choisi pour sa légèreté par rapport à `postgres:15` (Debian). La version 15 est utilisée pour sa compatibilité avec les fonctionnalités récentes (JSON path, MERGE).

---

## 4. .dockerignore — Exclusions

Chaque service possède un `.dockerignore` pour exclure du contexte de build :
- `node_modules/` — recréés lors du `npm ci`
- `*.log`, `.env` — fichiers de runtime et secrets
- `.git/` — historique Git non nécessaire dans l'image

Cela accélère les builds et évite de copier accidentellement des credentials dans une image.

---

## 5. Respect des contraintes du TD

| Contrainte                          | Solution retenue                                     |
|-------------------------------------|------------------------------------------------------|
| Images < 200 MB                     | Multi-stage + bases Alpine/slim + binaire statique Go |
| Utilisateur non-root obligatoire    | `adduser` + `USER appuser` dans chaque Dockerfile    |
| Pas de credentials hardcodés        | Variables `${VAR}` + fichier `.env`                  |
| Healthchecks                        | `HEALTHCHECK` dans Dockerfile + healthcheck Compose  |
| Réseau isolé                        | `cloudshop-net` bridge dédié                         |
| Ordre de démarrage maîtrisé         | `depends_on` avec `condition: service_healthy`       |

---

## 6. Limites identifiées et pistes d'amélioration

- **`alpine:latest`** dans orders-api devrait être épinglé (`alpine:3.19`) pour des builds reproductibles
- **Pas de `read_only: true`** sur les systèmes de fichiers des conteneurs — à ajouter pour durcir la sécurité
- **Absence de `restart: unless-stopped`** — à envisager pour un environnement de démo prolongée
- **Secrets Docker Swarm / Kubernetes Secrets** remplaceront les variables d'environnement en production
