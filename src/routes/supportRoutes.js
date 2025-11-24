import express from "express";
import {
  createSupportTicket,
  getSupportTicketsByCustomer,
  getAllSupportTickets,
  getSupportTicketById,
  updateSupportTicket,
  changeSupportTicketStatus,
  deleteSupportTicket,
} from "../controllers/supportController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import { supportSchema } from "../utils/validationSchemas.js";

const router = express.Router();

/**
 * @swagger
 * /api/support:
 *   post:
 *     tags:
 *       - Support
 *     summary: Create a support ticket (customer)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Support'
 *     responses:
 *       201:
 *         description: Support ticket created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *
 * /api/support/{id}:
 *   get:
 *     tags:
 *       - Support
 *     summary: Get support ticket by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Support ticket
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
// create support ticket
router.post(
  "/",
  authenticate,
  authorize("customer"),
  validate(supportSchema),
  createSupportTicket
);
// get ticket by customer id
router.get("/customer/:customerId", authenticate, getSupportTicketsByCustomer);
// get all tickets
router.get(
  "/",
  authenticate,
  authorize("admin", "userpannel"),
  getAllSupportTickets
);
// get ticket by id
router.get(
  "/:id",
  authenticate,
  authorize("admin", "userpannel"),
  getSupportTicketById
);
// update ticket
router.put(
  "/:id",
  authenticate,
  authorize("admin", "userpannel"),
  updateSupportTicket
);
// change ticket status
router.patch(
  "/:id/status",
  authenticate,
  authorize("admin", "userpannel"),
  changeSupportTicketStatus
);
// delete ticket
router.delete(
  "/:id",
  authenticate,
  authorize("admin", "userpannel"),
  deleteSupportTicket
);

export default router;
