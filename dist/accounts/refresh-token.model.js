"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshTokenModel = refreshTokenModel;
const sequelize_1 = require("sequelize");
function refreshTokenModel(sequelize) {
    class RefreshToken extends sequelize_1.Model {
    }
    RefreshToken.init({
        token: { type: sequelize_1.DataTypes.STRING, allowNull: false },
        expires: { type: sequelize_1.DataTypes.DATE, allowNull: false },
        created: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
        createdByIp: { type: sequelize_1.DataTypes.STRING },
        revoked: { type: sequelize_1.DataTypes.DATE },
        revokedByIp: { type: sequelize_1.DataTypes.STRING },
        replacedByToken: { type: sequelize_1.DataTypes.STRING },
        isExpired: {
            type: sequelize_1.DataTypes.VIRTUAL,
            get() {
                return Date.now() >= this.expires;
            }
        },
        isActive: {
            type: sequelize_1.DataTypes.VIRTUAL,
            get() {
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
