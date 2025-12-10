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
  submitReturnRequest,
  approveReturnRequest,
  rejectReturnRequest,
  completeReturnRequest,
  getAllReturnRequests,
  getMyReturnRequests,
  cancelReturnRequest,
  cancelOrderByCustomer,
  shipOrderWithDelhivery,
} from "../controllers/orderController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import {
  customerOrderSchema,
  orderSchema,
} from "../utils/validationSchemas.js";
import { upload } from "../middlewares/multer.js";

const router = express.Router();

router.post(
  "/createOrder",
  authenticate,
  authorize("admin", "userpannel"),
  validate(orderSchema),
  createOrder
);

router.post(
  "/createOrderByCustomer",
  authenticate,
  authorize("customer"),
  validate(customerOrderSchema),
  createOrderByCustomer
);

router.post(
  "/:id/cancel-by-customer",
  authenticate,
  authorize("customer"),
  cancelOrderByCustomer
);

router.get(
  "/getAllOrders",
  authenticate,
  authorize("admin", "userpannel"),
  getAllOrders
);

router.get(
  "/summary",
  authenticate,
  authorize("admin", "userpannel"),
  getOrderSummary
);

router.get(
  "/customer",
  authenticate,
  authorize("customer"),
  getAllCustomerOrdersSummary
);

router.get(
  "/getOrdersByCustomerId/:id",
  authenticate,
  authorize("admin", "userpannel"),
  getOrdersByCustomerId
);

router.get(
  "/return-requests",
  authenticate,
  authorize("admin", "userpannel"),
  getAllReturnRequests
);

router.get(
  "/my-return-requests",
  authenticate,
  authorize("customer"),
  getMyReturnRequests
);

router.post(
  "/:id/return-request",
  authenticate,
  authorize("customer"),
  upload.array("images", 5),
  submitReturnRequest
);
router.post(
  "/:id/return-request/approve",
  authenticate,
  authorize("admin", "userpannel"),
  approveReturnRequest
);

router.post(
  "/:id/return-request/reject",
  authenticate,
  authorize("admin", "userpannel"),
  rejectReturnRequest
);

router.post(
  "/:id/return-request/complete",
  authenticate,
  authorize("admin", "userpannel"),
  completeReturnRequest
);

router.post(
  "/:id/return-request/cancel",
  authenticate,
  authorize("customer"),
  cancelReturnRequest
);

router.get("/getOrders/:id", authenticate, getOrderById);

router.get("/:id/invoice", authenticate, generateInvoice);

router.patch(
  "/updateOrdersById/:id",
  authenticate,
  authorize("admin", "userpannel"),
  updateOrder
);

router.patch(
  "/updateOrdersStatus/:id/status",
  authenticate,
  authorize("admin", "userpannel"),
  changeOrderStatus
);

router.post(
  "/:id/ship-with-delhivery",
  authenticate,
  authorize("admin", "userpannel"),
  shipOrderWithDelhivery
);
router.delete("/:id", authenticate, authorize("admin"), deleteOrder);

export default router;
