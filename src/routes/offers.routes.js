const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// List offers
router.get('/', verifyToken, async (req, res) => {
  try {
    const { 
      status,
      type,
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`o.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (type) {
      conditions.push(`o.type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT 
         o.*,
         COUNT(DISTINCT uo.user_id) as total_uses
       FROM offers o
       LEFT JOIN user_offers uo ON o.id = uo.offer_id
       ${whereClause}
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const totalResult = await query(
      `SELECT COUNT(*)
       FROM offers o
       ${whereClause}`,
      params
    );

    const total = parseInt(totalResult.rows[0].count);

    res.json({
      offers: result.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('List offers error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Create offer
router.post('/', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const {
      code,
      type,
      value,
      min_purchase,
      max_discount,
      start_date,
      end_date,
      usage_limit,
      is_active
    } = req.body;

    const result = await query(
      `INSERT INTO offers (
        code, type, value, min_purchase, max_discount,
        start_date, end_date, usage_limit, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING *`,
      [
        code,
        type,
        value,
        min_purchase,
        max_discount,
        start_date,
        end_date,
        usage_limit,
        is_active || true
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create offer error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get offer details
router.get('/:offerId', verifyToken, async (req, res) => {
  try {
    const { offerId } = req.params;

    const result = await query(
      `SELECT 
         o.*,
         COUNT(DISTINCT uo.user_id) as total_uses
       FROM offers o
       LEFT JOIN user_offers uo ON o.id = uo.offer_id
       WHERE o.id = $1
       GROUP BY o.id`,
      [offerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Offer not found'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get offer error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Update offer
router.put('/:offerId', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { offerId } = req.params;
    const {
      code,
      type,
      value,
      min_purchase,
      max_discount,
      start_date,
      end_date,
      usage_limit,
      is_active
    } = req.body;

    const result = await query(
      `UPDATE offers 
       SET code = COALESCE($1, code),
           type = COALESCE($2, type),
           value = COALESCE($3, value),
           min_purchase = COALESCE($4, min_purchase),
           max_discount = COALESCE($5, max_discount),
           start_date = COALESCE($6, start_date),
           end_date = COALESCE($7, end_date),
           usage_limit = COALESCE($8, usage_limit),
           is_active = COALESCE($9, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [
        code,
        type,
        value,
        min_purchase,
        max_discount,
        start_date,
        end_date,
        usage_limit,
        is_active,
        offerId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Offer not found'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update offer error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Delete offer
router.delete('/:offerId', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { offerId } = req.params;

    const result = await query(
      'DELETE FROM offers WHERE id = $1 RETURNING *',
      [offerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Offer not found'
      });
    }

    res.json({
      code: 'SUCCESS',
      message: 'Offer deleted successfully'
    });
  } catch (error) {
    console.error('Delete offer error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Validate offer
router.post('/validate', verifyToken, async (req, res) => {
  try {
    const { code, amount } = req.body;

    const result = await query(
      `SELECT 
         o.*,
         COUNT(DISTINCT uo.user_id) as total_uses
       FROM offers o
       LEFT JOIN user_offers uo ON o.id = uo.offer_id
       WHERE o.code = $1
         AND o.is_active = true
         AND o.start_date <= CURRENT_TIMESTAMP
         AND o.end_date >= CURRENT_TIMESTAMP
       GROUP BY o.id`,
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Invalid or expired offer code'
      });
    }

    const offer = result.rows[0];

    // Check usage limit
    if (offer.usage_limit && offer.total_uses >= offer.usage_limit) {
      return res.status(400).json({
        code: 'OFFER_LIMIT_REACHED',
        message: 'Offer usage limit reached'
      });
    }

    // Check minimum purchase
    if (offer.min_purchase && amount < offer.min_purchase) {
      return res.status(400).json({
        code: 'MIN_PURCHASE_REQUIRED',
        message: `Minimum purchase amount of ${offer.min_purchase} required`
      });
    }

    // Calculate discount
    let discount = 0;
    if (offer.type === 'percentage') {
      discount = (amount * offer.value) / 100;
      if (offer.max_discount) {
        discount = Math.min(discount, offer.max_discount);
      }
    } else {
      discount = offer.value;
    }

    res.json({
      offer: {
        id: offer.id,
        code: offer.code,
        type: offer.type,
        value: offer.value,
        discount,
        final_amount: amount - discount
      }
    });
  } catch (error) {
    console.error('Validate offer error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get user offers
router.get('/user/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await query(
      `SELECT 
         o.*,
         uo.used_at
       FROM offers o
       JOIN user_offers uo ON o.id = uo.offer_id
       WHERE uo.user_id = $1
       ORDER BY uo.used_at DESC`,
      [userId]
    );

    res.json({
      offers: result.rows
    });
  } catch (error) {
    console.error('Get user offers error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

module.exports = router; 