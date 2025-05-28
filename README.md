# E-commerce Helper API

A comprehensive API for managing e-commerce operations, including inventory, orders, customer support, and AI-powered features.

## Features

- User Authentication and Authorization
- Product and Inventory Management
- Order Processing
- Customer Support System
- AI-powered Features
- Analytics and Reporting
- Integration with External Services
- Social Media Management

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ecommerce-helper
```

2. Install dependencies:
```bash
npm install
```

3. Create a PostgreSQL database and run the SQL schema:
```bash
psql -U postgres
CREATE DATABASE ecommerce_helper;
\c ecommerce_helper
\i all.sql
```

4. Create a `.env` file in the root directory with the following variables:
```env
PORT=8080
NODE_ENV=development

# Database Configuration
DB_USER=postgres
DB_HOST=localhost
DB_NAME=ecommerce_helper
DB_PASSWORD=your_password
DB_PORT=5432

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# AI Service Configuration
AI_SERVICE_API_KEY=your-ai-service-api-key
AI_SERVICE_ENDPOINT=https://api.ai-service.com/v1

# Communication Service Configuration
SMS_PROVIDER_API_KEY=your-sms-provider-api-key
EMAIL_PROVIDER_API_KEY=your-email-provider-api-key
```

## Running the Application

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The API will be available at `http://localhost:8080`

## API Documentation

Swagger documentation is available at `http://localhost:8080/api-docs`

## API Endpoints

### Authentication
- POST /v1/auth/login - User login
- POST /v1/auth/refresh - Refresh JWT token
- POST /v1/auth/logout - User logout
- POST /v1/auth/client - Register new client
- GET /v1/auth/client/:clientId - Get client details

### Inventory
- GET /v1/inventory/products - List products
- POST /v1/inventory/products - Create product
- GET /v1/inventory/products/:productId - Get product details
- PUT /v1/inventory/products/:productId - Update product
- GET /v1/inventory/stock/:productId - Get stock level
- PUT /v1/inventory/stock/:productId - Update stock level

### Orders
- GET /v1/orders - List orders
- POST /v1/orders - Create order
- GET /v1/orders/:orderId - Get order details
- PUT /v1/orders/:orderId - Update order
- DELETE /v1/orders/:orderId - Delete order

### Support
- GET /v1/support/tickets - List support tickets
- POST /v1/support/tickets - Create ticket
- GET /v1/support/tickets/:ticketId - Get ticket details
- PUT /v1/support/tickets/:ticketId - Update ticket
- DELETE /v1/support/tickets/:ticketId - Delete ticket

## Error Handling

The API uses standard HTTP status codes and returns errors in the following format:

```json
{
  "code": "ERROR_CODE",
  "message": "Error description",
  "data": {} // Optional additional error data
}
```

## Security

- JWT-based authentication
- Role-based access control
- Input validation
- SQL injection prevention
- XSS protection
- CORS enabled
- Helmet security headers

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 