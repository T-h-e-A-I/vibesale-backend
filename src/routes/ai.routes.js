const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// List AI agents
router.get('/agents', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(
      'SELECT * FROM ai_agents ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    const totalResult = await query('SELECT COUNT(*) FROM ai_agents');
    const total = parseInt(totalResult.rows[0].count);

    res.json({
      agents: result.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('List AI agents error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Create AI agent
router.post('/agents', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const {
      name,
      description,
      model,
      capabilities,
      settings,
      is_active
    } = req.body;

    const result = await query(
      `INSERT INTO ai_agents (
        name, description, model, capabilities, 
        settings, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *`,
      [
        name,
        description,
        model,
        capabilities,
        settings,
        is_active || true
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create AI agent error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get AI agent details
router.get('/agents/:agentId', verifyToken, async (req, res) => {
  try {
    const { agentId } = req.params;

    const result = await query(
      'SELECT * FROM ai_agents WHERE id = $1',
      [agentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'AI agent not found'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get AI agent error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Update AI agent
router.put('/agents/:agentId', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { agentId } = req.params;
    const {
      name,
      description,
      model,
      capabilities,
      settings,
      is_active
    } = req.body;

    const result = await query(
      `UPDATE ai_agents 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           model = COALESCE($3, model),
           capabilities = COALESCE($4, capabilities),
           settings = COALESCE($5, settings),
           is_active = COALESCE($6, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [
        name,
        description,
        model,
        capabilities,
        settings,
        is_active,
        agentId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'AI agent not found'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update AI agent error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Delete AI agent
router.delete('/agents/:agentId', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { agentId } = req.params;

    const result = await query(
      'DELETE FROM ai_agents WHERE id = $1 RETURNING *',
      [agentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'AI agent not found'
      });
    }

    res.json({
      code: 'SUCCESS',
      message: 'AI agent deleted successfully'
    });
  } catch (error) {
    console.error('Delete AI agent error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Process message with AI
router.post('/process', verifyToken, async (req, res) => {
  try {
    const { message, context, agent_id } = req.body;

    // In a real application, you would integrate with an AI service
    const response = {
      message: 'AI response placeholder',
      confidence: 0.95,
      metadata: {
        processing_time: 0.5,
        model_used: 'gpt-4'
      }
    };

    // Record the interaction
    await query(
      `INSERT INTO ai_interactions (
        agent_id, user_id, input_message, 
        response, confidence_score, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        agent_id,
        req.user.id,
        message,
        response.message,
        response.confidence,
        response.metadata
      ]
    );

    res.json({
      code: 'SUCCESS',
      message: 'Message processed successfully',
      data: response
    });
  } catch (error) {
    console.error('Process message error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get AI interaction history
router.get('/interactions', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT ai.*, a.name as agent_name 
       FROM ai_interactions ai
       LEFT JOIN ai_agents a ON ai.agent_id = a.id
       WHERE ai.user_id = $1
       ORDER BY ai.created_at DESC 
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    const totalResult = await query(
      'SELECT COUNT(*) FROM ai_interactions WHERE user_id = $1',
      [req.user.id]
    );
    const total = parseInt(totalResult.rows[0].count);

    res.json({
      interactions: result.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get AI interactions error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

module.exports = router; 