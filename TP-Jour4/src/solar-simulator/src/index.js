const express = require('express');
const { updateMetrics, getRegister, getCurrentData } = require('./metrics');
const { farms } = require('./farms');

const app = express();
const PORT = process.env.PORT || 3000;
const METRICS_INTERVAL = parseInt(process.env.METRICS_INTERVAL || '30000', 10); // 30 secondes

// Middleware pour le logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Endpoint de santé
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Endpoint de readiness
app.get('/ready', (req, res) => {
  res.json({ status: 'ready', timestamp: new Date().toISOString() });
});

// Endpoint métriques Prometheus
app.get('/metrics', async (req, res) => {
  try {
    const register = getRegister();
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    console.error('Erreur lors de la génération des métriques:', err);
    res.status(500).end(err.message);
  }
});

// API REST - Liste des fermes
app.get('/api/farms', (req, res) => {
  res.json({
    farms: Object.values(farms).map((f) => ({
      name: f.name,
      location: f.location,
      panels: f.panels,
      capacityMW: f.capacityMW,
      inverters: f.inverters,
    })),
  });
});

// API REST - Données actuelles d'une ferme
app.get('/api/farms/:farmName', (req, res) => {
  const { farmName } = req.params;
  const data = getCurrentData();

  if (!data[farmName]) {
    return res.status(404).json({ error: `Farm '${farmName}' not found` });
  }

  res.json(data[farmName]);
});

// API REST - Données actuelles de toutes les fermes
app.get('/api/data', (req, res) => {
  res.json(getCurrentData());
});

// Initialisation et démarrage
function start() {
  // Première mise à jour immédiate
  console.log('Initialisation des métriques...');
  updateMetrics();

  // Mise à jour périodique des métriques
  setInterval(updateMetrics, METRICS_INTERVAL);
  console.log(`Métriques mises à jour toutes les ${METRICS_INTERVAL / 1000} secondes`);

  // Démarrage du serveur
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║          Solar Farm Simulator - v1.0.0                     ║
╠════════════════════════════════════════════════════════════╣
║  Serveur démarré sur le port ${PORT}                           ║
║                                                            ║
║  Endpoints disponibles:                                    ║
║    GET /health       - Vérification de santé               ║
║    GET /ready        - Vérification de readiness           ║
║    GET /metrics      - Métriques Prometheus                ║
║    GET /api/farms    - Liste des fermes                    ║
║    GET /api/farms/:n - Données d'une ferme                 ║
║    GET /api/data     - Toutes les données actuelles        ║
║                                                            ║
║  Fermes simulées: provence, occitanie, aquitaine           ║
╚════════════════════════════════════════════════════════════╝
    `);
  });
}

start();
