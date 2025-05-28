const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth.middleware');

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials'
      });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials'
      });
    }

    const accessToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'Refresh token is required'
      });
    }

    const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
    const accessToken = jwt.sign(
      { userId: decoded.userId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      access_token: accessToken,
      expires_in: 3600
    });
  } catch (error) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Invalid refresh token'
    });
  }
});

// Logout
router.post('/logout', verifyToken, (req, res) => {
  // In a real application, you might want to blacklist the token
  res.json({ message: 'Successfully logged out' });
});

// Register client
router.post('/client', async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    const result = await query(
      'INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [email, await bcrypt.hash('defaultpassword', 10), 'viewer', name, '']
    );

    res.status(201).json({
      id: result.rows[0].id,
      name,
      email,
      phone
    });
  } catch (error) {
    console.error('Client registration error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get client details
router.get('/client/:clientId', verifyToken, async (req, res) => {
  try {
    const { clientId } = req.params;

    const result = await query(
      'SELECT * FROM users WHERE id = $1',
      [clientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Client not found'
      });
    }

    const client = result.rows[0];
    res.json({
      id: client.id,
      name: `${client.first_name} ${client.last_name}`,
      email: client.email,
      phone: client.phone
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

module.exports = router; 