import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createRazorpayOrder, verifyRazorpaySignature } from '../services/razorpayService.js';
import Order from '../models/Order.js';
import { notifyOrderCreated, notifyAdminNewOrder } from "../services/orderNotificationService.js";

export const createOrder = asyncHandler(async (req, res) => {
  const { amount, currency, receipt } = req.body;

  if (!amount) {
    throw new ApiError(400, 'Amount is required');
  }

  const order = await createRazorpayOrder(amount, currency, receipt);

  res.status(201).json(new ApiResponse(201, 'Razorpay order created successfully', order));
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ApiError(400, 'Missing payment verification parameters');
  }

  const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

  if (!isValid) {
    if (orderId) {
      await Order.findByIdAndUpdate(orderId, {
        'paymentInfo.status': 'failed',
      });
    }
    throw new ApiError(400, 'Invalid payment signature');
  }

  if (orderId) {
    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        'paymentInfo.razorpayOrderId': razorpay_order_id,
        'paymentInfo.razorpayPaymentId': razorpay_payment_id,
        'paymentInfo.razorpaySignature': razorpay_signature,
        'paymentInfo.status': 'completed',
        status: 'confirmed',
      },
      { new: true }
    ).populate('customerId', 'firstName lastName email');

    if (order) {
      notifyOrderCreated(order);

      const customerInfo = {
        firstName: order.customerId.firstName || 'Customer',
        lastName: order.customerId.lastName || '',
      };
      notifyAdminNewOrder(order, customerInfo);
    }
  }

  res.json(new ApiResponse(200, 'Payment verified successfully', { isValid: true }));
});
