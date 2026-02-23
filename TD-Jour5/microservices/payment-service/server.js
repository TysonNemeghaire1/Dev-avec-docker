const express = require('express');
const { v4: uuidv4 } = require('uuid');
const promClient = require('prom-client');
const winston = require('winston');

// Configuration
const PORT = process.env.PORT || 8081;
const FAILURE_RATE = parseFloat(process.env.FAILURE_RATE) || 0.01; // 1% de taux d'échec par défaut

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

// Custom metrics spécifiques au payment service
const paymentRequestsTotal = new promClient.Counter({
  name: 'payment_requests_total',
  help: 'Total number of payment requests',
  labelNames: ['status', 'service']
});

const paymentDuration = new promClient.Histogram({
  name: 'payment_duration_seconds',
  help: 'Duration of payment processing in seconds',
  labelNames: ['status'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 2, 5]
});

const paymentAmountTotal = new promClient.Counter({
  name: 'payment_amount_total_euros',
  help: 'Total amount of payments processed in euros',
  labelNames: ['status']
});

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service']
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5]
});

register.registerMetric(paymentRequestsTotal);
register.registerMetric(paymentDuration);
register.registerMetric(paymentAmountTotal);
register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDuration);

// Express app
const app = express();
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
      service: 'payment'
    });
    
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: duration
    });
  });
  
  next();
});

// Simuler une base de données de transactions
const transactions = [];

// Routes

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    service: 'payment-service',
    timestamp: new Date().toISOString()
  });
});

// Readiness check (simule une vérification de connexion DB)
app.get('/ready', (req, res) => {
  // Simuler un temps de démarrage (utile pour tester les readiness probes)
  const uptime = process.uptime();
  if (uptime < 5) {
    return res.status(503).json({ 
      status: 'not ready',
      message: 'Service is still initializing',
      uptime: uptime
    });
  }
  
  res.status(200).json({ 
    status: 'ready',
    uptime: uptime
  });
});

// Liveness check
app.get('/healthz', (req, res) => {
  res.status(200).send('ok');
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Traiter un paiement
app.post('/process', async (req, res) => {
  const start = Date.now();
  const { productId, amount, userId } = req.body;
  
  logger.info('Payment request received', { productId, amount, userId });
  
  // Validation
  if (!productId || !amount || !userId) {
    paymentRequestsTotal.inc({ status: 'invalid', service: 'payment' });
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields' 
    });
  }
  
  if (amount <= 0) {
    paymentRequestsTotal.inc({ status: 'invalid', service: 'payment' });
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid amount' 
    });
  }
  
  // Simuler un délai de traitement (appel à une API bancaire)
  const processingDelay = Math.random() * 500 + 100; // 100-600ms
  await new Promise(resolve => setTimeout(resolve, processingDelay));
  
  // Simuler un taux d'échec aléatoire (pour tester la résilience)
  const shouldFail = Math.random() < FAILURE_RATE;
  
  if (shouldFail) {
    const duration = (Date.now() - start) / 1000;
    paymentDuration.observe({ status: 'failed' }, duration);
    paymentRequestsTotal.inc({ status: 'failed', service: 'payment' });
    
    logger.error('Payment failed', { productId, amount, userId, reason: 'bank_declined' });
    
    return res.status(402).json({ 
      success: false, 
      error: 'Payment declined by bank',
      transactionId: uuidv4()
    });
  }
  
  // Paiement réussi
  const transactionId = uuidv4();
  const transaction = {
    id: transactionId,
    productId,
    amount,
    userId,
    timestamp: new Date().toISOString(),
    status: 'completed'
  };
  
  transactions.push(transaction);
  
  const duration = (Date.now() - start) / 1000;
  paymentDuration.observe({ status: 'success' }, duration);
  paymentRequestsTotal.inc({ status: 'success', service: 'payment' });
  paymentAmountTotal.inc({ status: 'success' }, amount);
  
  logger.info('Payment successful', { 
    transactionId, 
    productId, 
    amount, 
    userId,
    duration 
  });
  
  res.status(200).json({ 
    success: true, 
    transactionId,
    amount,
    timestamp: transaction.timestamp
  });
});

// Récupérer l'historique des transactions (pour debug)
app.get('/transactions', (req, res) => {
  res.json({
    total: transactions.length,
    transactions: transactions.slice(-20) // Dernières 20 transactions
  });
});

// Récupérer une transaction spécifique
app.get('/transactions/:id', (req, res) => {
  const transaction = transactions.find(t => t.id === req.params.id);
  
  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  
  res.json(transaction);
});

// Route pour tester le chaos engineering
app.post('/chaos/fail', (req, res) => {
  logger.error('Chaos: Forced failure');
  paymentRequestsTotal.inc({ status: 'chaos_failed', service: 'payment' });
  res.status(500).json({ 
    success: false, 
    error: 'Chaos engineering: Forced failure' 
  });
});

// Route pour simuler une latence élevée
app.get('/chaos/slow', async (req, res) => {
  const delay = parseInt(req.query.delay) || 5000;
  logger.warn('Chaos: Simulating slow response', { delay });
  await new Promise(resolve => setTimeout(resolve, delay));
  res.json({ message: 'Slow response', delay });
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
  logger.info(`Payment Service listening on port ${PORT}`);
  logger.info(`Failure rate: ${FAILURE_RATE * 100}%`);
});
