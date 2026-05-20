import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Op } from 'sequelize';
import nodemailer from 'nodemailer'; // ✅ Added for secure SMTP Relay operations
import config from '../config.json';
import db from '../_helpers/db';
import { Role } from '../_helpers/role';

export const accountService = {
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

async function authenticate({ email, password, ipAddress }: any) {
  const account = await db.Account.scope('withHash').findOne({ where: { email } });

  if (!account || !account.isVerified || !bcrypt.compareSync(password, account.passwordHash)) {
    throw 'Email or password is incorrect';
  }

  const jwtToken = generateJwtToken(account);
  const refreshTokenObj = await generateRefreshToken(account, ipAddress);
  await refreshTokenObj.save();

  return { ...basicDetails(account), jwtToken, refreshToken: refreshTokenObj.token };
}

async function refreshToken({ token, ipAddress }: any) {
  const refreshTokenObj = await getRefreshToken(token);
  const account = await refreshTokenObj.getAccount();

  // Rotate refresh token
  const newRefreshToken = await generateRefreshToken(account, ipAddress);
  refreshTokenObj.revoked = new Date();
  refreshTokenObj.revokedByIp = ipAddress;
  refreshTokenObj.replacedByToken = newRefreshToken.token;
  await refreshTokenObj.save();
  await newRefreshToken.save();

  const jwtToken = generateJwtToken(account);

  return { ...basicDetails(account), jwtToken, refreshToken: newRefreshToken.token };
}

async function revokeToken({ token, ipAddress }: any) {
  const refreshTokenObj = await getRefreshToken(token);
  refreshTokenObj.revoked = new Date();
  refreshTokenObj.revokedByIp = ipAddress;
  await refreshTokenObj.save();
}

// ─── Registration ──────────────────────────────────────

async function register(params: any, origin: string) {
  // First account gets Admin role
  const isFirstAccount = (await db.Account.count()) === 0;
  params.role = isFirstAccount ? Role.Admin : Role.User;
  params.verificationToken = randomTokenString();
  params.passwordHash = await hash(params.password);
  params.created = new Date();

  // 1. Save directly to your Hostinger MySQL DB
  const account = await db.Account.create(params);

  // 2. 🚀 Trigger Sanity HTTP API Integration (Passing token now)
  await logRegistrationToSanity({
    title: account.title,
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
    verificationToken: account.verificationToken
  });

  // 3. 📧 Brevo Email Live SMTP Send Integration (Bypasses IP restrictions)
  await sendTokenViaBrevo(account.email, account.firstName, account.verificationToken);
}

async function verifyEmail({ token }: any) {
  const account = await db.Account.findOne({ where: { verificationToken: token } });

  if (!account) throw 'Verification failed';

  account.verified = new Date();
  account.verificationToken = null;
  await account.save();
}

// ─── Password Reset ────────────────────────────────────

async function forgotPassword({ email }: any, origin: string) {
  const account = await db.Account.findOne({ where: { email } });

  // Return silently even if email not found to prevent enumeration
  if (!account) return;

  account.resetToken = randomTokenString();
  account.resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  await account.save();
}

async function validateResetToken({ token }: any) {
  const account = await db.Account.findOne({
    where: {
      resetToken: token,
      resetTokenExpires: { [Op.gt]: new Date() }
    }
  });

  if (!account) throw 'Invalid token';

  return account;
}

async function resetPassword({ token, password }: any) {
  const account = await validateResetToken({ token });

  account.passwordHash = await hash(password);
  account.passwordReset = new Date();
  account.resetToken = null;
  account.resetTokenExpires = null;
  await account.save();
}

// ─── CRUD ──────────────────────────────────────────────

async function getAll() {
  const accounts = await db.Account.findAll();
  return accounts.map(basicDetails);
}

async function getById(id: number) {
  const account = await getAccount(id);
  return basicDetails(account);
}

async function create(params: any) {
  if (await db.Account.findOne({ where: { email: params.email } })) {
    throw `Email "${params.email}" is already registered`;
  }

  params.passwordHash = await hash(params.password);
  params.verified = new Date();
  params.created = new Date();

  const account = await db.Account.create(params);
  return basicDetails(account);
}

async function update(id: number, params: any) {
  const account = await getAccount(id);

  if (params.email && account.email !== params.email &&
      await db.Account.findOne({ where: { email: params.email } })) {
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

async function _delete(id: number) {
  const account = await getAccount(id);
  await account.destroy();
}

// ─── Helpers ───────────────────────────────────────────

async function getAccount(id: number) {
  const account = await db.Account.findByPk(id);
  if (!account) throw 'Account not found';
  return account;
}

async function getRefreshToken(token: string) {
  const refreshToken = await db.RefreshToken.findOne({ where: { token } });
  if (!refreshToken || !refreshToken.isActive) throw 'Invalid token';
  return refreshToken;
}

async function hash(password: string) {
  return bcrypt.hash(password, 10);
}

function generateJwtToken(account: any) {
  const jwtSecret = process.env.JWT_SECRET || config.secret;
  return jwt.sign({ id: account.id }, jwtSecret, { expiresIn: '15m' });
}

async function generateRefreshToken(account: any, ipAddress: string) {
  return db.RefreshToken.build({
    accountId: account.id,
    token: randomTokenString(),
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdByIp: ipAddress
  });
}

function randomTokenString() {
  return crypto.randomBytes(40).toString('hex');
}

function basicDetails(account: any) {
  const { id, title, firstName, lastName, email, role, created, updated, isVerified } = account;
  return { id, title, firstName, lastName, email, role, created, updated, isVerified };
}

// ─── 🚀 Sanity.io HTTP API Integration Helper ──────────

async function logRegistrationToSanity(account: { title: string; firstName: string; lastName: string; email: string; verificationToken: string }) {
  const { projectId, dataset, token } = (config as any).sanity;
  
  const url = `https://${projectId}.api.sanity.io/v2026-05-20/data/mutate/${dataset}`;

  const mutations = {
    mutations: [
      {
        create: {
          _type: 'userRegistration',
          title: account.title,
          firstName: account.firstName,
          lastName: account.lastName,
          email: account.email,
          verificationToken: account.verificationToken,
          registeredAt: new Date().toISOString()
        }
      }
    ]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(mutations)
    });

    const result = await response.json() as { message?: string; [key: string]: any };

    if (!response.ok) {
      console.error('❌ Sanity HTTP API Error details:', result);
      throw new Error(result.message || 'Failed to sync with Sanity');
    }

    console.log('🚀 Successfully synced registration to Sanity.io Studio!');
    return result;
  } catch (error) {
    console.error('❌ Sanity.io Network Error:', error);
  }
}

// ─── 📧 Brevo (Sendinblue) SMTP Relay Email Helper ───────

async function sendTokenViaBrevo(email: string, firstName: string, token: string) {
  const { smtp, emailFrom } = (config as any);
  
  // Create a secure transport engine pointing directly to Brevo's relay network
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: false, // TLS upgrades dynamically via port 587
    auth: {
      user: smtp.user,
      pass: smtp.pass
    }
  });

  const mailOptions = {
    from: `"SmartSync Admin" <${emailFrom}>`,
    to: email,
    subject: "Verify Your Account Token",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.6;">
        <h2 style="color: #0052cc;">Welcome to SmartSync Tech, ${firstName}!</h2>
        <p>Your workspace setup registration is almost complete. Please use the secure authorization token below to verify your account profile entry:</p>
        <div style="padding: 15px; background-color: #f4f4f4; border-left: 4px solid #0052cc; font-family: monospace; font-size: 16px; margin: 20px 0; font-weight: bold; letter-spacing: 1px; word-break: break-all;">
          ${token}
        </div>
        <p>Alternatively, you can test UI token validation workflows by opening this layout endpoint parameter link directly:</p>
        <p><a href="http://localhost:4200/#/account/verify-email?token=${token}" style="color: #0052cc; font-weight: bold;">http://localhost:4200/#/account/verify-email?token=${token}</a></p>
        <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;" />
        <p style="font-size: 12px; color: #777;">This is an automated operational system message sent specifically for capstone database synchronization testing modules.</p>
      </div>
    `
  };

  try {
    let info = await transporter.sendMail(mailOptions);
    console.log(`📧 Token verification email dispatched safely via Brevo SMTP to ${email}! MessageId: ${info.messageId}`);
  } catch (error) {
    console.error('❌ Brevo SMTP Relay Error:', error);
  }
}