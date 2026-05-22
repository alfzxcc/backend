import express from 'express';
import cookieParser from 'cookie-parser';
import { initialize } from './_helpers/db';
import { errorHandler } from './_middleware/error-handler';
import { setupSwagger } from './_helpers/swagger';
import accountsController from './accounts/accounts.controller';

const app = express();
console.log("Check Env Vars:", { 
  host: process.env.DB_HOST, 
  project: process.env.SANITY_PROJECT_ID 
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ CORS Middleware — allows any vercel.app subdomain + localhost
app.use((req, res, next) => {
    const origin = req.headers.origin;

    const isAllowed = origin && (
        origin === 'http://localhost:4200' ||
        /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)
    );

    if (isAllowed) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');

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
