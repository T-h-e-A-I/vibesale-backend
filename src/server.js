const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth.routes');
const communicationRoutes = require('./routes/communication.routes');
const aiRoutes = require('./routes/ai.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const searchRoutes = require('./routes/search.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const integrationRoutes = require('./routes/integration.routes');
const ordersRoutes = require('./routes/orders.routes');
const offersRoutes = require('./routes/offers.routes');
const supportRoutes = require('./routes/support.routes');

// Load Swagger document
const swaggerDocument = YAML.load(path.join(__dirname, '../src/swagger.yml'));

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/v1/auth', authRoutes);
app.use('/v1/communication', communicationRoutes);
app.use('/v1/ai', aiRoutes);
app.use('/v1/analytics', analyticsRoutes);
app.use('/v1/search', searchRoutes);
app.use('/v1/inventory', inventoryRoutes);
app.use('/v1/dashboard', dashboardRoutes);
app.use('/v1/integrations', integrationRoutes);
app.use('/v1/orders', ordersRoutes);
app.use('/v1/offers', offersRoutes);
app.use('/v1/support', supportRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    code: 'SERVER_ERROR',
    message: 'Internal server error',
    data: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
});
