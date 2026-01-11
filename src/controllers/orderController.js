import Order from "../models/Order.js";
import Product from "../models/Product.js";
import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createRazorpayOrder } from "../services/razorpayService.js";
import PDFDocument from "pdfkit";
import {
  notifyOrderCreated,
  notifyAdminNewOrder,
  notifyOrderStatusChanged,
  notifyReturnRequestSubmitted,
  notifyAdminReturnRequest,
  notifyReturnRequestApproved,
  notifyReturnRequestRejected,
  notifyReturnCompleted,
} from "../services/orderNotificationService.js";
import axios from "axios";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_TEST_KEY_ID,
  key_secret: process.env.RAZORPAY_TEST_KEY_SECRET,
});
const DELHIVERY_BASE_URL = "https://track.delhivery.com";
const DELHIVERY_API_TOKEN = "7c61e302ae5975c0ad42d6bb555b5b12c9ee3b9c";

function getDelhiveryHeaders() {
  return {
    Authorization: `Token ${DELHIVERY_API_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export const createOrder = asyncHandler(async (req, res) => {
  const { customerId, items, totalAmount, shippingAddress, paymentInfo } =
    req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);

      if (!product) {
        throw new ApiError(404, `Product not found: ${item.productId}`);
      }

      if (product.stock < item.quantity) {
        throw new ApiError(
          400,
          `Insufficient stock for product: ${product.productName}`
        );
      }

      product.stock -= item.quantity;
      await product.save({ session });
    }

    const order = await Order.create(
      [
        {
          customerId,
          items,
          totalAmount,
          shippingAddress,
          paymentInfo,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    res
      .status(201)
      .json(new ApiResponse(201, "Order created successfully", order[0]));
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

export const createOrderByCustomer = asyncHandler(async (req, res) => {
  const { items, totalAmount, shippingAddress } = req.body;
  const customerId = req.user._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);

      if (!product) {
        throw new ApiError(404, `Product not found: ${item.productId}`);
      }

      if (product.stock < item.quantity) {
        throw new ApiError(
          400,
          `Insufficient stock for product: ${product.productName}`
        );
      }

      product.stock -= item.quantity;
      await product.save({ session });
    }

    const razorpayOrder = await createRazorpayOrder(
      totalAmount,
      "INR",
      `order_${Date.now()}`
    );

    const order = await Order.create(
      [
        {
          customerId,
          items,
          totalAmount,
          shippingAddress,
          paymentInfo: {
            razorpayOrderId: razorpayOrder.id,
            status: "pending",
          },
        },
      ],
      { session }
    );

    await session.commitTransaction();

    notifyOrderCreated(order[0]);
    notifyAdminNewOrder(order[0], {
      firstName: req.user.firstName,
      lastName: req.user.lastName,
    });

    res.status(201).json(
      new ApiResponse(201, "Order created successfully", {
        order: order[0],
        razorpayOrder,
      })
    );
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

export const cancelOrderByCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const customerId = req.user._id;

  const order = await Order.findById(id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (order.customerId.toString() !== customerId.toString()) {
    throw new ApiError(403, "Access denied");
  }

  if (!["pending", "confirmed"].includes(order.status)) {
    throw new ApiError(
      400,
      "Order can only be cancelled in pending or confirmed status"
    );
  }

  let refund = null;

  if (
    order.paymentInfo &&
    order.paymentInfo.status === "completed" &&
    order.paymentInfo.razorpayPaymentId
  ) {
    const amountInPaise = Math.round(order.totalAmount * 100);

    refund = await razorpay.payments.refund(
      order.paymentInfo.razorpayPaymentId,
      {
        amount: amountInPaise,
        speed: "normal",
        notes: {
          order_id: order._id.toString(),
          reason: "Customer cancellation before shipping",
        },
      }
    );

    order.paymentInfo.status = "refunded";
  }

  order.status = "cancelled";
  await order.save();

  return res.json(
    new ApiResponse(200, "Order cancelled and refund processed", {
      order,
      refund,
    })
  );
});

export const getAllOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (status) {
    filter.status = status;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const orders = await Order.find(filter)
    .populate("customerId", "firstName lastName email phone")
    .populate("items.productId", "productName")
    .limit(Number(limit))
    .skip(skip)
    .sort({ createdAt: -1 });

  const total = await Order.countDocuments(filter);

  res.json(
    new ApiResponse(200, "Orders retrieved successfully", {
      orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    })
  );
});

export const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findById(id)
    .populate("customerId", "firstName lastName email phone")
    .populate("items.productId", "productName productImages");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (
    req.user.role === "customer" &&
    order.customerId._id.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(403, "Access denied");
  }

  res.json(new ApiResponse(200, "Order retrieved successfully", order));
});

export const updateOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const order = await Order.findById(id);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const allowedUpdates = ["status", "shippingAddress"];
  Object.keys(updates).forEach((key) => {
    if (allowedUpdates.includes(key)) {
      order[key] = updates[key];
    }
  });

  await order.save();

  res.json(new ApiResponse(200, "Order updated successfully", order));
});

export const deleteOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findByIdAndDelete(id);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  res.json(new ApiResponse(200, "Order deleted successfully"));
});

export const changeOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = [
    "pending",
    "confirmed",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
  ];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, "Invalid status");
  }

  const order = await Order.findById(id);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const oldStatus = order.status;
  order.status = status;
  await order.save();

  notifyOrderStatusChanged(order, oldStatus, status);

  res.json(new ApiResponse(200, "Order status updated successfully", order));
});

export const generateInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findById(id)
    .populate("customerId", "firstName lastName email phone")
    .populate("items.productId", "productName");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (
    req.user.role === "customer" &&
    order.customerId._id.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(403, "Access denied");
  }

  const doc = new PDFDocument();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=invoice-${order._id}.pdf`
  );

  doc.pipe(res);

  doc.fontSize(20).text("INVOICE", { align: "center" });
  doc.moveDown();

  doc.fontSize(12).text(`Order ID: ${order._id}`);
  doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`);
  doc.text(`Status: ${order.status}`);
  doc.moveDown();

  doc.fontSize(14).text("Customer Details:");
  doc
    .fontSize(10)
    .text(`Name: ${order.customerId.firstName} ${order.customerId.lastName}`);
  doc.text(`Email: ${order.customerId.email}`);
  doc.text(`Phone: ${order.customerId.phone}`);
  doc.moveDown();

  doc.fontSize(14).text("Shipping Address:");
  doc.fontSize(10).text(order.shippingAddress.address);
  doc.text(
    `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.pincode}`
  );
  doc.text(order.shippingAddress.country);
  doc.moveDown();

  doc.fontSize(14).text("Items:");
  doc.moveDown(0.5);

  order.items.forEach((item, index) => {
    doc
      .fontSize(10)
      .text(
        `${index + 1}. ${item.name} - Qty: ${item.quantity} x Rs.${(
          item.price / 100
        ).toFixed(2)} = Rs.${(item.subtotal / 100).toFixed(2)}`
      );
  });

  doc.moveDown();
  doc
    .fontSize(14)
    .text(`Total Amount: Rs.${order.totalAmount}`, { align: "right" });
  doc.end();
});

export const getOrderSummary = asyncHandler(async (req, res) => {
  const totalOrders = await Order.countDocuments();
  const totalRevenue = await Order.aggregate([
    { $match: { status: { $nin: ["cancelled", "refunded"] } } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } },
  ]);

  const ordersByStatus = await Order.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const summary = {
    totalOrders,
    totalRevenue: totalRevenue[0]?.total || 0,
    ordersByStatus: ordersByStatus.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
  };

  res.json(
    new ApiResponse(200, "Order summary retrieved successfully", summary)
  );
});

export const getAllCustomerOrdersSummary = asyncHandler(async (req, res) => {
  const customerId = req.user._id;

  const orders = await Order.find({ customerId })
    .populate("items.productId", "productName productImages")
    .sort({ createdAt: -1 });

  const totalSpent = orders
    .filter((order) => !["cancelled", "refunded"].includes(order.status))
    .reduce((sum, order) => sum + order.totalAmount, 0);

  const summary = {
    totalOrders: orders.length,
    totalSpent,
    orders,
  };

  res.json(
    new ApiResponse(
      200,
      "Customer orders summary retrieved successfully",
      summary
    )
  );
});

export const getOrdersByCustomerId = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const orders = await Order.find({ customerId: id })
    .populate("items.productId", "productName productImages")
    .sort({ createdAt: -1 });

  res.json(
    new ApiResponse(200, "Customer orders retrieved successfully", orders)
  );
});

export const submitReturnRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason, reasonCategory } = req.body;
  const customerId = req.user._id;

  if (!reason || !reasonCategory) {
    throw new ApiError(400, "Reason and reason category are required");
  }

  const validCategories = [
    "defective",
    "wrong_item",
    "not_as_described",
    "damaged",
    "size_issue",
    "quality_issue",
    "changed_mind",
    "other",
  ];

  if (!validCategories.includes(reasonCategory)) {
    throw new ApiError(400, "Invalid reason category");
  }

  const order = await Order.findById(id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (order.customerId.toString() !== customerId.toString()) {
    throw new ApiError(403, "Access denied");
  }

  if (order.status !== "delivered") {
    throw new ApiError(400, "Only delivered orders can be returned");
  }

  if (!order.isReturnable) {
    throw new ApiError(400, "This order is not eligible for return");
  }

  if (order.returnRequest && order.returnRequest.requestStatus === "pending") {
    throw new ApiError(
      400,
      "A return request is already pending for this order"
    );
  }

  const deliveryDate = order.updatedAt;
  const currentDate = new Date();
  const daysSinceDelivery = Math.floor(
    (currentDate - deliveryDate) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceDelivery > order.returnWindowDays) {
    throw new ApiError(
      400,
      `Return window of ${order.returnWindowDays} days has expired`
    );
  }

  const imageUrls = req.files
    ? req.files.map((file) => `uploads/${file.filename}`)
    : [];

  order.returnRequest = {
    requestedBy: customerId,
    reason: reason.trim(),
    reasonCategory,
    images: imageUrls,
    requestStatus: "pending",
    requestedAt: new Date(),
  };

  order.status = "return_requested";
  await order.save();

  notifyReturnRequestSubmitted(order);
  notifyAdminReturnRequest(order, {
    firstName: req.user.firstName,
    lastName: req.user.lastName,
  });

  res
    .status(200)
    .json(new ApiResponse(200, "Return request submitted successfully", order));
});

export const approveReturnRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { adminComment, refundAmount } = req.body;
  const adminId = req.user._id;

  const order = await Order.findById(id)
    .populate("customerId", "firstName lastName email")
    .populate("items.productId", "productName");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (!order.returnRequest) {
    throw new ApiError(400, "No return request found for this order");
  }

  if (order.returnRequest.requestStatus !== "pending") {
    throw new ApiError(400, "Return request has already been processed");
  }

  order.returnRequest.requestStatus = "approved";
  order.returnRequest.reviewedBy = adminId;
  order.returnRequest.reviewedAt = new Date();
  order.returnRequest.adminComment = adminComment?.trim() || "Return approved";
  order.returnRequest.refundAmount = refundAmount || order.totalAmount;
  order.returnRequest.refundStatus = "not_initiated";

  order.status = "return_approved";
  await order.save();

  notifyReturnRequestApproved(order);

  res
    .status(200)
    .json(new ApiResponse(200, "Return request approved successfully", order));
});

export const rejectReturnRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { adminComment } = req.body;
  const adminId = req.user._id;

  if (!adminComment) {
    throw new ApiError(400, "Admin comment is required for rejection");
  }

  const order = await Order.findById(id)
    .populate("customerId", "firstName lastName email")
    .populate("items.productId", "productName");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (!order.returnRequest) {
    throw new ApiError(400, "No return request found for this order");
  }

  if (order.returnRequest.requestStatus !== "pending") {
    throw new ApiError(400, "Return request has already been processed");
  }

  order.returnRequest.requestStatus = "rejected";
  order.returnRequest.reviewedBy = adminId;
  order.returnRequest.reviewedAt = new Date();
  order.returnRequest.adminComment = adminComment.trim();

  order.status = "return_rejected";
  await order.save();

  notifyReturnRequestRejected(order);

  res.status(200).json(new ApiResponse(200, "Return request rejected", order));
});

export const completeReturnRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(id)
      .populate("customerId", "firstName lastName email")
      .populate("items.productId")
      .session(session);

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    if (!order.returnRequest) {
      throw new ApiError(400, "No return request found for this order");
    }

    if (order.returnRequest.requestStatus !== "approved") {
      throw new ApiError(400, "Only approved return requests can be completed");
    }

    for (const item of order.items) {
      const product = await Product.findById(item.productId._id).session(
        session
      );
      if (product) {
        product.stock += item.quantity;
        await product.save({ session });
      }
    }

    order.returnRequest.requestStatus = "completed";
    order.returnRequest.refundStatus = "processing";
    order.status = "return_completed";
    order.paymentInfo.status = "refunded";

    await order.save({ session });

    await session.commitTransaction();

    notifyReturnCompleted(order);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Return completed and refund initiated successfully",
          order
        )
      );
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

export const getAllReturnRequests = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const filter = { returnRequest: { $exists: true, $ne: null } };

  if (status) {
    filter["returnRequest.requestStatus"] = status;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const orders = await Order.find(filter)
    .populate("customerId", "firstName lastName email phone")
    .populate("returnRequest.requestedBy", "firstName lastName email")
    .populate("returnRequest.reviewedBy", "firstName lastName")
    .populate("items.productId", "productName productImages")
    .limit(Number(limit))
    .skip(skip)
    .sort({ "returnRequest.requestedAt": -1 });

  const total = await Order.countDocuments(filter);

  res.json(
    new ApiResponse(200, "Return requests retrieved successfully", {
      returnRequests: orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    })
  );
});

export const getMyReturnRequests = asyncHandler(async (req, res) => {
  const customerId = req.user._id;

  const orders = await Order.find({
    customerId,
    returnRequest: { $exists: true, $ne: null },
  })
    .populate("items.productId", "productName productImages")
    .populate("returnRequest.reviewedBy", "firstName lastName")
    .sort({ "returnRequest.requestedAt": -1 });

  res.json(
    new ApiResponse(200, "Your return requests retrieved successfully", orders)
  );
});

export const cancelReturnRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const customerId = req.user._id;

  const order = await Order.findById(id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (order.customerId.toString() !== customerId.toString()) {
    throw new ApiError(403, "Access denied");
  }

  if (!order.returnRequest) {
    throw new ApiError(400, "No return request found for this order");
  }

  if (order.returnRequest.requestStatus !== "pending") {
    throw new ApiError(400, "Only pending return requests can be cancelled");
  }

  order.returnRequest = null;
  order.status = "delivered";
  await order.save();

  res
    .status(200)
    .json(new ApiResponse(200, "Return request cancelled successfully", order));
});

export const shipOrderWithDelhivery = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findById(id).populate(
    "customerId",
    "firstName lastName phone email"
  );

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (order.waybill) {
    return res.json(
      new ApiResponse(200, "Shipment already created for this order", order)
    );
  }

  if (!order.shippingAddress) {
    throw new ApiError(400, "Shipping address missing for this order");
  }

  const isPrepaid = order.paymentInfo?.status === "completed";

  // Pickup location validation
  const pickup_location = {
    name: process.env.PICKUP_NAME,
    add: process.env.PICKUP_ADDRESS,
    city: process.env.PICKUP_CITY,
    state: process.env.PICKUP_STATE,
    country: "India",
    pin: process.env.PICKUP_PINCODE,
    phone: `+91${process.env.PICKUP_PHONE}`,
  };

  if (!pickup_location.name || !pickup_location.pin) {
    throw new ApiError(500, "Pickup location is not configured properly");
  }

  const dataPayload = {
    shipments: [
      {
        order: `${order._id.toString()}_${Date.now()}`, 
        waybill: "",
        add: order.shippingAddress.address,
        name: `${order.customerId.firstName} ${order.customerId.lastName}`,
        phone: `+91${order.customerId.phone}`,
        pin: order.shippingAddress.pincode, 
        order_date: new Date().toISOString(),
        payment_mode: isPrepaid ? "Prepaid" : "Pickup/COD",
        cod_amount: isPrepaid ? 0 : order.totalAmount,
        shipping_mode: "Express",
        products_desc: "E-commerce Order",
        quantity: "1",
        total_weight: "0.5", // Required
        declared_value: order.totalAmount.toString(), 
      },
    ],
    pickup_location,
  };

  const params = new URLSearchParams();
  params.append("format", "json");
  params.append("data", JSON.stringify(dataPayload));

  console.log("=== Delhivery Request Payload ===");
  console.log(JSON.stringify(dataPayload, null, 2));

  const response = await axios.post(
    `${DELHIVERY_BASE_URL}/api/cmu/create.json`,
    params.toString(),
    {
      headers: {
        ...getDelhiveryHeaders(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const dlvData = response.data;
  console.log("=== Delhivery Response ===");
  console.log(JSON.stringify(dlvData, null, 2));

  const waybill = dlvData?.packages?.[0]?.waybill || null;

  if (!waybill) {
    const remarksText = Array.isArray(dlvData?.packages?.[0]?.remarks)
      ? dlvData.packages[0].remarks.join(" | ")
      : dlvData?.rmk || "No remarks provided";

    console.error("Delhivery response (no waybill):", dlvData);
    throw new ApiError(
      502,
      `Delhivery failed to create shipment. Remarks: ${remarksText}`
    );
  }

  // Save order
  order.waybill = waybill;
  order.courier = "delhivery";
  order.status = "shipped";
  await order.save();

  return res.json(
    new ApiResponse(200, "Shipment created successfully", {
      order,
      waybill,
      delhivery: dlvData,
    })
  );
});

