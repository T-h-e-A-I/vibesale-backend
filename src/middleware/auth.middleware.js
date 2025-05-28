const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'No token provided'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user exists and is active
    const result = await query(
      'SELECT * FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'User not found or inactive'
      });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Invalid token'
    });
  }
};

const checkRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions'
      });
    }
    next();
  };
};

module.exports = {
  verifyToken,
  checkRole
}; 