const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// List orders
router.get('/', verifyToken, async (req, res) => {
  try {
    const { 
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
    console.error('List orders error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Create order
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      customer_id,
      items,
      shipping_address,
      billing_address,
      payment_method,
      notes
    } = req.body;

    // Start a transaction
    await query('BEGIN');

    try {
      // Create the order
      const orderResult = await query(
        `INSERT INTO orders (
          customer_id, shipping_address, billing_address,
          payment_method, notes, status
        ) VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING *`,
        [
          customer_id,
          shipping_address,
          billing_address,
          payment_method,
          notes,
          'pending'
        ]
      );

      const order = orderResult.rows[0];
      let totalAmount = 0;

      // Add order items
      for (const item of items) {
        const productResult = await query(
          'SELECT * FROM products WHERE id = $1 AND is_active = true',
          [item.product_id]
        );

        if (productResult.rows.length === 0) {
          throw new Error(`Product not found: ${item.product_id}`);
        }

        const product = productResult.rows[0];
        const itemTotal = product.price * item.quantity;
        totalAmount += itemTotal;

        await query(
          `INSERT INTO order_items (
            order_id, product_id, quantity, price
          ) VALUES ($1, $2, $3, $4)`,
          [
            order.id,
            item.product_id,
            item.quantity,
            product.price
          ]
        );

        // Update product stock
        await query(
          `UPDATE products 
           SET stock_quantity = stock_quantity - $1
           WHERE id = $2`,
          [item.quantity, item.product_id]
        );
      }

      // Update order total
      await query(
        'UPDATE orders SET total_amount = $1 WHERE id = $2',
        [totalAmount, order.id]
      );

      await query('COMMIT');

      // Get the complete order with items
      const completeOrder = await query(
        `SELECT 
           o.*,
           u.email as customer_email,
           u.first_name as customer_first_name,
           u.last_name as customer_last_name,
           json_agg(
             json_build_object(
               'id', oi.id,
               'product_id', oi.product_id,
               'quantity', oi.quantity,
               'price', oi.price,
               'product_name', p.name
             )
           ) as items
         FROM orders o
         LEFT JOIN users u ON o.customer_id = u.id
         LEFT JOIN order_items oi ON o.id = oi.order_id
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE o.id = $1
         GROUP BY o.id, u.email, u.first_name, u.last_name`,
        [order.id]
      );

      res.status(201).json(completeOrder.rows[0]);
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get order details
router.get('/:orderId', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    const result = await query(
      `SELECT 
         o.*,
         u.email as customer_email,
         u.first_name as customer_first_name,
         u.last_name as customer_last_name,
         json_agg(
           json_build_object(
             'id', oi.id,
             'product_id', oi.product_id,
             'quantity', oi.quantity,
             'price', oi.price,
             'product_name', p.name
           )
         ) as items
       FROM orders o
       LEFT JOIN users u ON o.customer_id = u.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.id = $1
       GROUP BY o.id, u.email, u.first_name, u.last_name`,
      [orderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Order not found'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Update order status
router.put('/:orderId/status', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const result = await query(
      `UPDATE orders 
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, orderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Order not found'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Cancel order
router.post('/:orderId/cancel', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    // Start a transaction
    await query('BEGIN');

    try {
      // Get order items
      const itemsResult = await query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [orderId]
      );

      // Restore product stock
      for (const item of itemsResult.rows) {
        await query(
          `UPDATE products 
           SET stock_quantity = stock_quantity + $1
           WHERE id = $2`,
          [item.quantity, item.product_id]
        );
      }

      // Update order status
      const result = await query(
        `UPDATE orders 
         SET status = 'cancelled',
             cancellation_reason = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [reason, orderId]
      );

      if (result.rows.length === 0) {
        throw new Error('Order not found');
      }

      await query('COMMIT');
      res.json(result.rows[0]);
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

module.exports = router; 