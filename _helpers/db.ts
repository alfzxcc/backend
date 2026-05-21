import { Sequelize } from 'sequelize';
import { accountModel } from '../accounts/account.model';
import { refreshTokenModel } from '../accounts/refresh-token.model';

const db: any = {};

export async function initialize() {
  // We use individual variables defined in Render Environment
  // Hostinger typically does not require SSL.
  const sequelize = new Sequelize(
    process.env.DB_NAME!,
    process.env.DB_USER!,
    process.env.DB_PASSWORD!,
    {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      dialect: 'mysql',
      logging: false,
      // Removed SSL block for Hostinger compatibility
    }
  );

  // Init models
  db.Account = accountModel(sequelize);
  db.RefreshToken = refreshTokenModel(sequelize);

  // Relationships
  db.Account.hasMany(db.RefreshToken, { onDelete: 'CASCADE' });
  db.RefreshToken.belongsTo(db.Account);

  // Sync models
  try {
    await sequelize.authenticate();
    console.log('✅ Connection to Hostinger database established successfully.');
    await sequelize.sync({ alter: true });
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    throw error;
  }

  db.sequelize = sequelize;
}

export default db;