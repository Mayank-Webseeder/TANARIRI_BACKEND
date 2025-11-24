import crypto from "crypto";

const razorpay_order_id = "order_RimigBIRt12LRD";
const razorpay_payment_id = "pay_RimjZ7F5C16xyz";

// Razorpay Key Secret
const key_secret = "u8puKwRrwmjF6gxSa6gKDrM2";

const signature = crypto
  .createHmac("sha256", key_secret)
  .update(`${razorpay_order_id}|${razorpay_payment_id}`)
  .digest("hex");

console.log("Generated Signature:", signature);
