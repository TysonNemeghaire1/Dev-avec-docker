const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const { Pool } = require('pg');

// Configuration
const PORT = process.env.PORT || 8081;
const JWT_SECRET = process.env.JWT_SECRET || 'cloudshop-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 10;

// PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Database initialization
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      first_name VARCHAR(255) DEFAULT '',
      last_name VARCHAR(255) DEFAULT '',
      role VARCHAR(50) DEFAULT 'user',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token TEXT PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('Database tables initialized');
}

// Utility functions
function generateTokens(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });

  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
}

async function findUserByEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, email, password, first_name AS "firstName", last_name AS "lastName",
            role, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

async function findUserById(id) {
  const { rows } = await pool.query(
    `SELECT id, email, password, first_name AS "firstName", last_name AS "lastName",
            role, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

function sanitizeUser(user) {
  const { password, ...sanitized } = user;
  return sanitized;
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Access token required',
      code: 'TOKEN_MISSING'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      return res.status(403).json({
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
    }
    req.user = decoded;
    next();
  });
}

// Express app
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoints
app.get('/auth/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/auth/health/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

app.get('/auth/health/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// Register
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'MISSING_FIELDS'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters',
        code: 'PASSWORD_TOO_SHORT'
      });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({
        error: 'Email already exists',
        code: 'EMAIL_EXISTS'
      });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const { rows } = await pool.query(
      `INSERT INTO users (email, password, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, first_name AS "firstName", last_name AS "lastName",
                 role, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [email, hashedPassword, firstName || '', lastName || '']
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: rows[0]
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'MISSING_FIELDS'
      });
    }

    const user = await findUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    await pool.query(
      'INSERT INTO refresh_tokens (token, user_id) VALUES ($1, $2)',
      [refreshToken, user.id]
    );

    res.status(200).json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Refresh token
app.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required',
        code: 'TOKEN_MISSING'
      });
    }

    const { rows: tokenRows } = await pool.query(
      'SELECT token FROM refresh_tokens WHERE token = $1',
      [refreshToken]
    );

    if (tokenRows.length === 0) {
      return res.status(403).json({
        error: 'Invalid refresh token',
        code: 'TOKEN_INVALID'
      });
    }

    jwt.verify(refreshToken, JWT_SECRET, async (err, decoded) => {
      try {
        if (err) {
          await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
          return res.status(403).json({
            error: 'Invalid or expired refresh token',
            code: 'TOKEN_INVALID'
          });
        }

        const user = await findUserById(decoded.id);

        if (!user) {
          await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
          return res.status(403).json({
            error: 'User not found',
            code: 'USER_NOT_FOUND'
          });
        }

        // Remove old token and generate new ones
        await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
        const tokens = generateTokens(user);
        await pool.query(
          'INSERT INTO refresh_tokens (token, user_id) VALUES ($1, $2)',
          [tokens.refreshToken, user.id]
        );

        res.status(200).json({
          message: 'Token refreshed successfully',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken
        });
      } catch (innerErr) {
        console.error('Refresh inner error:', innerErr);
        res.status(500).json({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Get current user (protected)
app.get('/auth/me', authenticateToken, async (req, res) => {
  const user = await findUserById(req.user.id);

  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      code: 'USER_NOT_FOUND'
    });
  }

  res.status(200).json({
    user: sanitizeUser(user)
  });
});

// Logout (invalidate refresh token)
app.post('/auth/logout', async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
  }

  res.status(200).json({
    message: 'Logged out successfully'
  });
});

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
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Auth Service running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
