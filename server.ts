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
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ✅ CORS: Allow Vercel frontend + local development
const allowedOrigins = [
  'http://localhost:4200',
  'http://localhost:4000',
  process.env.FRONTEND_URL || ''
].filter(Boolean) as string[];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    
    // Normalize the origin by removing a trailing slash if it exists
    const normalizedOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
    
    if (allowedOrigins.map(o => o.endsWith('/') ? o.slice(0, -1) : o).includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
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
const PORT = process.env.PORT || 4000;

initialize()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📖 Swagger docs: http://localhost:${PORT}/api-docs`);
    });
  })
  .catch(err => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });

export default app;
