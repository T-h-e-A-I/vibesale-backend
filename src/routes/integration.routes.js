const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// List integrations
router.get('/', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM integrations ORDER BY created_at DESC'
    );

    res.json({
      integrations: result.rows
    });
  } catch (error) {
    console.error('List integrations error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Create integration
router.post('/', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const {
      name,
      type,
      config,
      is_active
    } = req.body;

    const result = await query(
      `INSERT INTO integrations (
        name, type, config, is_active
      ) VALUES ($1, $2, $3, $4) 
      RETURNING *`,
      [
        name,
        type,
        config,
        is_active || true
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create integration error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get integration details
router.get('/:integrationId', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { integrationId } = req.params;

    const result = await query(
      'SELECT * FROM integrations WHERE id = $1',
      [integrationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Integration not found'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get integration error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Update integration
router.put('/:integrationId', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { integrationId } = req.params;
    const {
      name,
      type,
      config,
      is_active
    } = req.body;

    const result = await query(
      `UPDATE integrations 
       SET name = COALESCE($1, name),
           type = COALESCE($2, type),
           config = COALESCE($3, config),
           is_active = COALESCE($4, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [
        name,
        type,
        config,
        is_active,
        integrationId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Integration not found'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update integration error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Delete integration
router.delete('/:integrationId', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { integrationId } = req.params;

    const result = await query(
      'DELETE FROM integrations WHERE id = $1 RETURNING *',
      [integrationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Integration not found'
      });
    }

    res.json({
      code: 'SUCCESS',
      message: 'Integration deleted successfully'
    });
  } catch (error) {
    console.error('Delete integration error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Test integration
router.post('/:integrationId/test', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { integrationId } = req.params;

    const integration = await query(
      'SELECT * FROM integrations WHERE id = $1',
      [integrationId]
    );

    if (integration.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Integration not found'
      });
    }

    // In a real application, you would test the integration based on its type
    const testResult = {
      success: true,
      message: 'Integration test successful',
      details: {
        type: integration.rows[0].type,
        timestamp: new Date().toISOString()
      }
    };

    res.json(testResult);
  } catch (error) {
    console.error('Test integration error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get integration logs
router.get('/:integrationId/logs', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { integrationId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT * FROM integration_logs 
       WHERE integration_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [integrationId, limit, offset]
    );

    const totalResult = await query(
      'SELECT COUNT(*) FROM integration_logs WHERE integration_id = $1',
      [integrationId]
    );

    const total = parseInt(totalResult.rows[0].count);

    res.json({
      logs: result.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get integration logs error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

module.exports = router; 