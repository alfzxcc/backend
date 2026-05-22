"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto = __importStar(require("crypto"));
const sequelize_1 = require("sequelize");
const db_1 = __importDefault(require("../_helpers/db"));
const role_1 = require("../_helpers/role");
exports.accountService = {
    authenticate,
    refreshToken,
    revokeToken,
    register,
    verifyEmail,
    forgotPassword,
    validateResetToken,
    resetPassword,
    getAll,
    getById,
    create,
    update,
    delete: _delete
};
// ─── Auth ──────────────────────────────────────────────
async function authenticate({ email, password, ipAddress }) {
    const account = await db_1.default.Account.scope('withHash').findOne({ where: { email } });
    if (!account || !account.isVerified || !bcryptjs_1.default.compareSync(password, account.passwordHash)) {
        throw 'Email or password is incorrect';
    }
    const jwtToken = generateJwtToken(account);
    const refreshTokenObj = await generateRefreshToken(account, ipAddress);
    await refreshTokenObj.save();
    return { ...basicDetails(account), jwtToken, refreshToken: refreshTokenObj.token };
}
async function refreshToken({ token, ipAddress }) {
    const refreshTokenObj = await getRefreshToken(token);
    // You must fetch the account from the token object first
    const account = await refreshTokenObj.getAccount();
    if (!account) {
        throw 'Account not found';
    }
    const newRefreshToken = await generateRefreshToken(account, ipAddress);
    refreshTokenObj.revoked = new Date();
    refreshTokenObj.revokedByIp = ipAddress;
    refreshTokenObj.replacedByToken = newRefreshToken.token;
    await refreshTokenObj.save();
    await newRefreshToken.save();
    const jwtToken = generateJwtToken(account);
    return { ...basicDetails(account), jwtToken, refreshToken: newRefreshToken.token };
}
async function revokeToken({ token, ipAddress }) {
    const refreshTokenObj = await getRefreshToken(token);
    refreshTokenObj.revoked = new Date();
    refreshTokenObj.revokedByIp = ipAddress;
    await refreshTokenObj.save();
}
// ... (imports and top-level definitions remain the same)
async function register(params, origin) {
    const isFirstAccount = (await db_1.default.Account.count()) === 0;
    params.role = isFirstAccount ? role_1.Role.Admin : role_1.Role.User;
    // 1. Generate the plain-text token
    const plainToken = randomTokenString();
    // 2. Hash the token for the database
    params.verificationToken = crypto.createHash('sha256').update(plainToken).digest('hex');
    params.passwordHash = await hash(params.password);
    params.created = new Date();
    const account = await db_1.default.Account.create(params);
    // 3. Sync with Sanity
    await logRegistrationToSanity({
        title: account.title,
        firstName: account.firstName,
        lastName: account.lastName,
        email: account.email,
        verificationToken: plainToken
    });
    // 4. Send the PLAIN token via Email
    await sendTokenViaBrevo(account.email, account.firstName, plainToken);
}
async function verifyEmail({ token }) {
    console.log("Searching for token:", token);
    // Hash the incoming token to match the database search
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    // Search using the hashed version
    const account = await db_1.default.Account.findOne({ where: { verificationToken: hashedToken } });
    if (!account) {
        throw 'Verification failed: The token is invalid or already used.';
    }
    // Update account status
    account.isVerified = true; // Ensure this matches your model field
    account.verified = new Date();
    account.verificationToken = null; // Clear the token so it cannot be reused
    await account.save();
}
// ... (rest of the file remains the same)
// ─── Password Reset ────────────────────────────────────
async function forgotPassword({ email }, origin) {
    const account = await db_1.default.Account.findOne({ where: { email } });
    if (!account)
        return;
    account.resetToken = randomTokenString();
    account.resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await account.save();
    await sendResetPasswordViaBrevo(account.email, account.firstName, account.resetToken);
}
async function sendResetPasswordViaBrevo(email, firstName, token) {
    const resetUrl = `${process.env.FRONTEND_URL}/#/account/reset-password?token=${token}`;
    const url = 'https://api.brevo.com/v3/smtp/email';
    const emailData = {
        sender: { email: process.env.EMAIL_FROM, name: "SmartSync Admin" },
        to: [{ email: email, name: firstName }],
        subject: "Reset Your Password",
        htmlContent: `
      <div>
        <p>Hi ${firstName},</p>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <a href="${resetUrl}">Reset My Password</a>
        <p>This link expires in 24 hours. If you did not request this, ignore this email.</p>
      </div>
    `
    };
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': process.env.BREVO_API_KEY
            },
            body: JSON.stringify(emailData)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(JSON.stringify(errorData));
        }
        console.log(`📧 Reset password email sent to ${email}`);
    }
    catch (error) {
        console.error('❌ Brevo Reset Email Error:', error);
    }
}
async function validateResetToken({ token }) {
    const account = await db_1.default.Account.findOne({
        where: {
            resetToken: token,
            resetTokenExpires: { [sequelize_1.Op.gt]: new Date() }
        }
    });
    if (!account)
        throw 'Invalid token';
    return account;
}
async function resetPassword({ token, password }) {
    const account = await validateResetToken({ token });
    account.passwordHash = await hash(password);
    account.passwordReset = new Date();
    account.resetToken = null;
    account.resetTokenExpires = null;
    await account.save();
}
// ─── CRUD ──────────────────────────────────────────────
async function getAll() {
    const accounts = await db_1.default.Account.findAll();
    return accounts.map(basicDetails);
}
async function getById(id) {
    const account = await getAccount(id);
    return basicDetails(account);
}
async function create(params) {
    if (await db_1.default.Account.findOne({ where: { email: params.email } })) {
        throw `Email "${params.email}" is already registered`;
    }
    params.passwordHash = await hash(params.password);
    params.verified = new Date();
    params.created = new Date();
    const account = await db_1.default.Account.create(params);
    return basicDetails(account);
}
async function update(id, params) {
    const account = await getAccount(id);
    if (params.email && account.email !== params.email &&
        await db_1.default.Account.findOne({ where: { email: params.email } })) {
        throw `Email "${params.email}" is already registered`;
    }
    if (params.password) {
        params.passwordHash = await hash(params.password);
    }
    Object.assign(account, params);
    account.updated = new Date();
    await account.save();
    return basicDetails(account);
}
async function _delete(id) {
    const account = await getAccount(id);
    await account.destroy();
}
// ─── Helpers ───────────────────────────────────────────
async function getAccount(id) {
    const account = await db_1.default.Account.findByPk(id);
    if (!account)
        throw 'Account not found';
    return account;
}
async function getRefreshToken(token) {
    const refreshToken = await db_1.default.RefreshToken.findOne({ where: { token } });
    if (!refreshToken || !refreshToken.isActive)
        throw 'Invalid token';
    return refreshToken;
}
async function hash(password) {
    return bcryptjs_1.default.hash(password, 10);
}
function generateJwtToken(account) {
    const jwtSecret = process.env.JWT_SECRET || "fallback_secret_only_for_dev";
    return jsonwebtoken_1.default.sign({ id: account.id }, jwtSecret, { expiresIn: '24h' });
}
async function generateRefreshToken(account, ipAddress) {
    return db_1.default.RefreshToken.build({
        accountId: account.id,
        token: randomTokenString(),
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdByIp: ipAddress
    });
}
function randomTokenString() {
    return crypto.randomBytes(40).toString('hex');
}
function basicDetails(account) {
    const { id, title, firstName, lastName, email, role, created, updated, isVerified } = account;
    return { id, title, firstName, lastName, email, role, created, updated, isVerified };
}
// ─── 🚀 Sanity.io HTTP API Integration Helper ──────────
async function logRegistrationToSanity(account) {
    const url = `https://${process.env.SANITY_PROJECT_ID}.api.sanity.io/v2026-05-20/data/mutate/${process.env.SANITY_DATASET}`;
    const mutations = {
        mutations: [{
                create: {
                    _type: 'userRegistration',
                    title: account.title,
                    firstName: account.firstName,
                    lastName: account.lastName,
                    email: account.email,
                    verificationToken: account.verificationToken,
                    registeredAt: new Date().toISOString()
                }
            }]
    };
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SANITY_TOKEN}`
            },
            body: JSON.stringify(mutations)
        });
        if (!response.ok)
            throw new Error('Failed to sync with Sanity');
        console.log('🚀 Successfully synced to Sanity.io!');
    }
    catch (error) {
        console.error('❌ Sanity.io Network Error:', error);
    }
}
// ─── 📧 Brevo REST API Email Helper ───────
async function sendTokenViaBrevo(email, firstName, token) {
    const verifyUrl = `${process.env.FRONTEND_URL}/#/account/verify-email?token=${token}`;
    // You must define the endpoint URL here
    const url = 'https://api.brevo.com/v3/smtp/email';
    const emailData = {
        sender: { email: process.env.EMAIL_FROM, name: "SmartSync Admin" },
        to: [{ email: email, name: firstName }],
        subject: "Verify Your Account",
        htmlContent: `
      <div>
        <p>Welcome, ${firstName}!</p>
        <p>Please click the link below to verify your account:</p>
        <a href="${verifyUrl}">Verify My Account</a>
      </div>
    `
    };
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': process.env.BREVO_API_KEY
            },
            body: JSON.stringify(emailData)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(JSON.stringify(errorData));
        }
        console.log(`📧 Email successfully sent via REST API to ${email}`);
    }
    catch (error) {
        console.error('❌ Brevo REST API Error:', error);
    }
}
