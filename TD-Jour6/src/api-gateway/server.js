const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Configuration
const PORT = process.env.PORT || 8080;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:8081';
const PRODUCTS_API_URL = process.env.PRODUCTS_API_URL || 'http://products-api:8082';
const ORDERS_API_URL = process.env.ORDERS_API_URL || 'http://orders-api:8083';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://shop.local'];

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: ALLOWED_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: true,
  maxAge: 86400
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    status: 429,
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Health check endpoints
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

app.get('/health/ready', (req, res) => {
  res.status(200).json({ status: 'ready' });
});

// Proxy to Auth Service
app.use('/auth', createProxyMiddleware({
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error('Auth Service Proxy Error:', err.message);
    res.status(503).json({
      error: 'Auth service unavailable',
      service: 'auth-service'
    });
  }
}));

// Proxy to Products API
app.use('/products', createProxyMiddleware({
  target: PRODUCTS_API_URL,
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error('Products API Proxy Error:', err.message);
    res.status(503).json({
      error: 'Products service unavailable',
      service: 'products-api'
    });
  }
}));

// Proxy to Orders API
app.use('/orders', createProxyMiddleware({
  target: ORDERS_API_URL,
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error('Orders API Proxy Error:', err.message);
    res.status(503).json({
      error: 'Orders service unavailable',
      service: 'orders-api'
    });
  }
}));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    status: 404,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    status: err.status || 500,
    error: err.message || 'Internal Server Error'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('Proxying to:');
  console.log(`  - Auth Service: ${AUTH_SERVICE_URL}`);
  console.log(`  - Products API: ${PRODUCTS_API_URL}`);
  console.log(`  - Orders API: ${ORDERS_API_URL}`);
});
