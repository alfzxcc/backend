  import express from 'express';
  import cookieParser from 'cookie-parser';
  import cors from 'cors';
  import { initialize } from './_helpers/db';
  import { errorHandler } from './_middleware/error-handler';
  import { setupSwagger } from './_helpers/swagger';
  import accountsController from './accounts/accounts.controller';

  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true })); // Changed to true for better handling
  app.use(cookieParser());

  // ✅ CORS Configuration
  const allowedOrigins = [
    'http://localhost:4200',
    'http://localhost:4000',
    process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, "") : ''
  ].filter(Boolean) as string[];

  // Add this middleware BEFORE your routes
  app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:4200',
            process.env.FRONTEND_URL?.replace(/\/$/, "")
        ];

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
  }));

// 2. Ensure OPTIONS requests are explicitly handled
  app.options('*', cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
  }));

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
      app.listen(PORT, '0.0.0.0', () => { // Bind to 0.0.0.0 for Render
        console.log(`✅ Server running on port ${PORT}`);
      });
    })
    .catch(err => {
      console.error('❌ Failed to start server:', err);
      process.exit(1);
    });

  export default app;