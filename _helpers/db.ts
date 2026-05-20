import { Sequelize } from 'sequelize';
import mysql2 from 'mysql2/promise';
import config from '../config.json';
import { accountModel } from '../accounts/account.model';
import { refreshTokenModel } from '../accounts/refresh-token.model';

const configData = config as any;
const db: any = {};

export async function initialize() {
  // If a full connection string (DATABASE_URL) exists, use it. 
  // Otherwise, use the individual environment variables.
  const connectionString = process.env.DATABASE_URL;

  let sequelize: Sequelize;

  if (connectionString) {
    // Use the full URL string (Best for Aiven)
    sequelize = new Sequelize(connectionString, {
      dialect: 'mysql',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false // Required for most cloud DBs like Aiven
        }
      }
    });
  } else {
    // Fallback to individual variables
    const host = process.env.DB_HOST || configData.database?.host;
    const port = Number(process.env.DB_PORT) || configData.database?.port;
    const user = process.env.DB_USER || configData.database?.user;
    const password = process.env.DB_PASSWORD || configData.database?.password;
    const database = process.env.DB_NAME || configData.database?.database;

    sequelize = new Sequelize(database, user, password, {
      host,
      port,
      dialect: 'mysql',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    });
  }

  // Init models
  db.Account = accountModel(sequelize);
  db.RefreshToken = refreshTokenModel(sequelize);

  // Relationships
  db.Account.hasMany(db.RefreshToken, { onDelete: 'CASCADE' });
  db.RefreshToken.belongsTo(db.Account);

  // Sync models
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
    await sequelize.sync({ alter: true });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }

  db.sequelize = sequelize;
}

export default db;