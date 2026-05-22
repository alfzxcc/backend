"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
const resend_1 = require("resend");
const config_json_1 = __importDefault(require("../config.json"));
// Use env var on Render, fall back to config.json locally
const resendApiKey = process.env.RESEND_API_KEY || config_json_1.default.resendApiKey;
const resend = new resend_1.Resend(resendApiKey);
async function sendEmail({ to, subject, html, from }) {
    const sender = from || process.env.EMAIL_FROM || config_json_1.default.emailFrom;
    await resend.emails.send({
        from: sender,
        to,
        subject,
        html
    });
}
