import express, { Request, Response, NextFunction } from 'express';
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ CORS — must be before all routes
app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin as string;

    const allowedOrigins = [
        'http://localhost:4200',
        'https://prcticefrontend.vercel.app'
    ];

    const isVercel = origin && /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin);

    if (origin && (allowedOrigins.includes(origin) || isVercel)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.setHeader('Access-Control-Max-Age', '86400'); // cache preflight for 24h

    // Always respond 204 to preflight OPTIONS
    if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
    }

    next();
});

setupSwagger(app);
app.use('/accounts', accountsController);
app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok' }));
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 4000;

initialize()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  })
  .catch((err: Error) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });

export default app;
