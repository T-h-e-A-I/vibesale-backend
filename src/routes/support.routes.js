const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// List support tickets
router.get('/tickets', verifyToken, async (req, res) => {
  try {
    const { 
      status,
      priority,
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Regular users can only see their own tickets
    if (!req.user.roles.includes('admin') && !req.user.roles.includes('support')) {
      conditions.push(`t.user_id = $${paramIndex}`);
      params.push(req.user.id);
      paramIndex++;
    }

    if (status) {
      conditions.push(`t.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (priority) {
      conditions.push(`t.priority = $${paramIndex}`);
      params.push(priority);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT 
         t.*,
         u.email as user_email,
         u.name as user_name,
         COUNT(m.id) as message_count
       FROM support_tickets t
       JOIN users u ON t.user_id = u.id
       LEFT JOIN support_messages m ON t.id = m.ticket_id
       ${whereClause}
       GROUP BY t.id, u.email, u.name
       ORDER BY 
         CASE t.priority
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low' THEN 3
         END,
         t.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const totalResult = await query(
      `SELECT COUNT(*)
       FROM support_tickets t
       ${whereClause}`,
      params
    );

    const total = parseInt(totalResult.rows[0].count);

    res.json({
      tickets: result.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('List tickets error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Create support ticket
router.post('/tickets', verifyToken, async (req, res) => {
  try {
    const {
      subject,
      description,
      priority = 'medium',
      category
    } = req.body;

    const result = await query(
      `INSERT INTO support_tickets (
        user_id, subject, description, priority, category, status
      ) VALUES ($1, $2, $3, $4, $5, 'open') 
      RETURNING *`,
      [req.user.id, subject, description, priority, category]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get ticket details
router.get('/tickets/:ticketId', verifyToken, async (req, res) => {
  try {
    const { ticketId } = req.params;

    const result = await query(
      `SELECT 
         t.*,
         u.email as user_email,
         u.name as user_name
       FROM support_tickets t
       JOIN users u ON t.user_id = u.id
       WHERE t.id = $1`,
      [ticketId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Ticket not found'
      });
    }

    const ticket = result.rows[0];

    // Check if user has permission to view this ticket
    if (!req.user.roles.includes('admin') && 
        !req.user.roles.includes('support') && 
        ticket.user_id !== req.user.id) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have permission to view this ticket'
      });
    }

    // Get ticket messages
    const messagesResult = await query(
      `SELECT 
         m.*,
         u.name as sender_name,
         u.email as sender_email
       FROM support_messages m
       JOIN users u ON m.user_id = u.id
       WHERE m.ticket_id = $1
       ORDER BY m.created_at ASC`,
      [ticketId]
    );

    res.json({
      ...ticket,
      messages: messagesResult.rows
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Update ticket status
router.put('/tickets/:ticketId/status', verifyToken, checkRole(['admin', 'support']), async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status } = req.body;

    const result = await query(
      `UPDATE support_tickets 
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, ticketId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Ticket not found'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update ticket status error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Add message to ticket
router.post('/tickets/:ticketId/messages', verifyToken, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;

    // Check if ticket exists and user has permission
    const ticketResult = await query(
      'SELECT * FROM support_tickets WHERE id = $1',
      [ticketId]
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Ticket not found'
      });
    }

    const ticket = ticketResult.rows[0];
    if (!req.user.roles.includes('admin') && 
        !req.user.roles.includes('support') && 
        ticket.user_id !== req.user.id) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have permission to add messages to this ticket'
      });
    }

    // Add message
    const result = await query(
      `INSERT INTO support_messages (
        ticket_id, user_id, message
      ) VALUES ($1, $2, $3) 
      RETURNING *`,
      [ticketId, req.user.id, message]
    );

    // Update ticket status if it was closed
    if (ticket.status === 'closed') {
      await query(
        `UPDATE support_tickets 
         SET status = 'open',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [ticketId]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get FAQ categories
router.get('/faq/categories', async (req, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT category 
       FROM faqs 
       ORDER BY category`
    );

    res.json({
      categories: result.rows.map(row => row.category)
    });
  } catch (error) {
    console.error('Get FAQ categories error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get FAQs
router.get('/faq', async (req, res) => {
  try {
    const { category } = req.query;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(category);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT * FROM faqs
       ${whereClause}
       ORDER BY category, question`,
      params
    );

    res.json({
      faqs: result.rows
    });
  } catch (error) {
    console.error('Get FAQs error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Create FAQ (admin only)
router.post('/faq', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const {
      question,
      answer,
      category
    } = req.body;

    const result = await query(
      `INSERT INTO faqs (
        question, answer, category
      ) VALUES ($1, $2, $3) 
      RETURNING *`,
      [question, answer, category]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create FAQ error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Update FAQ (admin only)
router.put('/faq/:faqId', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { faqId } = req.params;
    const {
      question,
      answer,
      category
    } = req.body;

    const result = await query(
      `UPDATE faqs 
       SET question = COALESCE($1, question),
           answer = COALESCE($2, answer),
           category = COALESCE($3, category),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [question, answer, category, faqId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'FAQ not found'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update FAQ error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Delete FAQ (admin only)
router.delete('/faq/:faqId', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { faqId } = req.params;

    const result = await query(
      'DELETE FROM faqs WHERE id = $1 RETURNING *',
      [faqId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'FAQ not found'
      });
    }

    res.json({
      code: 'SUCCESS',
      message: 'FAQ deleted successfully'
    });
  } catch (error) {
    console.error('Delete FAQ error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

module.exports = router; 