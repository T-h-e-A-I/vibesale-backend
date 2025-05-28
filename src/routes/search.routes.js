const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth.middleware');

// Search products
router.get('/products', verifyToken, async (req, res) => {
  try {
    const { 
      query: searchQuery, 
      category_id,
      min_price,
      max_price,
      in_stock,
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;
    const conditions = ['p.is_active = true'];
    const params = [];
    let paramIndex = 1;

    if (searchQuery) {
      conditions.push(`(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
      params.push(`%${searchQuery}%`);
      paramIndex++;
    }

    if (category_id) {
      conditions.push(`p.category_id = $${paramIndex}`);
      params.push(category_id);
      paramIndex++;
    }

    if (min_price) {
      conditions.push(`p.price >= $${paramIndex}`);
      params.push(min_price);
      paramIndex++;
    }

    if (max_price) {
      conditions.push(`p.price <= $${paramIndex}`);
      params.push(max_price);
      paramIndex++;
    }

    if (in_stock === 'true') {
      conditions.push('p.stock_quantity > 0');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT 
         p.*,
         c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const totalResult = await query(
      `SELECT COUNT(*)
       FROM products p
       ${whereClause}`,
      params
    );

    const total = parseInt(totalResult.rows[0].count);

    res.json({
      products: result.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Search customers
router.get('/customers', verifyToken, async (req, res) => {
  try {
    const { 
      query: searchQuery,
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;
    const conditions = ['u.is_active = true'];
    const params = [];
    let paramIndex = 1;

    if (searchQuery) {
      conditions.push(
        `(u.email ILIKE $${paramIndex} OR 
          u.first_name ILIKE $${paramIndex} OR 
          u.last_name ILIKE $${paramIndex} OR
          u.phone ILIKE $${paramIndex})`
      );
      params.push(`%${searchQuery}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT 
         u.id,
         u.email,
         u.first_name,
         u.last_name,
         u.phone,
         u.role,
         COUNT(DISTINCT o.id) as total_orders,
         SUM(o.total_amount) as total_spent
       FROM users u
       LEFT JOIN orders o ON u.id = o.customer_id AND o.status = 'completed'
       ${whereClause}
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const totalResult = await query(
      `SELECT COUNT(DISTINCT u.id)
       FROM users u
       ${whereClause}`,
      params
    );

    const total = parseInt(totalResult.rows[0].count);

    res.json({
      customers: result.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Search customers error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Search orders
router.get('/orders', verifyToken, async (req, res) => {
  try {
    const { 
      query: searchQuery,
      status,
      start_date,
      end_date,
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (searchQuery) {
      conditions.push(
        `(o.order_number ILIKE $${paramIndex} OR 
          u.email ILIKE $${paramIndex} OR 
          u.first_name ILIKE $${paramIndex} OR 
          u.last_name ILIKE $${paramIndex})`
      );
      params.push(`%${searchQuery}%`);
      paramIndex++;
    }

    if (status) {
      conditions.push(`o.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (start_date) {
      conditions.push(`o.created_at >= $${paramIndex}`);
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      conditions.push(`o.created_at <= $${paramIndex}`);
      params.push(end_date);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT 
         o.*,
         u.email as customer_email,
         u.first_name as customer_first_name,
         u.last_name as customer_last_name
       FROM orders o
       LEFT JOIN users u ON o.customer_id = u.id
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const totalResult = await query(
      `SELECT COUNT(*)
       FROM orders o
       LEFT JOIN users u ON o.customer_id = u.id
       ${whereClause}`,
      params
    );

    const total = parseInt(totalResult.rows[0].count);

    res.json({
      orders: result.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Search orders error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

module.exports = router; 