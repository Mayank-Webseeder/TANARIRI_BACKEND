import express from "express";
import {
  createOrder,
  verifyPayment,
} from "../controllers/razorpayController.js";
import { authenticate } from "../middlewares/authenticate.js";

const router = express.Router();

/**
 * @swagger
 * /api/razorpay/create-order:
 *   post:
 *     tags:
 *       - Razorpay
 *     summary: Create a razorpay order
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Razorpay order created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *
 * /api/razorpay/verify:
 *   post:
 *     tags:
 *       - Razorpay
 *     summary: Verify razorpay payment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               razorpayPaymentId:
 *                 type: string
 *               razorpayOrderId:
 *                 type: string
 *               razorpaySignature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment verified
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

router.post("/create-order", authenticate, createOrder);
router.post("/verify", authenticate, verifyPayment);

export default router;
