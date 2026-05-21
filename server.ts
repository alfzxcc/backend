import express from 'express';
import cookieParser from 'cookie-parser';
import { initialize } from './_helpers/db';
import { errorHandler } from './_middleware/error-handler';
import { setupSwagger } from './_helpers/swagger';
import accountsController from './accounts/accounts.controller';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ Centralized CORS Middleware (Handles Preflight & Headers)
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
        'http://localhost:4200',
        process.env.FRONTEND_URL?.replace(/\/$/, "")
    ];

    if (origin && allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');

    // Handle preflight requests manually to avoid path-to-regexp errors
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Swagger docs
setupSwagger(app);

// Routes
app.use('/accounts', accountsController);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Global error handler
app.use(errorHandler);

// Start server
const PORT = Number(process.env.PORT) || 4000;

initialize()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });

export default app;