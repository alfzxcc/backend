"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const account_service_1 = require("./account.service");
const authorize_1 = require("../_middleware/authorize");
const validate_request_1 = require("../_middleware/validate-request");
const role_1 = require("../_helpers/role");
const router = express_1.default.Router();
// ─── Routes ────────────────────────────────────────────
router.post('/authenticate', authenticateSchema, authenticate);
router.post('/refresh-token', refreshToken);
router.post('/revoke-token', (0, authorize_1.authorize)(), revokeTokenSchema, revokeToken);
router.post('/register', registerSchema, register);
router.post('/verify-email', verifyEmailSchema, verifyEmail);
router.post('/forgot-password', forgotPasswordSchema, forgotPassword);
router.post('/validate-reset-token', validateResetTokenSchema, validateResetToken);
router.post('/reset-password', resetPasswordSchema, resetPassword);
router.get('/', (0, authorize_1.authorize)(role_1.Role.Admin), getAll);
router.get('/:id', (0, authorize_1.authorize)(), getById);
router.post('/', (0, authorize_1.authorize)(role_1.Role.Admin), createSchema, create);
router.put('/:id', (0, authorize_1.authorize)(), updateSchema, update);
router.delete('/:id', (0, authorize_1.authorize)(), _delete);
exports.default = router;
// ─── Schema Validation Middleware ──────────────────────
function authenticateSchema(req, res, next) {
    const schema = joi_1.default.object({
        email: joi_1.default.string().required(),
        password: joi_1.default.string().required()
    });
    (0, validate_request_1.validateRequest)(req, next, schema);
}
function revokeTokenSchema(req, res, next) {
    const schema = joi_1.default.object({ token: joi_1.default.string().empty('') });
    (0, validate_request_1.validateRequest)(req, next, schema);
}
function registerSchema(req, res, next) {
    const schema = joi_1.default.object({
        title: joi_1.default.string(),
        firstName: joi_1.default.string().required(),
        lastName: joi_1.default.string().required(),
        email: joi_1.default.string().email().required(),
        password: joi_1.default.string().min(6).required(),
        confirmPassword: joi_1.default.string().valid(joi_1.default.ref('password')).required(),
        acceptTerms: joi_1.default.boolean().valid(true).required()
    });
    (0, validate_request_1.validateRequest)(req, next, schema);
}
function verifyEmailSchema(req, res, next) {
    const schema = joi_1.default.object({ token: joi_1.default.string().required() });
    (0, validate_request_1.validateRequest)(req, next, schema);
}
function forgotPasswordSchema(req, res, next) {
    const schema = joi_1.default.object({ email: joi_1.default.string().email().required() });
    (0, validate_request_1.validateRequest)(req, next, schema);
}
function validateResetTokenSchema(req, res, next) {
    const schema = joi_1.default.object({ token: joi_1.default.string().required() });
    (0, validate_request_1.validateRequest)(req, next, schema);
}
function resetPasswordSchema(req, res, next) {
    const schema = joi_1.default.object({
        token: joi_1.default.string().required(),
        password: joi_1.default.string().min(6).required(),
        confirmPassword: joi_1.default.string().valid(joi_1.default.ref('password')).required()
    });
    (0, validate_request_1.validateRequest)(req, next, schema);
}
function createSchema(req, res, next) {
    const schema = joi_1.default.object({
        title: joi_1.default.string(),
        firstName: joi_1.default.string().required(),
        lastName: joi_1.default.string().required(),
        email: joi_1.default.string().email().required(),
        password: joi_1.default.string().min(6).required(),
        confirmPassword: joi_1.default.string().valid(joi_1.default.ref('password')).required(),
        role: joi_1.default.string().valid(role_1.Role.Admin, role_1.Role.User).required()
    });
    (0, validate_request_1.validateRequest)(req, next, schema);
}
function updateSchema(req, res, next) {
    const schemaRules = {
        title: joi_1.default.string(),
        firstName: joi_1.default.string().empty(''),
        lastName: joi_1.default.string().empty(''),
        email: joi_1.default.string().email().empty(''),
        password: joi_1.default.string().min(6).empty(''),
        confirmPassword: joi_1.default.string().valid(joi_1.default.ref('password')).empty('')
    };
    if (req.user?.role === role_1.Role.Admin) {
        schemaRules.role = joi_1.default.string().valid(role_1.Role.Admin, role_1.Role.User).empty('');
    }
    (0, validate_request_1.validateRequest)(req, next, joi_1.default.object(schemaRules));
}
// ─── Route Handlers ────────────────────────────────────
function authenticate(req, res, next) {
    const { email, password } = req.body;
    const ipAddress = req.ip;
    account_service_1.accountService.authenticate({ email, password, ipAddress })
        .then(({ refreshToken, ...account }) => {
        setTokenCookie(res, refreshToken);
        res.json(account);
    })
        .catch(next);
}
function refreshToken(req, res, next) {
    const token = req.cookies.refreshToken;
    const ipAddress = req.ip;
    account_service_1.accountService.refreshToken({ token, ipAddress })
        .then(({ refreshToken, ...account }) => {
        setTokenCookie(res, refreshToken);
        res.json(account);
    })
        .catch(next);
}
function revokeToken(req, res, next) {
    const token = req.body.token || req.cookies.refreshToken;
    const ipAddress = req.ip;
    if (!token)
        return res.status(400).json({ message: 'Token is required' });
    const user = req.user;
    if (user.role !== role_1.Role.Admin && !user.ownsToken(token)) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    account_service_1.accountService.revokeToken({ token, ipAddress })
        .then(() => res.json({ message: 'Token revoked' }))
        .catch(next);
}
function register(req, res, next) {
    // Use the environment variable from Render
    const origin = process.env.FRONTEND_URL || 'http://localhost:4200';
    account_service_1.accountService.register(req.body, origin)
        .then(() => res.json({ message: 'Registration successful, please check your email for verification instructions' }))
        .catch(next);
}
function verifyEmail(req, res, next) {
    account_service_1.accountService.verifyEmail(req.body)
        .then(() => res.json({ message: 'Verification successful, you can now login' }))
        .catch(next);
}
function forgotPassword(req, res, next) {
    const origin = process.env.FRONTEND_URL || 'http://localhost:4200';
    account_service_1.accountService.forgotPassword(req.body, origin)
        .then(() => res.json({ message: 'Please check your email for password reset instructions' }))
        .catch(next);
}
function validateResetToken(req, res, next) {
    account_service_1.accountService.validateResetToken(req.body)
        .then(() => res.json({ message: 'Token is valid' }))
        .catch(next);
}
function resetPassword(req, res, next) {
    account_service_1.accountService.resetPassword(req.body)
        .then(() => res.json({ message: 'Password reset successful, you can now login' }))
        .catch(next);
}
function getAll(req, res, next) {
    account_service_1.accountService.getAll()
        .then(accounts => res.json(accounts))
        .catch(next);
}
function getById(req, res, next) {
    const user = req.user;
    const id = parseInt(req.params.id);
    if (id !== user.id && user.role !== role_1.Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    account_service_1.accountService.getById(id)
        .then(account => account ? res.json(account) : res.sendStatus(404))
        .catch(next);
}
function create(req, res, next) {
    account_service_1.accountService.create(req.body)
        .then(account => res.json(account))
        .catch(next);
}
function update(req, res, next) {
    const user = req.user;
    const id = parseInt(req.params.id);
    if (id !== user.id && user.role !== role_1.Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    account_service_1.accountService.update(id, req.body)
        .then(account => res.json(account))
        .catch(next);
}
function _delete(req, res, next) {
    const user = req.user;
    const id = parseInt(req.params.id);
    if (id !== user.id && user.role !== role_1.Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    account_service_1.accountService.delete(id)
        .then(() => res.json({ message: 'Account deleted successfully' }))
        .catch(next);
}
// ─── Cookie Helper ─────────────────────────────────────
function setTokenCookie(res, token) {
    const cookieOptions = {
        httpOnly: true,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        secure: true, // Essential for sameSite: 'none'
        sameSite: 'none' // Explicitly allowed value for CookieOptions
    };
    res.cookie('refreshToken', token, cookieOptions);
}
