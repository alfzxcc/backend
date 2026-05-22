"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialize = initialize;
const sequelize_1 = require("sequelize");
const account_model_1 = require("../accounts/account.model");
const refresh_token_model_1 = require("../accounts/refresh-token.model");
const db = {};
async function initialize() {
    // We use individual variables defined in Render Environment
    // Hostinger typically does not require SSL.
    const sequelize = new sequelize_1.Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        dialect: 'mysql',
        logging: false,
        // Removed SSL block for Hostinger compatibility
    });
    // Init models
    db.Account = (0, account_model_1.accountModel)(sequelize);
    db.RefreshToken = (0, refresh_token_model_1.refreshTokenModel)(sequelize);
    // Relationships
    db.Account.hasMany(db.RefreshToken, { onDelete: 'CASCADE' });
    db.RefreshToken.belongsTo(db.Account);
    // Sync models
    try {
        await sequelize.authenticate();
        console.log('✅ Connection to Hostinger database established successfully.');
        await sequelize.sync({ alter: true });
    }
    catch (error) {
        console.error('❌ Unable to connect to the database:', error);
        throw error;
    }
    db.sequelize = sequelize;
}
exports.default = db;
