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

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/$/, "");
    if (allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Explicitly allow OPTIONS
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Important: Explicitly handle OPTIONS for all routes to prevent 404s
app.options('*', cors());

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