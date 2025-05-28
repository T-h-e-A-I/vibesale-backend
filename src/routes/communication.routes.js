const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// Initiate call
router.post('/calls', verifyToken, async (req, res) => {
  try {
    const { to_number, from_number, webhook_url } = req.body;

    // In a real application, you would integrate with a telephony service
    const callId = 'call_' + Date.now();
    
    res.json({
      call_id: callId,
      status: 'initiated',
      duration: 0
    });
  } catch (error) {
    console.error('Initiate call error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// List calls
router.get('/calls', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(
      'SELECT * FROM messages WHERE channel = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      ['call', limit, offset]
    );

    const totalResult = await query('SELECT COUNT(*) FROM messages WHERE channel = $1', ['call']);
    const total = parseInt(totalResult.rows[0].count);

    res.json({
      calls: result.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('List calls error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get call details
router.get('/calls/:callId', verifyToken, async (req, res) => {
  try {
    const { callId } = req.params;

    const result = await query(
      'SELECT * FROM messages WHERE id = $1 AND channel = $2',
      [callId, 'call']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Call not found'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get call error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Send SMS
router.post('/sms', verifyToken, async (req, res) => {
  try {
    const { to_number, from_number, message } = req.body;

    // In a real application, you would integrate with an SMS service
    const messageId = 'sms_' + Date.now();

    const result = await query(
      `INSERT INTO messages (
        customer_id, channel, direction, content, 
        is_ai_handled, status, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *`,
      [
        req.user.id,
        'sms',
        'outbound',
        message,
        false,
        'new',
        'medium'
      ]
    );

    res.json({
      code: 'SUCCESS',
      message: 'SMS sent successfully',
      data: {
        message_id: result.rows[0].id,
        status: 'sent'
      }
    });
  } catch (error) {
    console.error('Send SMS error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// List SMS messages
router.get('/sms', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(
      'SELECT * FROM messages WHERE channel = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      ['sms', limit, offset]
    );

    const totalResult = await query('SELECT COUNT(*) FROM messages WHERE channel = $1', ['sms']);
    const total = parseInt(totalResult.rows[0].count);

    res.json({
      messages: result.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('List SMS error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Send email
router.post('/email', verifyToken, async (req, res) => {
  try {
    const { to, cc, subject, body, html, attachments } = req.body;

    // In a real application, you would integrate with an email service
    const messageId = 'email_' + Date.now();

    const result = await query(
      `INSERT INTO messages (
        customer_id, channel, direction, content, 
        is_ai_handled, status, priority, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *`,
      [
        req.user.id,
        'email',
        'outbound',
        body,
        false,
        'new',
        'medium',
        { subject, to, cc, attachments }
      ]
    );

    res.json({
      code: 'SUCCESS',
      message: 'Email sent successfully',
      data: {
        message_id: result.rows[0].id,
        status: 'sent'
      }
    });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// List emails
router.get('/email', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(
      'SELECT * FROM messages WHERE channel = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      ['email', limit, offset]
    );

    const totalResult = await query('SELECT COUNT(*) FROM messages WHERE channel = $1', ['email']);
    const total = parseInt(totalResult.rows[0].count);

    res.json({
      emails: result.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('List emails error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Send social media message
router.post('/socials/message', verifyToken, async (req, res) => {
  try {
    const { to, message, social_media_platform } = req.body;

    // In a real application, you would integrate with social media APIs
    const messageId = 'social_' + Date.now();

    const result = await query(
      `INSERT INTO messages (
        customer_id, channel, direction, content, 
        is_ai_handled, status, priority, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *`,
      [
        req.user.id,
        social_media_platform,
        'outbound',
        message,
        false,
        'new',
        'medium',
        { platform: social_media_platform }
      ]
    );

    res.json({
      code: 'SUCCESS',
      message: 'Message sent successfully',
      data: {
        message_id: result.rows[0].id,
        status: 'sent'
      }
    });
  } catch (error) {
    console.error('Send social media message error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// List social media messages
router.get('/socials/message', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT * FROM messages 
       WHERE channel IN ('facebook', 'instagram', 'twitter', 'linkedin')
       ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const totalResult = await query(
      `SELECT COUNT(*) FROM messages 
       WHERE channel IN ('facebook', 'instagram', 'twitter', 'linkedin')`
    );
    const total = parseInt(totalResult.rows[0].count);

    res.json({
      messages: result.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('List social media messages error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

module.exports = router; 