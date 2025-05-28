const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// Get sales analytics
router.get('/sales', verifyToken, checkRole(['admin', 'analyst']), async (req, res) => {
  try {
    const { start_date, end_date, group_by = 'day' } = req.query;

    let groupByClause;
    switch (group_by) {
      case 'hour':
        groupByClause = "date_trunc('hour', created_at)";
        break;
      case 'day':
        groupByClause = "date_trunc('day', created_at)";
        break;
      case 'week':
        groupByClause = "date_trunc('week', created_at)";
        break;
      case 'month':
        groupByClause = "date_trunc('month', created_at)";
        break;
      default:
        groupByClause = "date_trunc('day', created_at)";
    }

    const result = await query(
      `SELECT 
         ${groupByClause} as period,
         COUNT(*) as total_orders,
         SUM(total_amount) as total_revenue,
         AVG(total_amount) as average_order_value
       FROM orders
       WHERE status = 'completed'
         AND created_at >= $1
         AND created_at <= $2
       GROUP BY period
       ORDER BY period DESC`,
      [start_date, end_date]
    );

    res.json({
      analytics: result.rows,
      period: group_by,
      start_date,
      end_date
    });
  } catch (error) {
    console.error('Get sales analytics error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get inventory analytics
router.get('/inventory', verifyToken, checkRole(['admin', 'analyst']), async (req, res) => {
  try {
    const result = await query(
      `SELECT 
         p.category_id,
         c.name as category_name,
         COUNT(*) as total_products,
         SUM(p.stock_quantity) as total_stock,
         AVG(p.stock_quantity) as average_stock,
         MIN(p.stock_quantity) as min_stock,
         MAX(p.stock_quantity) as max_stock
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_active = true
       GROUP BY p.category_id, c.name
       ORDER BY total_stock DESC`
    );

    res.json({
      analytics: result.rows
    });
  } catch (error) {
    console.error('Get inventory analytics error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get customer analytics
router.get('/customers', verifyToken, checkRole(['admin', 'analyst']), async (req, res) => {
  try {
    const result = await query(
      `SELECT 
         COUNT(DISTINCT o.customer_id) as total_customers,
         COUNT(DISTINCT CASE WHEN o.created_at >= NOW() - INTERVAL '30 days' THEN o.customer_id END) as active_customers,
         AVG(o.total_amount) as average_order_value,
         MAX(o.total_amount) as highest_order_value,
         COUNT(*) as total_orders
       FROM orders o
       WHERE o.status = 'completed'`
    );

    const customerSegments = await query(
      `SELECT 
         CASE 
           WHEN COUNT(*) = 1 THEN 'One-time'
           WHEN COUNT(*) BETWEEN 2 AND 5 THEN 'Regular'
           ELSE 'Loyal'
         END as segment,
         COUNT(*) as customer_count
       FROM (
         SELECT customer_id, COUNT(*) as order_count
         FROM orders
         WHERE status = 'completed'
         GROUP BY customer_id
       ) as customer_orders
       GROUP BY segment
       ORDER BY customer_count DESC`
    );

    res.json({
      overview: result.rows[0],
      segments: customerSegments.rows
    });
  } catch (error) {
    console.error('Get customer analytics error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get product performance
router.get('/products/performance', verifyToken, checkRole(['admin', 'analyst']), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const result = await query(
      `SELECT 
         p.id,
         p.name,
         p.category_id,
         c.name as category_name,
         COUNT(oi.id) as total_orders,
         SUM(oi.quantity) as total_quantity,
         SUM(oi.quantity * oi.price) as total_revenue,
         AVG(oi.price) as average_price
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN order_items oi ON p.id = oi.product_id
       LEFT JOIN orders o ON oi.order_id = o.id
       WHERE o.status = 'completed'
         AND o.created_at >= $1
         AND o.created_at <= $2
       GROUP BY p.id, p.name, p.category_id, c.name
       ORDER BY total_revenue DESC`,
      [start_date, end_date]
    );

    res.json({
      products: result.rows,
      period: {
        start_date,
        end_date
      }
    });
  } catch (error) {
    console.error('Get product performance error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get communication analytics
router.get('/communications', verifyToken, checkRole(['admin', 'analyst']), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const result = await query(
      `SELECT 
         channel,
         direction,
         COUNT(*) as total_messages,
         COUNT(CASE WHEN is_ai_handled THEN 1 END) as ai_handled,
         AVG(CASE WHEN response_time IS NOT NULL THEN response_time END) as avg_response_time
       FROM messages
       WHERE created_at >= $1
         AND created_at <= $2
       GROUP BY channel, direction
       ORDER BY total_messages DESC`,
      [start_date, end_date]
    );

    res.json({
      analytics: result.rows,
      period: {
        start_date,
        end_date
      }
    });
  } catch (error) {
    console.error('Get communication analytics error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

module.exports = router; 