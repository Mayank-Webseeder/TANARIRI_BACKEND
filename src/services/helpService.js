// services/helpService.js
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class HelpService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: true,
      auth: {
        user: config.mail.user,
        pass: config.mail.pass,
      },
    });

    this.transporter.verify((error, success) => {
      if (error) {
        console.error("Email transporter error:", error);
      } else {
        console.log("Email server is ready to send messages");
        console.log(
          "Help emails will be sent to:",
          config.mail.helpRecipients.join(", ")
        );
      }
    });
  }

  generateHelpEmailTemplate(helpData) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #000000;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        
        <!-- Logo -->
        <div style="margin-bottom: 20px;">
          <img src="cid:tanariri_logo" alt="Tanariri" style="height: 40px;">
        </div>

        <!-- Subject Line -->
        <div style="margin-bottom: 20px;">
          <strong style="font-size: 16px;">New Help Request Received</strong>
        </div>

        <!-- Message -->
        <p style="margin: 0 0 15px 0;">Hello,</p>
        <p style="margin: 0 0 15px 0;">A new help request has been submitted. Details below:</p>

        <!-- Details -->
        <div style="margin: 20px 0; padding: 15px 0; border-top: 1px solid #cccccc; border-bottom: 1px solid #cccccc;">
          <p style="margin: 0 0 10px 0;"><strong>Name:</strong> ${
            helpData.name
          }</p>
          <p style="margin: 0 0 10px 0;"><strong>Email:</strong> <a href="mailto:${
            helpData.email
          }" style="color: #0066cc; text-decoration: none;">${
      helpData.email
    }</a></p>
          <p style="margin: 0 0 10px 0;"><strong>Date:</strong> ${new Date().toLocaleString(
            "en-IN",
            { timeZone: "Asia/Kolkata" }
          )}</p>
          ${
            helpData.imageCount > 0
              ? `<p style="margin: 0;"><strong>Attachments:</strong> ${helpData.imageCount} file(s)</p>`
              : ""
          }
        </div>

        <p style="margin: 0 0 10px 0;"><strong>Subject:</strong></p>
        <p style="margin: 0 0 20px 0;">${helpData.subject}</p>

        <p style="margin: 0 0 10px 0;"><strong>Message:</strong></p>
        <p style="margin: 0 0 20px 0; white-space: pre-wrap;">${
          helpData.message
        }</p>

        <!-- Footer -->
        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #cccccc; font-size: 12px; color: #666666;">
          <p style="margin: 0 0 5px 0;">Tanariri Help System</p>
          <p style="margin: 0;">This is an automated message. Please do not reply to this email.</p>
        </div>

      </div>
    </body>
    </html>
    `;
  }

  async sendHelpEmail(helpData, attachments = []) {
    try {
      // Get recipients from config
      const recipients = config.mail.helpRecipients;

      const htmlContent = this.generateHelpEmailTemplate({
        ...helpData,
        imageCount: attachments.length,
      });

      const emailAttachments = [
        {
          filename: "tanariri-logo.png",
          path: path.join(__dirname, "../assets/tanariri-logo.png"),
          cid: "tanariri_logo",
        },
      ];

      if (attachments && attachments.length > 0) {
        attachments.forEach((file) => {
          emailAttachments.push({
            filename: file.filename,
            path: file.path,
            contentType: file.mimetype,
          });
        });
      }

      const mailOptions = {
        from: {
          name: "Tanariri Help Center",
          address: config.mail.from,
        },
        to: recipients.join(", "),
        subject: `New Help Request: ${helpData.subject}`,
        html: htmlContent,
        attachments: emailAttachments,
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log("Help email sent successfully:", info.messageId);
      console.log("Recipients:", recipients.join(", "));
      return {
        success: true,
        messageId: info.messageId,
        recipients: recipients,
      };
    } catch (error) {
      console.error("Error sending help email:", error);
      throw error;
    }
  }

  async sendCustomerConfirmation(helpData) {
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #000000;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        
        <!-- Logo -->
        <div style="margin-bottom: 20px;">
          <img src="cid:tanariri_logo" alt="Tanariri" style="height: 40px;">
        </div>

        <!-- Subject -->
        <div style="margin-bottom: 20px;">
          <strong style="font-size: 16px;">Thank You for Contacting Tanariri</strong>
        </div>

        <!-- Message -->
        <p style="margin: 0 0 15px 0;">Dear ${helpData.name},</p>
        
        <p style="margin: 0 0 15px 0;">Thank you for reaching out to us. We have received your help request and our team will review it shortly.</p>

        <p style="margin: 0 0 15px 0;">We aim to respond within 2-4 hours during our business hours (Monday - Saturday, 9:00 AM - 6:00 PM IST).</p>

        <!-- Request Details -->
        <div style="margin: 20px 0; padding: 15px 0; border-top: 1px solid #cccccc; border-bottom: 1px solid #cccccc;">
          <p style="margin: 0 0 10px 0;"><strong>Your Request:</strong></p>
          <p style="margin: 0;">${helpData.subject}</p>
        </div>

        <p style="margin: 0 0 15px 0;">You will receive a response at: ${
          helpData.email
        }</p>

        <p style="margin: 0 0 15px 0;">If you have any additional information to provide, please reply directly to this email.</p>

        <p style="margin: 0 0 5px 0;">Best regards,</p>
        <p style="margin: 0 0 20px 0;">Tanariri Support Team</p>

        <!-- Footer -->
        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #cccccc; font-size: 12px; color: #666666;">
          <p style="margin: 0 0 5px 0;">Tanariri</p>
          <p style="margin: 0;">Copyright ${new Date().getFullYear()}. All rights reserved.</p>
        </div>

      </div>
    </body>
    </html>
    `;

    try {
      const mailOptions = {
        from: {
          name: "Tanariri Help Center",
          address: config.mail.from,
        },
        to: helpData.email,
        subject: "Help Request Received - Tanariri",
        html: htmlContent,
        attachments: [
          {
            filename: "tanariri-logo.png",
            path: path.join(__dirname, "../assets/tanariri-logo.png"),
            cid: "tanariri_logo",
          },
        ],
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log("Customer confirmation email sent:", info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("Error sending customer confirmation:", error);
      throw error;
    }
  }
}

export default new HelpService();
