import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const paymentInfoSchema = new mongoose.Schema(
  {
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    address: { type: String, required: true },
    pincode: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false }
);

// Return Request Schema
const returnRequestSchema = new mongoose.Schema(
  {
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    reasonCategory: {
      type: String,
      enum: [
        "defective",
        "wrong_item",
        "not_as_described",
        "damaged",
        "size_issue",
        "quality_issue",
        "changed_mind",
        "other",
      ],
      required: true,
    },
    images: [
      {
        type: String,
      },
    ],
    requestStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      default: "pending",
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    adminComment: {
      type: String,
      trim: true,
    },
    refundAmount: {
      type: Number,
      min: 0,
    },
    refundStatus: {
      type: String,
      enum: ["not_initiated", "processing", "completed", "failed"],
      default: "not_initiated",
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },
        message: "Order must have at least one item",
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentInfo: {
      type: paymentInfoSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
        "return_requested",
        "return_approved",
        "return_rejected",
        "return_completed",
      ],
      default: "pending",
    },
    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },
    returnRequest: {
      type: returnRequestSchema,
      default: null,
    },
    isReturnable: {
      type: Boolean,
      default: true,
    },
    returnWindowDays: {
      type: Number,
      default: 7,
    },
    courier: {
      type: String,
      default: null,
    },
    waybill: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual to check if return window is still open
orderSchema.virtual("canReturn").get(function () {
  if (!this.isReturnable || this.status !== "delivered") return false;

  const deliveryDate = this.updatedAt;
  const currentDate = new Date();
  const daysSinceDelivery = Math.floor(
    (currentDate - deliveryDate) / (1000 * 60 * 60 * 24)
  );

  return daysSinceDelivery <= this.returnWindowDays;
});

// Index for faster queries
orderSchema.index({ customerId: 1, status: 1 });
orderSchema.index({ "returnRequest.requestStatus": 1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;
