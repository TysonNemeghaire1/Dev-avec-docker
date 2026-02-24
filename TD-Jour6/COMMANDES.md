# CloudShop — Commandes de référence

## Docker

### Build des images (dans le daemon minikube)
```bash
eval $(minikube docker-env)

docker build -t cloudshop/auth-service:latest  ./src/auth-service
docker build -t cloudshop/products-api:latest  ./src/products-api
docker build -t cloudshop/orders-api:latest    ./src/orders-api
docker build -t cloudshop/api-gateway:latest   ./src/api-gateway
docker build -t cloudshop/frontend:latest      ./src/frontend
```

### Images
```bash
docker images | grep cloudshop                          # lister les images
docker image inspect cloudshop/auth-service:latest      # inspecter une image
docker image inspect cloudshop/orders-api:latest --format='{{.Size}}'  # taille en octets
docker rmi cloudshop/auth-service:latest                # supprimer une image
```

### Docker Compose
```bash
docker compose up -d                    # démarrer la stack
docker compose up -d --build            # rebuild + démarrer
docker compose down                     # arrêter et supprimer les conteneurs
docker compose down -v                  # + supprimer les volumes
docker compose ps                       # état des conteneurs
docker compose logs -f auth-service     # logs en temps réel
docker compose restart products-api     # redémarrer un service
```

### Inspection des conteneurs
```bash
docker ps                               # conteneurs en cours
docker inspect cloudshop-api-gateway   # détails complets
docker exec -it cloudshop-postgres psql -U cloudshop -d cloudshop  # accès psql
docker stats                            # consommation CPU/RAM en direct
```

---

## Kubernetes — kubectl

### Namespace
```bash
kubectl get namespaces
kubectl config set-context --current --namespace=cloudshop-prod  # namespace par défaut
```

### Déploiement complet (ordre à respecter)
```bash
kubectl apply -f k8s/namespaces/
kubectl apply -f k8s/configs/secrets/
kubectl apply -f k8s/configs/configmaps/
kubectl apply -f k8s/statefulsets/
kubectl wait --for=condition=ready pod -l app=postgres -n cloudshop-prod --timeout=120s
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/
kubectl apply -f k8s/ingress/
```

### Suppression complète
```bash
kubectl delete namespace cloudshop-prod          # supprime tout dans le namespace
kubectl delete -f k8s/                           # supprime ressource par ressource
```

### Pods
```bash
kubectl get pods -n cloudshop-prod               # état des pods
kubectl get pods -n cloudshop-prod -w            # watch en temps réel
kubectl describe pod <nom-pod> -n cloudshop-prod # détails et events
kubectl logs <nom-pod> -n cloudshop-prod         # logs du pod
kubectl logs <nom-pod> -n cloudshop-prod --previous  # logs du crash précédent
kubectl exec -it <nom-pod> -n cloudshop-prod -- sh   # shell dans le pod
```

### Deployments
```bash
kubectl get deployments -n cloudshop-prod
kubectl rollout status deployment/api-gateway -n cloudshop-prod
kubectl rollout history deployment/api-gateway -n cloudshop-prod
kubectl rollout undo deployment/api-gateway -n cloudshop-prod    # rollback
kubectl scale deployment/api-gateway --replicas=5 -n cloudshop-prod
kubectl set image deployment/frontend frontend=cloudshop/frontend:v2.0.0 -n cloudshop-prod
```

### Services & Ingress
```bash
kubectl get svc -n cloudshop-prod
kubectl get ingress -n cloudshop-prod
kubectl describe ingress cloudshop-ingress -n cloudshop-prod
kubectl get endpoints -n cloudshop-prod          # vérifier que les pods sont bien liés
```

### Secrets & ConfigMaps
```bash
kubectl get secrets -n cloudshop-prod
kubectl get configmaps -n cloudshop-prod
kubectl describe configmap app-config -n cloudshop-prod
kubectl get secret db-credentials -n cloudshop-prod -o jsonpath='{.data.POSTGRES_USER}' | base64 -d
```

### StatefulSet & PVC
```bash
kubectl get statefulsets -n cloudshop-prod
kubectl get pvc -n cloudshop-prod                # volumes persistants
kubectl get pv                                   # persistent volumes (cluster-wide)
```

### Tout voir d'un coup
```bash
kubectl get all -n cloudshop-prod
kubectl get events -n cloudshop-prod --sort-by='.lastTimestamp'
```

### Port-forward (test local)
```bash
kubectl port-forward svc/api-gateway 8080:8080 -n cloudshop-prod
kubectl port-forward svc/frontend 3000:80 -n cloudshop-prod
kubectl port-forward pod/postgres-0 5432:5432 -n cloudshop-prod
```

### Debug réseau (pod temporaire)
```bash
kubectl run debug --rm -it --image=busybox --restart=Never -n cloudshop-prod -- sh
# Puis dans le pod :
wget -O- http://api-gateway:8080/health
nslookup postgres
```

---

## minikube

```bash
minikube start                          # démarrer le cluster
minikube stop                           # arrêter
minikube delete                         # supprimer le cluster
minikube status                         # état
minikube ip                             # IP du cluster

minikube addons enable ingress          # activer l'ingress nginx
minikube addons enable metrics-server   # activer les métriques
minikube addons list                    # voir tous les addons

eval $(minikube docker-env)             # pointer Docker vers minikube
eval $(minikube docker-env -u)          # revenir au Docker host

minikube dashboard                      # ouvrir le dashboard K8s
minikube tunnel                         # exposer les LoadBalancer services
minikube ssh                            # SSH dans le nœud minikube
```

### /etc/hosts (accès via Ingress)
```bash
echo "$(minikube ip)  shop.local  api.local" | sudo tee -a /etc/hosts
```

---

## Tests API (curl)

```bash
# Health checks
curl http://localhost:8080/health
curl http://localhost:8080/auth/health
curl http://localhost:8080/products/health
curl http://localhost:8080/orders/health

# Inscription
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!","firstName":"Test","lastName":"User"}'

# Connexion
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'

# Produits (avec token JWT)
curl http://localhost:8080/products/ \
  -H "Authorization: Bearer <token>"

# Commandes
curl http://localhost:8080/orders/ \
  -H "Authorization: Bearer <token>"

# Via Ingress
curl -H "Host: api.local" http://$(minikube ip)/health
curl -H "Host: shop.local" http://$(minikube ip)/
```

---

## Encode / Décode Base64 (Secrets K8s)

```bash
echo -n 'valeur' | base64          # encoder
echo -n 'dmFsZXVy' | base64 -d    # décoder
```

---

## Démonstration

```bash
./demo.sh                           # lancer le script de démo complet
```
