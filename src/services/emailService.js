import nodemailer from "nodemailer";
import { config } from "../config/env.js";

const transporter = nodemailer.createTransport({
  host: config.mail.host,
  port: config.mail.port,
  secure: config.mail.port === 465,
  auth: {
    user: config.mail.user,
    pass: config.mail.pass,
  },
});

export const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: config.mail.from,
      to,
      subject,
      html,
    });

    console.log("Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("Email error:", error);
    throw error;
  }
};

export const sendPasswordResetEmail = async (to, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const html = `
    <h1>Password Reset Request</h1>
    <p>You requested a password reset. Click the link below to reset your password:</p>
    <a href="${resetUrl}">${resetUrl}</a>
    <p>This link will expire in 1 hour.</p>
    <p>If you didn't request this, please ignore this email.</p>
  `;

  await sendEmail(to, "Password Reset Request", html);
};

export const sendWelcomeEmail = async (to, firstName) => {
  const html = `
    <h1>Welcome to Our E-commerce Store!</h1>
    <p>Hi ${firstName},</p>
    <p>Thank you for signing up. We're excited to have you on board!</p>
    <p>Start exploring our products and enjoy shopping with us.</p>
  `;

  await sendEmail(to, "Welcome!", html);
};
