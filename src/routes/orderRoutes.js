import express from "express";
import {
  createOrder,
  createOrderByCustomer,
  getAllOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  changeOrderStatus,
  generateInvoice,
  getOrderSummary,
  getAllCustomerOrdersSummary,
  getOrdersByCustomerId,
} from "../controllers/orderController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import { customerOrderSchema, orderSchema } from "../utils/validationSchemas.js";

const router = express.Router();

/**
 * @swagger
 * /api/orders/createOrder:
 *   post:
 *     tags:
 *       - Orders
 *     summary: Create a new order (admin/userpannel)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Order'
 *     responses:
 *       201:
 *         description: Order created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *
 * /api/orders/getAllOrders:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Get all orders (admin/userpannel)
 *     responses:
 *       200:
 *         description: List of orders
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

// create order
router.post(
  "/createOrder",
  authenticate,
  authorize("admin", "userpannel"),
  validate(orderSchema),
  createOrder
);
// create order by customer
router.post(
  "/createOrderByCustomer",
  authenticate,
  authorize("customer"),
  validate(customerOrderSchema),
  createOrderByCustomer
);
// get all orders
router.get(
  "/getAllOrders",
  authenticate,
  authorize("admin", "userpannel"),
  getAllOrders
);
// get order summary
router.get(
  "/summary",
  authenticate,
  authorize("admin", "userpannel"),
  getOrderSummary
);
// get order (customer)
router.get(
  "/customer",
  authenticate,
  authorize("customer"),
  getAllCustomerOrdersSummary
);
// get order by customer id
router.get(
  "/getOrdersByCustomerId/:id",
  authenticate,
  authorize("admin", "userpannel"),
  getOrdersByCustomerId
);
// get order by id
router.get("/getOrders/:id", authenticate, getOrderById);
// get invoice
router.get("/:id/invoice", authenticate, generateInvoice);
// update order
router.patch(
  "/updateOrdersById/:id",
  authenticate,
  authorize("admin", "userpannel"),
  updateOrder
);
// update order status
router.patch(
  "/updateOrdersStatus/:id/status",
  authenticate,
  authorize("admin", "userpannel"),
  changeOrderStatus
);
// delete order
router.delete("/:id", authenticate, authorize("admin"), deleteOrder);

export default router;
