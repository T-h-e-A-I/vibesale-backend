const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// List products
router.get('/products', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT p.*, c.name as category_name 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.is_active = true 
       ORDER BY p.created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const totalResult = await query('SELECT COUNT(*) FROM products WHERE is_active = true');
    const total = parseInt(totalResult.rows[0].count);

    res.json({
      products: result.rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('List products error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Create product
router.post('/products', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      sku,
      category_id,
      stock_quantity,
      min_stock_level,
      weight,
      dimensions,
      images,
      tags
    } = req.body;

    const result = await query(
      `INSERT INTO products (
        name, description, price, sku, category_id, 
        stock_quantity, min_stock_level, weight, 
        dimensions, images, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
      RETURNING *`,
      [
        name,
        description,
        price,
        sku,
        category_id,
        stock_quantity || 0,
        min_stock_level || 0,
        weight,
        dimensions,
        images,
        tags
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get product details
router.get('/products/:productId', verifyToken, async (req, res) => {
  try {
    const { productId } = req.params;

    const result = await query(
      `SELECT p.*, c.name as category_name 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.id = $1`,
      [productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Product not found'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Update product
router.put('/products/:productId', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { productId } = req.params;
    const {
      name,
      description,
      price,
      category_id,
      stock_quantity,
      min_stock_level,
      weight,
      dimensions,
      images,
      tags,
      is_active
    } = req.body;

    const result = await query(
      `UPDATE products 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           category_id = COALESCE($4, category_id),
           stock_quantity = COALESCE($5, stock_quantity),
           min_stock_level = COALESCE($6, min_stock_level),
           weight = COALESCE($7, weight),
           dimensions = COALESCE($8, dimensions),
           images = COALESCE($9, images),
           tags = COALESCE($10, tags),
           is_active = COALESCE($11, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $12
       RETURNING *`,
      [
        name,
        description,
        price,
        category_id,
        stock_quantity,
        min_stock_level,
        weight,
        dimensions,
        images,
        tags,
        is_active,
        productId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Product not found'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get stock level
router.get('/stock/:productId', verifyToken, async (req, res) => {
  try {
    const { productId } = req.params;

    const result = await query(
      `SELECT 
         p.id as product_id,
         p.stock_quantity as quantity,
         COALESCE(SUM(oi.quantity), 0) as reserved,
         p.stock_quantity - COALESCE(SUM(oi.quantity), 0) as available
       FROM products p
       LEFT JOIN order_items oi ON p.id = oi.product_id
       LEFT JOIN orders o ON oi.order_id = o.id
       WHERE p.id = $1 AND (o.status IS NULL OR o.status IN ('pending', 'processing'))
       GROUP BY p.id, p.stock_quantity`,
      [productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Product not found'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get stock level error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

// Update stock level
router.put('/stock/:productId', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity, operation = 'set' } = req.body;

    let updateQuery;
    switch (operation) {
      case 'increment':
        updateQuery = 'stock_quantity = stock_quantity + $1';
        break;
      case 'decrement':
        updateQuery = 'stock_quantity = GREATEST(0, stock_quantity - $1)';
        break;
      default:
        updateQuery = 'stock_quantity = $1';
    }

    const result = await query(
      `UPDATE products 
       SET ${updateQuery},
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [quantity, productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Product not found'
      });
    }

    // Record inventory movement
    await query(
      `INSERT INTO inventory_movements 
       (product_id, movement_type, quantity, reference_type, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        productId,
        operation === 'increment' ? 'stock_in' : 'stock_out',
        quantity,
        'manual_adjustment',
        req.user.id
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update stock level error:', error);
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

module.exports = router; 