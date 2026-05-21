import { Sequelize } from 'sequelize';
import { accountModel } from '../accounts/account.model';
import { refreshTokenModel } from '../accounts/refresh-token.model';

const db: any = {};

export async function initialize() {
  // Use environment variables directly. 
  // We prioritize individual variables if DATABASE_URL is not provided.
  const connectionString = process.env.DATABASE_URL;

  let sequelize: Sequelize;

  if (connectionString) {
    sequelize = new Sequelize(connectionString, {
      dialect: 'mysql',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    });
  } else {
    // Fallback to individual variables defined in Render Environment
    sequelize = new Sequelize(
      process.env.DB_NAME!,
      process.env.DB_USER!,
      process.env.DB_PASSWORD!,
      {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        dialect: 'mysql',
        logging: false,
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        }
      }
    );
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