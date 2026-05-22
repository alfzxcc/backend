"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logRegistrationToSanity = logRegistrationToSanity;
const config_json_1 = __importDefault(require("../config.json"));
const configData = config_json_1.default;
async function logRegistrationToSanity(account) {
    const { projectId, dataset, token } = configData.sanity;
    // Sanity HTTP API Mutations Endpoint URL
    const url = `https://${projectId}.api.sanity.io/v2026-05-20/data/mutate/${dataset}`;
    // Formatting the document matching Sanity's requirements
    const mutations = {
        mutations: [
            {
                create: {
                    _type: 'userRegistration', // Make sure this matches your schema name in Sanity
                    title: account.title,
                    firstName: account.firstName,
                    lastName: account.lastName,
                    email: account.email,
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
        // ✅ Replace it with this explicitly typed block:
        const result = await response.json();
        if (!response.ok) {
            console.error('❌ Sanity HTTP API Error:', result);
            throw new Error(result.message || 'Failed to push to Sanity');
        }
        console.log('🚀 Successfully synced registration to Sanity.io Studio!');
        return result;
    }
    catch (error) {
        console.error('❌ Network/Sanity Error:', error);
        throw error;
    }
}
