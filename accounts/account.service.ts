import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Op } from 'sequelize';
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

async function revokeToken({ token, ipAddress }: any) {
  const refreshTokenObj = await getRefreshToken(token);
  refreshTokenObj.revoked = new Date();
  refreshTokenObj.revokedByIp = ipAddress;
  await refreshTokenObj.save();
}

// ... (imports and top-level definitions remain the same)

async function register(params: any, origin: string) {
    const isFirstAccount = (await db.Account.count()) === 0;
    params.role = isFirstAccount ? Role.Admin : Role.User;
    
    // 1. Generate the plain-text token
    const plainToken = randomTokenString();
    
    // 2. Hash the token for the database
    params.verificationToken = crypto.createHash('sha256').update(plainToken).digest('hex');
    
    params.passwordHash = await hash(params.password);
    params.created = new Date();

    const account = await db.Account.create(params);

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
    const account = await db.Account.findOne({ where: { verificationToken: hashedToken } });
    
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

async function forgotPassword({ email }: any, origin: string) {
  const account = await db.Account.findOne({ where: { email } });
  if (!account) return;
  account.resetToken = randomTokenString();
  account.resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
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
  const jwtSecret = process.env.JWT_SECRET || "fallback_secret_only_for_dev";
  return jwt.sign({ id: account.id }, jwtSecret, { expiresIn: '24h' });
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

async function logRegistrationToSanity(account: any) {
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

    if (!response.ok) throw new Error('Failed to sync with Sanity');
    console.log('🚀 Successfully synced to Sanity.io!');
  } catch (error) {
    console.error('❌ Sanity.io Network Error:', error);
  }
}

// ─── 📧 Brevo REST API Email Helper ───────

async function sendTokenViaBrevo(email: string, firstName: string, token: string) {
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
    const response = await fetch(url, { // Now 'url' is defined
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY!
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(JSON.stringify(errorData));
    }
    
    console.log(`📧 Email successfully sent via REST API to ${email}`);
  } catch (error) {
    console.error('❌ Brevo REST API Error:', error);
  }
}