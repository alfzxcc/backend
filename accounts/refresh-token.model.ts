import { Sequelize, DataTypes, Model } from 'sequelize';

export function refreshTokenModel(sequelize: Sequelize) {
  class RefreshToken extends Model {}

  RefreshToken.init({
    token: { type: DataTypes.STRING, allowNull: false },
    expires: { type: DataTypes.DATE, allowNull: false },
    created: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    createdByIp: { type: DataTypes.STRING },
    revoked: { type: DataTypes.DATE },
    revokedByIp: { type: DataTypes.STRING },
    replacedByToken: { type: DataTypes.STRING },
    isExpired: {
      type: DataTypes.VIRTUAL,
      get(this: any) {
        return Date.now() >= this.expires;
      }
    },
    isActive: {
      type: DataTypes.VIRTUAL,
      get(this: any) {
        return !this.revoked && !this.isExpired;
      }
    }
  }, {
    sequelize,
    modelName: 'refreshToken',
    timestamps: false
  });

  return RefreshToken;
}
