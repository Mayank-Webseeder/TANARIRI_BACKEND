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
  const resetUrl = `${process.env.FRONTEND_URL}/forgot-password?token=${resetToken}`;

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

export const sendManualRefundAlert = async (order) => {
  const adminEmail = "tanaririllp@gmail.com";

  const html = `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
      <h2 style="color: #f0ad4e;">⚠️ Manual Refund Pre-Alert: Order #${order._id}</h2>
      <p>A return request has been <b>Approved</b>. Since this was a <b>COD</b> order, an automated refund is not possible.</p>
      
      <div style="background: #fff3cd; border: 1px solid #ffeeba; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #856404;">Return Details</h4>
        <p style="margin: 5px 0;"><b>Customer:</b> ${order.customerId.firstName} ${order.customerId.lastName}</p>
        <p style="margin: 5px 0;"><b>Refund Amount:</b> ₹${order.returnRequest.refundAmount}</p>
        <p style="margin: 5px 0;"><b>Reason:</b> ${order.returnRequest.reason}</p>
        <p style="margin: 5px 0;"><b>Return Waybill:</b> ${order.returnWaybill}</p>
      </div>

      <p><b>Next Steps:</b></p>
      <ol>
        <li>Wait for the return shipment to reach the warehouse.</li>
        <li>Contact the customer to collect their Bank/UPI details.</li>
        <li>Process the refund manually once the items are verified.</li>
      </ol>
      
      <p style="font-size: 12px; color: #777; margin-top: 30px;">
        Note: This is an early notification triggered during the return approval process.
      </p>
    </div>
  `;

  await sendEmail(
    adminEmail,
    `[Pre-Alert] Manual Refund Required: #${order._id}`,
    html,
  );
};