import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  mongodbUrl: process.env.MONGODB_URL,
  jwtSecret:
    process.env.JWT_SECRET || "default_secret_key_change_in_production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  razorpay: {
    keyId: process.env.RAZORPAY_TEST_KEY_ID,
    keySecret: process.env.RAZORPAY_TEST_KEY_SECRET,
  },
  mail: {
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT),
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
    from: process.env.MAIL_FROM,
    helpRecipients: process.env.HELP_RECIPIENTS
      ? process.env.HELP_RECIPIENTS.split(",").map((email) => email.trim())
      : ["kumar.anurag@webseeder.in"],
  },
};
