"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSwagger = setupSwagger;
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function setupSwagger(app) {
    // Resolves correctly for both ts-node (src/_helpers/) and compiled (dist/_helpers/)
    const possiblePaths = [
        path_1.default.join(__dirname, '../swagger.yaml'), // ts-node: src/_helpers → src/
        path_1.default.join(__dirname, '../../swagger.yaml'), // compiled: dist/_helpers → root
        path_1.default.join(process.cwd(), 'swagger.yaml'), // fallback: wherever process runs from
    ];
    const swaggerPath = possiblePaths.find(p => fs_1.default.existsSync(p));
    if (swaggerPath) {
        const swaggerDocument = js_yaml_1.default.load(fs_1.default.readFileSync(swaggerPath, 'utf8'));
        app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument));
        console.log(`📖 Swagger loaded from: ${swaggerPath}`);
    }
    else {
        console.warn('⚠️  swagger.yaml not found — /api-docs will not be available');
        // Mount a simple fallback so it doesn't 404 silently
        app.get('/api-docs', (_req, res) => {
            res.json({ error: 'swagger.yaml not found', searched: possiblePaths });
        });
    }
}
