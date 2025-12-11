// controllers/helpController.js
import helpService from "../services/helpService.js";
import fs from "fs/promises";
import path from "path";

export const submitHelpRequest = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      // Clean up uploaded files
      if (req.files) {
        for (const file of req.files) {
          await fs.unlink(file.path).catch(console.error);
        }
      }

      return res.status(400).json({
        success: false,
        error: "All fields are required (name, email, subject, message)",
      });
    }

    // Validate name
    if (name.trim().length < 2) {
      if (req.files) {
        for (const file of req.files) {
          await fs.unlink(file.path).catch(console.error);
        }
      }

      return res.status(400).json({
        success: false,
        error: "Name must be at least 2 characters",
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      if (req.files) {
        for (const file of req.files) {
          await fs.unlink(file.path).catch(console.error);
        }
      }

      return res.status(400).json({
        success: false,
        error: "Please enter a valid email address",
      });
    }

    // Validate subject
    if (subject.trim().length < 5) {
      if (req.files) {
        for (const file of req.files) {
          await fs.unlink(file.path).catch(console.error);
        }
      }

      return res.status(400).json({
        success: false,
        error: "Subject must be at least 5 characters",
      });
    }

    // Validate message
    if (message.trim().length < 20) {
      if (req.files) {
        for (const file of req.files) {
          await fs.unlink(file.path).catch(console.error);
        }
      }

      return res.status(400).json({
        success: false,
        error: "Message must be at least 20 characters",
      });
    }

    // Prepare email data
    const emailData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
    };

    console.log("Processing help request from:", emailData.email);

    // Send email to support team (3 recipients)
    const supportEmailResult = await helpService.sendHelpEmail(
      emailData,
      req.files || []
    );
    console.log("Support team notified:", supportEmailResult.recipients);

    // Send confirmation email to customer
    const confirmationResult = await helpService.sendCustomerConfirmation(
      emailData
    );
    console.log("Confirmation sent to customer:", emailData.email);

    // Delete uploaded images after sending email
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
          console.log(`Deleted temporary file: ${file.filename}`);
        } catch (unlinkError) {
          console.error("Error deleting file:", unlinkError.message);
        }
      }
    }

    res.status(200).json({
      success: true,
      message:
        "Your message has been sent successfully! Our support team will get back to you soon.",
    });
  } catch (error) {
    console.error("Error submitting help request:", error);

    // Clean up uploaded files on error
    if (req.files) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error("Error deleting file:", unlinkError.message);
        }
      }
    }

    res.status(500).json({
      success: false,
      error:
        "An error occurred while sending your request. Please try again later.",
    });
  }
};
