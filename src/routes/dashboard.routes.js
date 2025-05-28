const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// Get dashboard overview
router.get('/overview', verifyToken, async (req, res) => {
  try {
    // Get total orders
    const ordersResult = await query('SELECT COUNT(*) FROM orders');
    const totalOrders = parseInt(ordersResult.rows[0].count);

    // Get total revenue
    const revenueResult = await query(
      'SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status = $1',
      ['completed']
    );
    const totalRevenue = parseFloat(revenueResult.rows[0].total);

    // Get total customers
    const customersResult = await query('SELECT COUNT(*) FROM users WHERE role = $1', ['customer']);
    const totalCustomers = parseInt(customersResult.rows[0].count);

    // Get low stock products
    const lowStockResult = await query(
      'SELECT COUNT(*) FROM products WHERE stock_quantity <= min_stock_level'
    );
    const lowStockProducts = parseInt(lowStockResult.rows[0].count);

    res.json({
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      total_customers: totalCustomers,
      low_stock_products: lowStockProducts
    });
  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get recent activity
router.get('/recent-activity', verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        'order' as type,
        o.id,
        o.created_at,
        o.status,
        o.total_amount,
        u.email as user_email
       FROM orders o
       JOIN users u ON o.customer_id = u.id
       UNION ALL
       SELECT 
        'product' as type,
        p.id,
        p.created_at,
        p.status,
        p.price as total_amount,
        u.email as user_email
       FROM products p
       JOIN users u ON p.created_by = u.id
       ORDER BY created_at DESC
       LIMIT 10`
    );

    res.json({
      activities: result.rows
    });
  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

module.exports = router; 