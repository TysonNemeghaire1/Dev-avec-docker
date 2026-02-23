const express = require('express');
const cors = require('cors');
const axios = require('axios');
const promClient = require('prom-client');
const winston = require('winston');

// Configuration
const PORT = process.env.PORT || 8080;
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:8081';

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service']
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);

// Express app
const app = express();

app.use(cors());
app.use(express.json());

// Middleware pour mesurer les requêtes
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    
    httpRequestDuration.observe(
      { method: req.method, route: req.route?.path || req.path, status_code: res.statusCode },
      duration
    );
    
    httpRequestsTotal.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode,
      service: 'backend'
    });
    
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: duration,
      userAgent: req.get('user-agent')
    });
  });
  
  next();
});

// Mock database
const products = [
  {
    id: 1,
    name: 'MacBook Pro M3',
    description: 'Ordinateur portable haute performance pour développeurs',
    price: 2499,
    stock: 15
  },
  {
    id: 2,
    name: 'iPhone 15 Pro',
    description: 'Smartphone dernière génération avec puce A17',
    price: 1299,
    stock: 42
  },
  {
    id: 3,
    name: 'AirPods Pro 2',
    description: 'Écouteurs sans fil avec réduction de bruit active',
    price: 279,
    stock: 87
  },
  {
    id: 4,
    name: 'iPad Air',
    description: 'Tablette polyvalente avec puce M1',
    price: 699,
    stock: 23
  },
  {
    id: 5,
    name: 'Apple Watch Series 9',
    description: 'Montre connectée avec suivi santé avancé',
    price: 449,
    stock: 56
  },
  {
    id: 6,
    name: 'Magic Keyboard',
    description: 'Clavier sans fil avec pavé numérique',
    price: 149,
    stock: 34
  }
];

// Routes

// Health check (readiness)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    service: 'backend-api',
    timestamp: new Date().toISOString()
  });
});

// Readiness check (vérifie les dépendances)
app.get('/ready', async (req, res) => {
  try {
    // Vérifier que le payment service est accessible
    await axios.get(`${PAYMENT_SERVICE_URL}/health`, { timeout: 2000 });
    res.status(200).json({ 
      status: 'ready',
      dependencies: {
        paymentService: 'ok'
      }
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'not ready',
      dependencies: {
        paymentService: 'error'
      }
    });
  }
});

// Liveness check
app.get('/healthz', (req, res) => {
  res.status(200).send('ok');
});

// Metrics endpoint pour Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// API Routes

// Liste des produits
app.get('/products', (req, res) => {
  logger.info('Fetching products list');
  res.json(products);
});

// Détail d'un produit
app.get('/products/:id', (req, res) => {
  const productId = parseInt(req.params.id);
  const product = products.find(p => p.id === productId);
  
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  res.json(product);
});

// Traiter un paiement (proxy vers payment-service)
app.post('/payment/process', async (req, res) => {
  const { productId, amount, userId } = req.body;
  
  logger.info('Processing payment', { productId, amount, userId });
  
  // Validation
  if (!productId || !amount || !userId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields' 
    });
  }
  
  // Vérifier que le produit existe
  const product = products.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({ 
      success: false, 
      error: 'Product not found' 
    });
  }
  
  // Vérifier le stock
  if (product.stock <= 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Product out of stock' 
    });
  }
  
  try {
    // Appeler le payment service
    const paymentResponse = await axios.post(
      `${PAYMENT_SERVICE_URL}/process`,
      { productId, amount, userId },
      { timeout: 5000 }
    );
    
    if (paymentResponse.data.success) {
      // Décrémenter le stock
      product.stock -= 1;
      logger.info('Payment successful', { 
        transactionId: paymentResponse.data.transactionId,
        productId 
      });
    }
    
    res.json(paymentResponse.data);
    
  } catch (error) {
    logger.error('Payment service error', { 
      error: error.message,
      productId,
      userId
    });
    
    res.status(503).json({ 
      success: false, 
      error: 'Payment service unavailable' 
    });
  }
});

// Route de test pour simuler des erreurs (utile pour le chaos engineering)
app.get('/chaos/error', (req, res) => {
  logger.error('Simulated error endpoint called');
  res.status(500).json({ error: 'Simulated error for testing' });
});

// Route de test pour simuler de la latence
app.get('/chaos/slow', (req, res) => {
  const delay = parseInt(req.query.delay) || 3000;
  setTimeout(() => {
    res.json({ message: 'Slow response', delay });
  }, delay);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Backend API listening on port ${PORT}`);
  logger.info(`Payment service URL: ${PAYMENT_SERVICE_URL}`);
});
