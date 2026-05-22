"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = authorize;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_json_1 = __importDefault(require("../config.json"));
const db_1 = __importDefault(require("../_helpers/db"));
const configData = config_json_1.default;
function authorize(roles = []) {
    if (typeof roles === 'string') {
        roles = [roles];
    }
    return [
        // Authenticate JWT token
        (req, res, next) => {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            if (!token) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            try {
                // ✅ FIXED: Using configData to bypass strict type checking
                const jwtSecret = process.env.JWT_SECRET || configData.secret;
                const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
                req.user = { id: decoded.id };
                next();
            }
            catch {
                return res.status(401).json({ message: 'Unauthorized' });
            }
        },
        // Authorize role
        async (req, res, next) => {
            try {
                const account = await db_1.default.Account.findByPk(req.user.id);
                if (!account || (roles.length && !roles.includes(account.role))) {
                    return res.status(401).json({ message: 'Unauthorized' });
                }
                // Attach role and ownsToken helper
                req.user.role = account.role;
                req.user.ownsToken = (token) => !!account.refreshTokens?.find((x) => x.token === token);
                next();
            }
            catch (err) {
                next(err);
            }
        }
    ];
}
