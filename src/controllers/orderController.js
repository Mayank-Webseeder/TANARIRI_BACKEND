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
import bwipjs from "bwip-js";
import fs from "fs";
import path from "path";
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
          `Insufficient stock for product: ${product.productName}`,
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
      { session },
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
          `Insufficient stock for product: ${product.productName}`,
        );
      }

      product.stock -= item.quantity;
      await product.save({ session });
    }

    const razorpayOrder = await createRazorpayOrder(
      totalAmount,
      "INR",
      `order_${Date.now()}`,
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
      { session },
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
      }),
    );
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// export const createOrderByCustomer = asyncHandler(async (req, res) => {
//   const { items, shippingAddress } = req.body;
//   const customerId = req.user._id;

//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     let calculatedTotal = 0;
//     const finalItems = [];

//     for (const item of items) {
//       const product = await Product.findById(item.productId).session(session);

//       if (!product) {
//         throw new ApiError(404, "Product not found");
//       }

//       if (product.stock < item.quantity) {
//         throw new ApiError(400, "Insufficient stock");
//       }

//       const price = product.discountPrice; // ₹200 (STORE RUPEES)
//       const subtotal = price * item.quantity;

//       finalItems.push({
//         productId: product._id,
//         name: product.productName,
//         price,        // ₹200
//         quantity: item.quantity,
//         subtotal,     // ₹400
//       });

//       calculatedTotal += subtotal;

//       product.stock -= item.quantity;
//       await product.save({ session });
//     }

//     // shipping ₹20 example
//     calculatedTotal += 20;

//     // ✅ ONLY HERE convert to paise
//     const razorpayOrder = await createRazorpayOrder(
//       calculatedTotal * 100, // paise
//       "INR",
//       `order_${Date.now()}`
//     );

//     const order = await Order.create(
//       [{
//         customerId,
//         items: finalItems,
//         totalAmount: calculatedTotal, // ₹420
//         shippingAddress,
//         paymentInfo: {
//           razorpayOrderId: razorpayOrder.id,
//           status: "pending",
//         },
//       }],
//       { session }
//     );

//     await session.commitTransaction();

//     res.status(201).json(
//       new ApiResponse(201, "Order created successfully", {
//         order: order[0],
//         razorpayOrder,
//       })
//     );
//   } catch (err) {
//     await session.abortTransaction();
//     throw err;
//   } finally {
//     session.endSession();
//   }
// });

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
      "Order can only be cancelled in pending or confirmed status",
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
      },
    );

    order.paymentInfo.status = "refunded";
  }

  order.status = "cancelled";
  await order.save();

  return res.json(
    new ApiResponse(200, "Order cancelled and refund processed", {
      order,
      refund,
    }),
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
    }),
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
    `attachment; filename=invoice-${order._id}.pdf`,
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
    `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.pincode}`,
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
        ).toFixed(2)} = Rs.${(item.subtotal / 100).toFixed(2)}`,
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
    new ApiResponse(200, "Order summary retrieved successfully", summary),
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
      summary,
    ),
  );
});

export const getOrdersByCustomerId = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const orders = await Order.find({ customerId: id })
    .populate("items.productId", "productName productImages")
    .sort({ createdAt: -1 });

  res.json(
    new ApiResponse(200, "Customer orders retrieved successfully", orders),
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
      "A return request is already pending for this order",
    );
  }

  const deliveryDate = order.updatedAt;
  const currentDate = new Date();
  const daysSinceDelivery = Math.floor(
    (currentDate - deliveryDate) / (1000 * 60 * 60 * 24),
  );

  if (daysSinceDelivery > order.returnWindowDays) {
    throw new ApiError(
      400,
      `Return window of ${order.returnWindowDays} days has expired`,
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
    .populate("customerId", "firstName lastName phone email")
    .populate("items.productId");

  if (
    !order ||
    !order.returnRequest ||
    order.returnRequest.requestStatus !== "pending"
  ) {
    throw new ApiError(400, "Invalid return request");
  }

  if (!order.waybill) {
    throw new ApiError(400, "No forward shipment for return");
  }

  // Delhivery Return Shipment
  const returnPayload = {
    cod_amount: 0,
    shipments: [
      {
        order: `RETURN_${order._id}_${Date.now()}`,
        waybill: "",
        add: order.shippingAddress.address,
        name: `${order.customerId.firstName} ${order.customerId.lastName}`,
        phone: order.customerId.phone,
        pin: order.shippingAddress.pincode,
        order_date: new Date().toISOString(),
        payment_mode: "Pickup",
        cod_amount: "0",
        shipping_mode: "Surface",
        products_desc: order.items
          .map((i) => `${i.name} x${i.quantity}`)
          .join(", "),
        quantity: order.items
          .reduce((sum, i) => sum + i.quantity, 0)
          .toString(),
        total_weight: "1.5",
        declared_value: order.totalAmount.toString(),
        customer_reference: order.waybill,
      },
    ],
    pickup_location: {
      name: process.env.PICKUP_NAME || "Test Name",
      add: process.env.PICKUP_ADDRESS,
      city: process.env.PICKUP_CITY,
      state: process.env.PICKUP_STATE,
      pin: process.env.PICKUP_PINCODE,
      phone: `+91${process.env.PICKUP_PHONE}`,
    },
  };

  const params = new URLSearchParams();
  params.append("format", "json");
  params.append("data", JSON.stringify(returnPayload));

  const response = await axios.post(
    `${DELHIVERY_BASE_URL}/api/cmu/create.json`,
    params.toString(),
    {
      headers: {
        ...getDelhiveryHeaders(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  const returnData = response.data;
  const returnWaybill = returnData?.packages?.[0]?.waybill;

  if (!returnWaybill) {
    throw new ApiError(
      502,
      `Return shipment failed: ${returnData?.rmk || "Unknown"}`,
    );
  }

  order.returnRequest.requestStatus = "approved";
  order.returnRequest.reviewedBy = adminId;
  order.returnRequest.reviewedAt = new Date();
  order.returnRequest.adminComment = adminComment?.trim() || "Return approved";
  order.returnRequest.refundAmount = refundAmount || order.totalAmount;
  order.returnWaybill = returnWaybill;
  order.status = "return_approved";

  await order.save();

  res.json(
    new ApiResponse(200, "Return approved & shipment created", {
      order,
      returnWaybill,
      delhivery: returnData,
    }),
  );
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
        session,
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
          order,
        ),
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
    }),
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
    new ApiResponse(200, "Your return requests retrieved successfully", orders),
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
    "firstName lastName phone email",
  );

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (order.waybill) {
    return res.json(
      new ApiResponse(200, "Shipment already created for this order", order),
    );
  }

  if (!order.shippingAddress) {
    throw new ApiError(400, "Shipping address missing for this order");
  }

  const isPrepaid = order.paymentInfo?.status === "completed";

  // Dynamic products description & quantity
  const productsDesc = order.items
    .map((item) => `${item.name} x${item.quantity}`)
    .join(", ");

  const totalQuantity = order.items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

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
    cod_amount: isPrepaid ? 0 : parseInt(order.totalAmount),
    shipments: [
      {
        order: `${order._id.toString()}_${Date.now()}`,
        waybill: "",
        add: order.shippingAddress.address,
        name: `${order.customerId.firstName} ${order.customerId.lastName}`,
        phone: `+91${order.customerId.phone}`,
        pin: order.shippingAddress.pincode,
        order_date: new Date().toISOString(),
        payment_mode: isPrepaid ? "Prepaid" : "COD",
        cod_amount: parseInt(order.totalAmount).toString(),
        shipping_mode: "Surface",
        products_desc: productsDesc || "E-commerce Order",
        quantity: totalQuantity.toString(),
        total_weight: "1.5",
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
    },
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
      `Delhivery failed to create shipment. Remarks: ${remarksText}`,
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
    }),
  );
});

export const cancelShipment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await Order.findById(id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (!order.waybill) {
    throw new ApiError(
      400,
      "Waybill not found. This order is not shipped yet.",
    );
  }

  if (order.status === "cancelled") {
    throw new ApiError(400, "Order is already cancelled.");
  }

  try {
    const delhiveryResponse = await axios.post(
      `${DELHIVERY_BASE_URL}/api/p/edit`,
      {
        waybill: order.waybill,
        cancellation: true,
      },
      {
        headers: {
          ...getDelhiveryHeaders(),
          "Content-Type": "application/json",
        },
      },
    );

    if (delhiveryResponse.data?.status === false) {
      throw new ApiError(
        400,
        delhiveryResponse.data.error ||
          "Failed to cancel shipment at Delhivery.",
      );
    }

    order.status = "cancelled";
    order.trackingStatus = "Cancelled";
    await order.save();

    return res.status(200).json(
      new ApiResponse(200, "Shipment cancelled successfully", {
        orderId: order._id,
        waybill: order.waybill,
        status: order.status,
      }),
    );
  } catch (error) {
    console.error(
      "Shipment Cancellation Error:",
      error.response?.data || error.message,
    );
    throw new ApiError(
      error.response?.status || 502,
      error.response?.data?.error ||
        "Failed to cancel shipment with Delhivery.",
    );
  }
});

export const downloadShippingLabel = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await Order.findById(id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (!order.waybill) {
    throw new ApiError(
      400,
      "Waybill not found. Please create the shipment first.",
    );
  }

  try {
    const delhiveryResponse = await axios.get(
      `${DELHIVERY_BASE_URL}/api/p/packing_slip?wbns=${order.waybill}`,
      { headers: getDelhiveryHeaders() },
    );

    const labelData = delhiveryResponse.data?.packages?.[0];

    if (!labelData) {
      throw new ApiError(
        400,
        "Delhivery did not return data for this waybill.",
      );
    }

    const doc = new PDFDocument({ size: [400, 600], margin: 0 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Shipping_Label_${order.waybill}.pdf`,
    );

    doc.pipe(res);

    doc.lineWidth(1).rect(15, 15, 370, 570).stroke();

    const tanaririLogoPath = path.join(
      process.cwd(),
      "src",
      "assets",
      "client-logo.jpg",
    );
    const delhiveryLogoPath = path.join(
      process.cwd(),
      "src",
      "assets",
      "delhivery.png",
    );

    if (fs.existsSync(tanaririLogoPath)) {
      doc.image(tanaririLogoPath, 25, 20, { width: 80, height: 35 });
    } else {
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("#db2777")
        .text("TANA RIRI", 25, 30);
    }

    if (fs.existsSync(delhiveryLogoPath)) {
      doc.image(delhiveryLogoPath, 230, 20, { width: 130, height: 30 });
    } else {
      doc
        .fillColor("black")
        .fontSize(22)
        .font("Helvetica-Bold")
        .text("DELHIVERY", 230, 25, { width: 145, align: "right" });
    }

    doc.moveTo(15, 65).lineTo(385, 65).stroke();

    doc
      .fillColor("black")
      .fontSize(10)
      .font("Helvetica")
      .text(`AWB# ${labelData.wbn}`, 25, 75);

    if (labelData.barcode) {
      const awbBase64 = labelData.barcode.replace(
        /^data:image\/(png|jpeg);base64,/,
        "",
      );
      const awbBuffer = Buffer.from(awbBase64, "base64");
      doc.image(awbBuffer, 50, 90, { width: 300, height: 65 });
    }

    doc.fontSize(8).font("Helvetica");
    doc.text(labelData.pin, 25, 165);
    doc
      .font("Helvetica-Bold")
      .text(`AWB# ${labelData.wbn}`, 0, 165, { align: "center" });
    doc.font("Helvetica").text(labelData.sort_code || "DEL/MPP", 330, 165);
    doc.moveTo(15, 185).lineTo(385, 185).stroke();

    doc
      .font("Helvetica")
      .fontSize(10)
      .text("Ship to - ", 25, 195, { continued: true })
      .font("Helvetica-Bold")
      .text(labelData.name);
    doc
      .font("Helvetica")
      .fontSize(8)
      .text(labelData.address, 25, 210, { width: 220 });
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(labelData.destination, 25, 240);
    doc.text(`PIN - ${labelData.pin}`, 25, 260);

    doc.moveTo(260, 185).lineTo(260, 285).stroke();

    const isPrepaid = labelData.pt !== "COD";
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(isPrepaid ? "Prepaid - Surface" : "COD - Surface", 270, 195);
    doc.fontSize(12).text(`INR ${labelData.rs}`, 270, 215);
    doc.font("Helvetica").fontSize(8).text("Date", 270, 245);

    const orderDate = new Date(labelData.cd);
    const dateStr = orderDate
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .replace(/ /g, "-");
    const timeStr = orderDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    doc.text(`${dateStr} | ${timeStr}`, 270, 255);

    doc.moveTo(15, 285).lineTo(385, 285).stroke();

    const sellerName = process.env.PICKUP_NAME || "TANARIRI OVERSEAS LLP";
    doc
      .font("Helvetica")
      .fontSize(8)
      .text("Seller:", 25, 295, { continued: true })
      .font("Helvetica-Bold")
      .text(sellerName);
    doc.font("Helvetica").text(labelData.sadd, 25, 310);

    doc.moveTo(260, 285).lineTo(260, 355).stroke();

    let displayOid = labelData.oid;
    if (displayOid && displayOid.length > 20) {
      displayOid = displayOid.substring(0, 20) + "...";
    }
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(displayOid, 270, 290, { width: 110 });

    if (labelData.oid_barcode) {
      const oidBase64 = labelData.oid_barcode.replace(
        /^data:image\/(png|jpeg);base64,/,
        "",
      );
      const oidBuffer = Buffer.from(oidBase64, "base64");
      doc.image(oidBuffer, 270, 320, { width: 100, height: 25 });
    }

    doc.moveTo(15, 355).lineTo(385, 355).stroke();

    doc.font("Helvetica-Bold").fontSize(8);
    doc.text("Product Name", 25, 365);
    doc.text("Qty.", 280, 365);
    doc.text("Price", 320, 365);
    doc.text("Total", 350, 365);
    doc.moveTo(15, 380).lineTo(385, 380).stroke();

    doc.font("Helvetica").fontSize(8);
    doc.text(labelData.prd, 25, 390, { width: 240 });
    doc.text(labelData.qty.toString(), 285, 390);

    const itemPrice = labelData.rs;
    const itemTotal = labelData.rs;

    doc.text(itemPrice.toString(), 320, 390);
    doc.text(itemTotal.toString(), 350, 390);

    doc.fontSize(7).text(`Return Address: ${labelData.radd}`, 25, 575);
    doc.text("Page 1 of 1", 340, 575);

    doc.end();
  } catch (error) {
    throw new ApiError(
      502,
      "Failed to generate shipping label from Delhivery data.",
    );
  }
});

export const scheduleOrderPickup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { pickupDate, pickupTime } = req.body;

  const order = await Order.findById(id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (!order.waybill) {
    throw new ApiError(400, "Waybill is missing. Create the shipment first.");
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const formattedDate = pickupDate || tomorrow.toISOString().split("T")[0];
  const formattedTime = pickupTime || "10:00:00";

  const pickupPayload = {
    pickup_time: formattedTime,
    pickup_date: formattedDate,
    pickup_location: process.env.PICKUP_NAME,
    expected_package_count: 1,
  };

  try {
    const response = await axios.post(
      `${DELHIVERY_BASE_URL}/fm/request/new/`,
      pickupPayload,
      {
        headers: getDelhiveryHeaders(),
      },
    );

    order.trackingStatus = "Pickup Scheduled";
    order.status = "in_transit";
    await order.save();

    return res.status(200).json(
      new ApiResponse(200, "Pickup scheduled successfully", {
        orderId: order._id,
        waybill: order.waybill,
        delhiveryResponse: response.data,
      }),
    );
  } catch (error) {
    console.error(
      "Delhivery Pickup Error:",
      error.response?.data || error.message,
    );
    throw new ApiError(
      502,
      `Delhivery pickup failed: ${error.response?.data?.message || error.message}`,
    );
  }
});

// Track shipment status
export const trackDelhiveryShipment = asyncHandler(async (req, res) => {
  const { waybill } = req.params;

  const endpoints = [
    `${DELHIVERY_BASE_URL}/api/pms/?filter=waybill:${waybill}`,
    `${DELHIVERY_BASE_URL}/api/pms/waybill/${waybill}`,
    `${DELHIVERY_BASE_URL}/api/pms/?waybill=${waybill}`,
    `https://track.delhivery.com/api/pms/?filter=waybill:${waybill}`,
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Trying endpoint: ${endpoint}`);

      const response = await axios.get(endpoint, {
        headers: {
          ...getDelhiveryHeaders(),
          "Content-Type": "application/json",
        },
        timeout: 5000,
      });

      const data = response.data;

      // Success - return tracking data
      return res.json(
        new ApiResponse(200, "Tracking found", {
          waybill,
          status: data.status || data.current_status?.status,
          events: data.events || data.scan_details || [],
          eta: data.eta,
          courier: "Delhivery",
        }),
      );
    } catch (error) {
      console.log(`Endpoint failed: ${endpoint} - ${error.response?.status}`);
      continue; // Try next endpoint
    }
  }

  // All endpoints failed
  res.status(404).json(
    new ApiResponse(404, "Waybill not found or too early", {
      waybill,
      message: "Shipment may take 30 mins to appear in tracking",
    }),
  );
});

// Public tracking endpoint
export const publicTrackShipment = asyncHandler(async (req, res) => {
  const { waybill } = req.params;

  try {
    const response = await axios.get(
      `${DELHIVERY_BASE_URL}/api/pms/?filter=waybill:${waybill}`,
      {
        headers: getDelhiveryHeaders(),
        timeout: 10000,
      },
    );

    const data = response.data;

    if (data.current_status?.status === "Delivered") {
      await sendDeliverySMS(waybill, data.customer_mobile);
    }

    res.json({
      success: true,
      waybill,
      status: data.current_status?.status || data.status || "In Transit",
      last_update: data.current_status?.datetime,
      events: data.events?.slice(-5) || [],
      eta: data.eta,
    });
  } catch (error) {
    if (error.response?.status === 404) {
      return res.json({
        success: true,
        waybill,
        status: "Recently Created",
        message:
          "Shipment manifested in Delhivery panel. Tracking updates in 30 mins.",
        panel_visible: true,
      });
    }

    res.status(500).json({
      success: false,
      message: "Tracking temporarily unavailable",
    });
  }
});

export const delhiveryWebhook = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, message: "Webhook received" });

  try {
    const payload = req.body;
    console.log("=== Delhivery Webhook Payload ===", JSON.stringify(payload));

    const incomingWaybill = payload.Waybill || payload.waybill || payload.awb;
    const trackingStatus =
      payload.Status?.Status || payload.status || payload.current_status;

    if (!incomingWaybill || !trackingStatus) {
      console.warn("Invalid webhook payload received:", payload);
      return;
    }

    const order = await Order.findOne({
      $or: [{ waybill: incomingWaybill }, { returnWaybill: incomingWaybill }],
    });

    if (!order) {
      console.warn(
        `Webhook Error: Order with waybill ${incomingWaybill} not found in DB.`,
      );
      return;
    }

    const statusLower = trackingStatus.toLowerCase();

    if (order.waybill === incomingWaybill) {
      const oldStatus = order.status;
      let newOrderStatus = order.status;

      if (statusLower.includes("delivered")) {
        newOrderStatus = "delivered";
      } else if (
        statusLower.includes("in transit") ||
        statusLower.includes("dispatched") ||
        statusLower.includes("out for delivery")
      ) {
        newOrderStatus = "shipped";
      } else if (
        statusLower.includes("rto") ||
        statusLower.includes("returned")
      ) {
        newOrderStatus = "cancelled";
      }

      order.trackingStatus = trackingStatus;

      if (newOrderStatus !== oldStatus) {
        order.status = newOrderStatus;
      }

      await order.save();
      console.log(
        `[Webhook-Forward] Order ${order._id} tracking updated to: ${trackingStatus}`,
      );
    } else if (order.returnWaybill === incomingWaybill) {
      order.returnTrackingStatus = trackingStatus;

      if (statusLower.includes("delivered")) {
        order.status = "return_received";
      }

      await order.save();
      console.log(
        `[Webhook-Reverse] Order ${order._id} return tracking updated to: ${trackingStatus}`,
      );
    }
  } catch (error) {
    console.error("Webhook Background Processing Error:", error.message);
  }
});

export const bulkDownloadShippingLabels = asyncHandler(async (req, res) => {
  const { orderIds } = req.body;

  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    throw new ApiError(400, "Please provide an array of order IDs.");
  }

  if (orderIds.length > 50) {
    throw new ApiError(
      400,
      "You can only generate up to 50 labels at a time to prevent server overload.",
    );
  }

  const orders = await Order.find({
    _id: { $in: orderIds },
    waybill: { $exists: true, $ne: null },
  });

  if (orders.length === 0) {
    throw new ApiError(
      404,
      "None of the selected orders have a waybill generated.",
    );
  }

  const waybills = orders.map((o) => o.waybill);

  const orderMap = {};
  orders.forEach((o) => {
    orderMap[o.waybill] = o;
  });

  try {
    const delhiveryResponse = await axios.get(
      `${DELHIVERY_BASE_URL}/api/p/packing_slip?wbns=${waybills.join(",")}`,
      { headers: getDelhiveryHeaders() },
    );

    const packages = delhiveryResponse.data?.packages;

    if (!packages || packages.length === 0) {
      throw new ApiError(
        400,
        "Delhivery did not return label data for these waybills.",
      );
    }

    const doc = new PDFDocument({ size: [400, 600], margin: 0 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Bulk_Shipping_Labels_${Date.now()}.pdf`,
    );

    doc.pipe(res);

    const tanaririLogoPath = path.join(
      process.cwd(),
      "src",
      "assets",
      "client-logo.jpg",
    );
    const delhiveryLogoPath = path.join(
      process.cwd(),
      "src",
      "assets",
      "delhivery.png",
    );

    packages.forEach((labelData, index) => {
      if (index > 0) {
        doc.addPage();
      }

      const order = orderMap[labelData.wbn];

      doc.lineWidth(1).rect(15, 15, 370, 570).stroke();

      if (fs.existsSync(tanaririLogoPath)) {
        doc.image(tanaririLogoPath, 25, 20, { width: 80, height: 35 });
      } else {
        doc
          .font("Helvetica-Bold")
          .fontSize(16)
          .fillColor("#db2777")
          .text("TANA RIRI", 25, 30);
      }

      if (fs.existsSync(delhiveryLogoPath)) {
        doc.image(delhiveryLogoPath, 230, 20, { width: 130, height: 30 });
      } else {
        doc
          .fillColor("black")
          .fontSize(22)
          .font("Helvetica-Bold")
          .text("DELHIVERY", 230, 25, { width: 145, align: "right" });
      }

      doc.moveTo(15, 65).lineTo(385, 65).stroke();

      doc
        .fillColor("black")
        .fontSize(10)
        .font("Helvetica")
        .text(`AWB# ${labelData.wbn}`, 25, 75);

      if (labelData.barcode) {
        const awbBase64 = labelData.barcode.replace(
          /^data:image\/(png|jpeg);base64,/,
          "",
        );
        const awbBuffer = Buffer.from(awbBase64, "base64");
        doc.image(awbBuffer, 50, 90, { width: 300, height: 65 });
      }

      doc.fontSize(8).font("Helvetica");
      doc.text(labelData.pin, 25, 165);
      doc
        .font("Helvetica-Bold")
        .text(`AWB# ${labelData.wbn}`, 0, 165, { align: "center" });
      doc.font("Helvetica").text(labelData.sort_code || "DEL/MPP", 330, 165);
      doc.moveTo(15, 185).lineTo(385, 185).stroke();

      doc
        .font("Helvetica")
        .fontSize(10)
        .text("Ship to - ", 25, 195, { continued: true })
        .font("Helvetica-Bold")
        .text(labelData.name);
      doc
        .font("Helvetica")
        .fontSize(8)
        .text(labelData.address, 25, 210, { width: 220 });
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(labelData.destination, 25, 240);
      doc.text(`PIN - ${labelData.pin}`, 25, 260);

      doc.moveTo(260, 185).lineTo(260, 285).stroke();

      const isPrepaid = labelData.pt !== "COD";
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(isPrepaid ? "Prepaid - Surface" : "COD - Surface", 270, 195);
      doc.fontSize(12).text(`INR ${labelData.rs}`, 270, 215);
      doc.font("Helvetica").fontSize(8).text("Date", 270, 245);

      const orderDate = new Date(labelData.cd);
      const dateStr = orderDate
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        .replace(/ /g, "-");
      const timeStr = orderDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      doc.text(`${dateStr} | ${timeStr}`, 270, 255);

      doc.moveTo(15, 285).lineTo(385, 285).stroke();

      const sellerName = process.env.PICKUP_NAME || "TANARIRI OVERSEAS LLP";
      doc
        .font("Helvetica")
        .fontSize(8)
        .text("Seller:", 25, 295, { continued: true })
        .font("Helvetica-Bold")
        .text(sellerName);
      doc.font("Helvetica").text(labelData.sadd, 25, 310);

      doc.moveTo(260, 285).lineTo(260, 355).stroke();

      let displayOid = labelData.oid;
      if (displayOid && displayOid.length > 20) {
        displayOid = displayOid.substring(0, 20) + "...";
      }
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(displayOid, 270, 290, { width: 110 });

      if (labelData.oid_barcode) {
        const oidBase64 = labelData.oid_barcode.replace(
          /^data:image\/(png|jpeg);base64,/,
          "",
        );
        const oidBuffer = Buffer.from(oidBase64, "base64");
        doc.image(oidBuffer, 270, 320, { width: 100, height: 25 });
      }

      doc.moveTo(15, 355).lineTo(385, 355).stroke();

      doc.font("Helvetica-Bold").fontSize(8);
      doc.text("Product Name", 25, 365);
      doc.text("Qty.", 280, 365);
      doc.text("Price", 320, 365);
      doc.text("Total", 350, 365);
      doc.moveTo(15, 380).lineTo(385, 380).stroke();

      doc.font("Helvetica").fontSize(8);
      doc.text(labelData.prd, 25, 390, { width: 240 });
      doc.text(labelData.qty.toString(), 285, 390);

      const itemPrice = labelData.rs;
      const itemTotal = labelData.rs;

      doc.text(itemPrice.toString(), 320, 390);
      doc.text(itemTotal.toString(), 350, 390);

      doc.fontSize(7).text(`Return Address: ${labelData.radd}`, 25, 575);
      doc.text("Page 1 of 1", 340, 575);
    });

    doc.end();
  } catch (error) {
    console.error("Bulk Label Error:", error.message);
    throw new ApiError(502, "Failed to generate bulk shipping labels.");
  }
});

export const getAllShipments = asyncHandler(async (req, res) => {
  const { tab = "all", page = 1, limit = 20, search } = req.query;

  const baseFilter = {
    waybill: { $exists: true, $ne: null },
    status: { $nin: ["cancelled", "refunded"] },
  };
  let filter = { ...baseFilter };

  if (tab === "ready_for_pickup") {
    filter.status = "shipped";
    filter.$or = [
      { trackingStatus: { $exists: false } },
      { trackingStatus: null },
      { trackingStatus: "" },
      { trackingStatus: { $regex: /manifested/i } },
    ];
  } else if (tab === "in_transit") {
    filter.status = { $in: ["shipped", "in_transit"] };
    filter.trackingStatus = {
      $regex: /transit|dispatched|out for delivery|pending|pickup/i,
    };
  } else if (tab === "rto") {
    filter.trackingStatus = { $regex: /rto|return/i };
  } else if (tab === "delivered") {
    filter.$or = [
      { trackingStatus: { $regex: /delivered/i } },
      { status: "delivered" },
    ];
  }

  if (search) {
    if (mongoose.Types.ObjectId.isValid(search)) {
      filter._id = search;
    } else {
      filter.waybill = { $regex: search, $options: "i" };
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const shipments = await Order.find(filter)
    .populate("customerId", "firstName lastName email phone")
    .limit(Number(limit))
    .skip(skip)
    .sort({ updatedAt: -1 });

  const total = await Order.countDocuments(filter);

  const [allCount, readyCount, transitCount, rtoCount, deliveredCount] =
    await Promise.all([
      Order.countDocuments(baseFilter),
      Order.countDocuments({
        ...baseFilter,
        status: "shipped",
        $or: [
          { trackingStatus: { $exists: false } },
          { trackingStatus: null },
          { trackingStatus: "" },
          { trackingStatus: { $regex: /manifested/i } },
        ],
      }),
      Order.countDocuments({
        ...baseFilter,
        status: "shipped",
        trackingStatus: {
          $regex: /transit|dispatched|out for delivery|pending|pickup/i,
        },
      }),
      Order.countDocuments({
        ...baseFilter,
        trackingStatus: { $regex: /rto|return/i },
      }),
      Order.countDocuments({
        ...baseFilter,
        $or: [
          { trackingStatus: { $regex: /delivered/i } },
          { status: "delivered" },
        ],
      }),
    ]);

  res.json(
    new ApiResponse(200, "Shipments retrieved successfully", {
      shipments,
      counts: {
        all: allCount,
        ready_for_pickup: readyCount,
        in_transit: transitCount,
        rto: rtoCount,
        delivered: deliveredCount,
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    }),
  );
});

export const getAllReverseShipments = asyncHandler(async (req, res) => {
  const { tab = "all", page = 1, limit = 20, search } = req.query;

  const baseFilter = { returnRequest: { $exists: true, $ne: null } };
  let filter = { ...baseFilter };

  if (tab === "pending") {
    filter.$or = [
      { "returnRequest.requestStatus": "pending" },
      { returnWaybill: { $exists: false } },
      { returnWaybill: null },
      { returnWaybill: "" },
    ];
    filter["returnRequest.requestStatus"] = { $nin: ["rejected", "cancelled"] };
  } else if (tab === "ready_for_pickup") {
    filter.returnWaybill = { $exists: true, $ne: null, $ne: "" };
    filter.$or = [
      { returnTrackingStatus: { $exists: false } },
      { returnTrackingStatus: null },
      { returnTrackingStatus: "" },
      { returnTrackingStatus: { $regex: /manifested/i } },
    ];
    filter["returnRequest.requestStatus"] = { $nin: ["rejected", "cancelled"] };
  } else if (tab === "in_transit") {
    filter.returnWaybill = { $exists: true, $ne: null, $ne: "" };
    filter.returnTrackingStatus = { $regex: /transit|dispatched|pending/i };
    filter.returnTrackingStatus = { $not: { $regex: /closed|cancel/i } };
  } else if (tab === "out_for_delivery") {
    filter.returnWaybill = { $exists: true, $ne: null, $ne: "" };
    filter.returnTrackingStatus = { $regex: /out for delivery/i };
  } else if (tab === "delivered") {
    filter.$or = [
      { returnTrackingStatus: { $regex: /delivered/i } },
      { status: "return_received" },
      { "returnRequest.requestStatus": "completed" },
    ];
  } else if (tab === "cancelled") {
    filter.$or = [
      { "returnRequest.requestStatus": { $in: ["rejected", "cancelled"] } },
      { returnTrackingStatus: { $regex: /closed|cancel/i } },
    ];
  }

  if (search) {
    if (mongoose.Types.ObjectId.isValid(search)) {
      filter._id = search;
    } else {
      filter.$or = [
        { returnWaybill: { $regex: search, $options: "i" } },
        { waybill: { $regex: search, $options: "i" } },
      ];
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  let reverseShipments = await Order.find(filter)
    .populate("customerId", "firstName lastName email phone")
    .populate("items.productId", "productName")
    .limit(Number(limit))
    .skip(skip)
    .sort({ "returnRequest.requestedAt": -1 });

  const waybillsToSync = reverseShipments
    .map((order) => order.returnWaybill)
    .filter((wb) => wb && wb.trim() !== "");

  if (waybillsToSync.length > 0) {
    try {
      const delhiveryResponse = await axios.get(
        `${DELHIVERY_BASE_URL}/api/v1/packages/json/?waybill=${waybillsToSync.join(",")}`,
        {
          headers: getDelhiveryHeaders(),
        },
      );

      const packages = delhiveryResponse.data?.ShipmentData;

      if (packages && packages.length > 0) {
        for (const pkg of packages) {
          const shipment = pkg.Shipment;
          const currentWaybill = shipment.AWB;
          const trackingStatus = shipment.Status?.Status;

          if (trackingStatus) {
            const orderIndex = reverseShipments.findIndex(
              (o) => o.returnWaybill === currentWaybill,
            );

            if (
              orderIndex !== -1 &&
              reverseShipments[orderIndex].returnTrackingStatus !==
                trackingStatus
            ) {
              const statusLower = trackingStatus.toLowerCase();
              let newDbStatus = reverseShipments[orderIndex].status;

              if (statusLower.includes("delivered")) {
                newDbStatus = "return_received";
              }

              await Order.updateOne(
                { _id: reverseShipments[orderIndex]._id },
                {
                  $set: {
                    returnTrackingStatus: trackingStatus,
                    status: newDbStatus,
                  },
                },
              );

              reverseShipments[orderIndex].returnTrackingStatus =
                trackingStatus;
              reverseShipments[orderIndex].status = newDbStatus;
            }
          }
        }
      }
    } catch (error) {
      console.error("Live sync failed, serving DB data:", error.message);
    }
  }

  const total = await Order.countDocuments(filter);

  const [
    allCount,
    pendingCount,
    readyCount,
    transitCount,
    ofdCount,
    deliveredCount,
    cancelledCount,
  ] = await Promise.all([
    Order.countDocuments(baseFilter),
    Order.countDocuments({
      ...baseFilter,
      "returnRequest.requestStatus": { $nin: ["rejected", "cancelled"] },
      $or: [
        { "returnRequest.requestStatus": "pending" },
        { returnWaybill: { $exists: false } },
        { returnWaybill: null },
        { returnWaybill: "" },
      ],
    }),
    Order.countDocuments({
      ...baseFilter,
      returnWaybill: { $exists: true, $ne: null, $ne: "" },
      "returnRequest.requestStatus": { $nin: ["rejected", "cancelled"] },
      $or: [
        { returnTrackingStatus: { $exists: false } },
        { returnTrackingStatus: null },
        { returnTrackingStatus: "" },
        { returnTrackingStatus: { $regex: /manifested/i } },
      ],
    }),
    Order.countDocuments({
      ...baseFilter,
      returnWaybill: { $exists: true, $ne: null, $ne: "" },
      returnTrackingStatus: {
        $regex: /transit|dispatched|pending/i,
        $not: /closed|cancel/i,
      },
    }),
    Order.countDocuments({
      ...baseFilter,
      returnWaybill: { $exists: true, $ne: null, $ne: "" },
      returnTrackingStatus: { $regex: /out for delivery/i },
    }),
    Order.countDocuments({
      ...baseFilter,
      $or: [
        { returnTrackingStatus: { $regex: /delivered/i } },
        { status: "return_received" },
        { "returnRequest.requestStatus": "completed" },
      ],
    }),
    Order.countDocuments({
      ...baseFilter,
      $or: [
        { "returnRequest.requestStatus": { $in: ["rejected", "cancelled"] } },
        { returnTrackingStatus: { $regex: /closed|cancel/i } },
      ],
    }),
  ]);

  res.json(
    new ApiResponse(200, "Reverse shipments retrieved successfully", {
      shipments: reverseShipments,
      counts: {
        all: allCount,
        pending: pendingCount,
        ready_for_pickup: readyCount,
        in_transit: transitCount,
        out_for_delivery: ofdCount,
        delivered: deliveredCount,
        cancelled: cancelledCount,
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    }),
  );
});

export const generateDailyManifest = asyncHandler(async (req, res) => {
  const { date } = req.query;

  let startDate, endDate;
  if (date) {
    startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
  } else {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
  }

  const orders = await Order.find({
    status: "shipped",
    waybill: { $exists: true, $ne: null },
    updatedAt: { $gte: startDate, $lte: endDate },
  }).populate("customerId", "firstName lastName");

  if (orders.length === 0) {
    throw new ApiError(404, "No shipped orders found for today.");
  }

  const doc = new PDFDocument({ margin: 30, size: "A4" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=Manifest_${startDate.toISOString().split("T")[0]}.pdf`,
  );

  doc.pipe(res);

  doc
    .fontSize(20)
    .font("Helvetica-Bold")
    .text("DELHIVERY PICKUP MANIFEST", { align: "center" });
  doc.moveDown(0.5);
  doc
    .fontSize(12)
    .font("Helvetica")
    .text(`Date: ${startDate.toDateString()}`, { align: "center" });
  doc.text(`Total Parcels: ${orders.length}`, { align: "center" });
  doc.moveDown(2);

  doc.fontSize(10).font("Helvetica-Bold").text("Seller Details:");
  doc
    .font("Helvetica")
    .text(process.env.PICKUP_NAME || "TANARIRI OVERSEAS LLP");
  doc.text(process.env.PICKUP_ADDRESS || "Warehouse Address");
  doc.moveDown(1);

  const tableTop = doc.y;
  doc.font("Helvetica-Bold");
  doc.text("S.No", 30, tableTop);
  doc.text("Order ID", 70, tableTop);
  doc.text("Waybill (AWB)", 200, tableTop);
  doc.text("Customer Name", 320, tableTop);
  doc.text("Payment", 450, tableTop);

  // Header Line
  doc
    .moveTo(30, tableTop + 15)
    .lineTo(560, tableTop + 15)
    .stroke();

  let yPosition = tableTop + 25;
  doc.font("Helvetica").fontSize(9);

  orders.forEach((order, index) => {
    if (yPosition > 750) {
      doc.addPage();
      yPosition = 50;
    }

    doc.text((index + 1).toString(), 30, yPosition);
    doc.text(order._id.toString().substring(0, 10) + "...", 70, yPosition);
    doc.text(order.waybill, 200, yPosition);

    const custName = order.customerId
      ? `${order.customerId.firstName} ${order.customerId.lastName}`
      : "Customer";
    doc.text(custName.substring(0, 20), 320, yPosition);

    const isPrepaid = order.paymentInfo?.status === "completed";
    doc.text(
      isPrepaid ? "Prepaid" : `COD (Rs.${order.totalAmount})`,
      450,
      yPosition,
    );

    doc
      .moveTo(30, yPosition + 15)
      .lineTo(560, yPosition + 15)
      .lineWidth(0.5)
      .stroke();
    yPosition += 25;
  });
  doc.moveDown(4);
  yPosition = doc.y;

  if (yPosition > 700) {
    doc.addPage();
    yPosition = 50;
  }

  doc.fontSize(11).font("Helvetica-Bold");
  doc.text("Pickup Executive Name: _______________________", 30, yPosition);
  doc.moveDown(1.5);
  doc.text("Executive Signature:      _______________________", 30, doc.y);
  doc.moveDown(1.5);
  doc.text("Date & Time:                  _______________________", 30, doc.y);

  doc.end();
});
