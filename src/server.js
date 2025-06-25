const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const promClient = require('prom-client');

// Initialize Prometheus metrics
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

// Create custom metrics
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestsInProgress = new promClient.Gauge({
  name: 'http_requests_in_progress',
  help: 'Number of HTTP requests in progress',
  labelNames: ['method', 'route']
});

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

// Prometheus metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  const route = req.route ? req.route.path : req.path;
  
  httpRequestsInProgress.inc({ method: req.method, route });
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    httpRequestDurationMicroseconds
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration / 1000);
    
    httpRequestsTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
    
    httpRequestsInProgress.dec({ method: req.method, route });
  });
  
  next();
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// Ping route for health check and version
app.get('/ping', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0' });
});

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

const PORT = process.env.PORT ||  8080;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
});
