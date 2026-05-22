"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const db_1 = require("./_helpers/db");
const error_handler_1 = require("./_middleware/error-handler");
const swagger_1 = require("./_helpers/swagger");
const accounts_controller_1 = __importDefault(require("./accounts/accounts.controller"));
const app = (0, express_1.default)();
console.log("Check Env Vars:", {
    host: process.env.DB_HOST,
    project: process.env.SANITY_PROJECT_ID
});
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// ✅ CORS — handle preflight + credentialed requests from any vercel.app
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const isAllowed = origin && (
        origin === 'http://localhost:4200' ||
        /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)
    );
    if (isAllowed) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
    } else if (!origin) {
        // No origin = server-to-server or same-origin, allow it
    } else {
        // Unknown origin — still set headers so browser gets a proper rejection
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    // Respond immediately to preflight
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});
(0, swagger_1.setupSwagger)(app);
app.use('/accounts', accounts_controller_1.default);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use(error_handler_1.errorHandler);
const PORT = Number(process.env.PORT) || 4000;
(0, db_1.initialize)()
    .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Server running on port ${PORT}`);
    });
})
    .catch(err => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
});
exports.default = app;
