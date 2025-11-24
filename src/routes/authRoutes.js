import express from "express";
import {
  signup,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controllers/authController.js";
import { validate } from "../middlewares/validate.js";
import { authenticate } from "../middlewares/authenticate.js";
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../utils/validationSchemas.js";

const router = express.Router();

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login user and return auth token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

// signup
router.post("/signup", validate(signupSchema), signup);
// login
router.post("/login", validate(loginSchema), login);
// forgot pwd
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
// reset pwd
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);
// change pwd
router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  changePassword
);

export default router;
