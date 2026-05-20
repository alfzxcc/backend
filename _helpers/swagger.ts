import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { Express } from 'express';

export function setupSwagger(app: Express) {
  // Resolves correctly for both ts-node (src/_helpers/) and compiled (dist/_helpers/)
  const possiblePaths = [
    path.join(__dirname, '../swagger.yaml'),       // ts-node: src/_helpers → src/
    path.join(__dirname, '../../swagger.yaml'),    // compiled: dist/_helpers → root
    path.join(process.cwd(), 'swagger.yaml'),      // fallback: wherever process runs from
  ];

  const swaggerPath = possiblePaths.find(p => fs.existsSync(p));

  if (swaggerPath) {
    const swaggerDocument = yaml.load(fs.readFileSync(swaggerPath, 'utf8')) as object;
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    console.log(`📖 Swagger loaded from: ${swaggerPath}`);
  } else {
    console.warn('⚠️  swagger.yaml not found — /api-docs will not be available');
    // Mount a simple fallback so it doesn't 404 silently
    app.get('/api-docs', (_req, res) => {
      res.json({ error: 'swagger.yaml not found', searched: possiblePaths });
    });
  }
}
