import express from "express";
import {
  createUser,
  updateUser,
  activateUser,
  deleteUser,
  getAllUsers,
  getUserById,
} from "../controllers/userController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import {
  createUserSchema,
  updateUserSchema,
} from "../utils/validationSchemas.js";

const router = express.Router();

/**
 * @swagger
 * /api/users:
 *   post:
 *     tags:
 *       - Users
 *     summary: Create a new user (admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *   get:
 *     tags:
 *       - Users
 *     summary: Get all users (admin/userpannel)
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *
 * /api/users/{id}:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get user by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

// create user
router.post("/", validate(createUserSchema), createUser);
// get user
router.get("/", authenticate, authorize("admin", "userpannel"), getAllUsers);
// get user by id
router.get("/:id", authenticate, authorize("admin", "userpannel"), getUserById);
// update user
router.put(
  "/:id",
  authenticate,
  authorize("admin", "userpannel"),
  validate(updateUserSchema),
  updateUser
);
// activate/deactivate user
router.patch(
  "/:id/activate",
  authenticate,
  authorize("admin", "userpannel"),
  activateUser
);
// delete user
router.delete("/:id", authenticate, authorize("admin"), deleteUser);

export default router;
