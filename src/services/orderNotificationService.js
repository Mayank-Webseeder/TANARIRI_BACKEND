import { getIO } from "../config/socket.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";

const getUserId = (userField) => {
    if (!userField) return null;
    if (typeof userField === "object" && userField._id) {
        return userField._id.toString();
    }
    return userField.toString();
};
const saveNotification = async (userId, notification) => {
    try {
        const { timestamp, ...notificationData } = notification;
        await Notification.create({
            userId,
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            data: {
                orderId: notificationData.orderId,
                customerId: notificationData.customerId,
                customerName: notificationData.customerName,
                status: notificationData.status,
                oldStatus: notificationData.oldStatus,
                newStatus: notificationData.newStatus,
                totalAmount: notificationData.totalAmount,
                itemCount: notificationData.itemCount,
                refundAmount: notificationData.refundAmount,
                adminComment: notificationData.adminComment,
                reason: notificationData.reason,
                reasonCategory: notificationData.reasonCategory,
                paymentStatus: notificationData.paymentStatus,
                amount: notificationData.amount,
                returnStatus: notificationData.returnStatus,
                transactionId: notificationData.transactionId,
            },
        });
        console.log(`Notification saved to database for user: ${userId}`.gray);
    } catch (error) {
        console.error("Error saving notification to database:", error);
    }
};

export const emitOrderNotification = async (userId, notification) => {
    try {
        await saveNotification(userId, notification);
        const io = getIO();
        io.to(`user:${userId}`).emit("order:notification", notification);
        console.log(`Order notification sent to user: ${userId}`.green);
    } catch (error) {
        console.error("Error sending order notification:", error);
    }
};

export const emitAdminNotification = async (notification) => {
    try {
        const adminUsers = await User.find({
            role: { $in: ["admin", "userpannel"] },
        }).select("_id");
        if (adminUsers && adminUsers.length > 0) {
            for (const admin of adminUsers) {
                await saveNotification(admin._id.toString(), notification);
            }
            console.log(
                `Notification saved for ${adminUsers.length} admin users`.gray
            );
        }
        const io = getIO();
        io.to("admin").emit("order:notification", notification);
        console.log("Order notification sent to all admins".green);
    } catch (error) {
        console.error("Error sending admin notification:", error);
    }
};

export const notifyOrderCreated = (order) => {
    const notification = {
        type: "order_created",
        title: "Order Placed Successfully",
        message: `Your order #${order._id.toString().slice(-6)} has been placed successfully`,
        orderId: order._id,
        status: order.status,
        totalAmount: order.totalAmount,
        timestamp: new Date(),
    };
    emitOrderNotification(getUserId(order.customerId), notification);
};

export const notifyAdminNewOrder = (order, customerInfo) => {
    const notification = {
        type: "new_order",
        title: "New Order Received",
        message: `New order from ${customerInfo.firstName} ${customerInfo.lastName}`,
        orderId: order._id,
        customerId: order.customerId,
        customerName: `${customerInfo.firstName} ${customerInfo.lastName}`,
        totalAmount: order.totalAmount,
        itemCount: order.items.length,
        timestamp: new Date(),
    };
    emitAdminNotification(notification);
};

export const notifyOrderStatusChanged = (order, oldStatus, newStatus) => {
    const statusMessages = {
        pending: "Your order is pending confirmation",
        confirmed: "Your order has been confirmed and is being prepared",
        shipped: "Your order has been shipped and is on the way",
        delivered: "Your order has been delivered successfully",
        cancelled: "Your order has been cancelled",
        refunded: "Your order has been refunded",
    };
    const notification = {
        type: "order_status_changed",
        title: "Order Status Updated",
        message: statusMessages[newStatus] || `Order status changed to ${newStatus}`,
        orderId: order._id,
        oldStatus,
        newStatus,
        timestamp: new Date(),
    };
    emitOrderNotification(getUserId(order.customerId), notification);
};

export const notifyReturnRequestSubmitted = (order) => {
    const notification = {
        type: "return_request_submitted",
        title: "Return Request Submitted",
        message: `Your return request for order #${order._id.toString().slice(-6)} has been submitted`,
        orderId: order._id,
        returnStatus: order.returnRequest.requestStatus,
        timestamp: new Date(),
    };
    emitOrderNotification(getUserId(order.customerId), notification);
};

export const notifyAdminReturnRequest = (order, customerInfo) => {
    const notification = {
        type: "new_return_request",
        title: "New Return Request",
        message: `Return request from ${customerInfo.firstName} ${customerInfo.lastName} for order #${order._id.toString().slice(-6)}`,
        orderId: order._id,
        customerId: order.customerId,
        customerName: `${customerInfo.firstName} ${customerInfo.lastName}`,
        reason: order.returnRequest.reason,
        reasonCategory: order.returnRequest.reasonCategory,
        timestamp: new Date(),
    };
    emitAdminNotification(notification);
};

export const notifyReturnRequestApproved = (order) => {
    const notification = {
        type: "return_request_approved",
        title: "Return Request Approved",
        message: `Your return request for order #${order._id.toString().slice(-6)} has been approved`,
        orderId: order._id,
        refundAmount: order.returnRequest.refundAmount,
        adminComment: order.returnRequest.adminComment,
        timestamp: new Date(),
    };
    emitOrderNotification(getUserId(order.customerId), notification);
};

export const notifyReturnRequestRejected = (order) => {
    const notification = {
        type: "return_request_rejected",
        title: "Return Request Rejected",
        message: `Your return request for order #${order._id.toString().slice(-6)} has been rejected`,
        orderId: order._id,
        adminComment: order.returnRequest.adminComment,
        timestamp: new Date(),
    };
    emitOrderNotification(getUserId(order.customerId), notification);
};

export const notifyReturnCompleted = (order) => {
    const notification = {
        type: "return_completed",
        title: "Return Completed",
        message: `Your return for order #${order._id.toString().slice(-6)} has been completed and refund is being processed`,
        orderId: order._id,
        refundAmount: order.returnRequest.refundAmount,
        timestamp: new Date(),
    };
    emitOrderNotification(getUserId(order.customerId), notification);
};

export const notifyPaymentStatusChanged = (order, paymentStatus) => {
    const statusMessages = {
        completed: "Payment completed successfully",
        failed: "Payment failed. Please try again",
        refunded: "Payment has been refunded",
    };
    const notification = {
        type: "payment_status_changed",
        title: "Payment Status Updated",
        message: statusMessages[paymentStatus] || `Payment status: ${paymentStatus}`,
        orderId: order._id,
        paymentStatus,
        amount: order.totalAmount,
        timestamp: new Date(),
    };
    emitOrderNotification(getUserId(order.customerId), notification);
};

export const notifyPaymentReceived = (order, paymentDetails) => {
    const productName = order.items && order.items.length > 0
        ? order.items[0].name
        : 'Your order';
    const notification = {
        type: "payment_received",
        title: `Payment Received #TX-${paymentDetails.razorpayPaymentId ? paymentDetails.razorpayPaymentId.slice(-3).toUpperCase() : order._id.toString().slice(-3).toUpperCase()}`,
        message: `${productName}`,
        orderId: order._id,
        paymentStatus: "success",
        amount: order.totalAmount,
        transactionId: paymentDetails.razorpayPaymentId,
        customerName: order.customerId ? `${order.customerId.firstName} ${order.customerId.lastName}` : undefined,
        timestamp: new Date(),
    };
    emitOrderNotification(getUserId(order.customerId), notification);
};

