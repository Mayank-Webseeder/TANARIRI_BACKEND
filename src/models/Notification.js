import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        type: {
            type: String,
            required: true,
            enum: [
                "order_created",
                "order_status_changed",
                "return_request_submitted",
                "return_request_approved",
                "return_request_rejected",
                "return_completed",
                "payment_status_changed",
                "new_order",
                "new_return_request",
            ],
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
        },
        data: {
            orderId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Order",
            },
            customerId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            customerName: String,
            status: String,
            oldStatus: String,
            newStatus: String,
            totalAmount: Number,
            itemCount: Number,
            refundAmount: Number,
            adminComment: String,
            reason: String,
            reasonCategory: String,
            paymentStatus: String,
            amount: Number,
        },
        read: {
            type: Boolean,
            default: false,
            index: true,
        },
        readAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

notificationSchema.virtual("isRecent").get(function () {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.createdAt > oneDayAgo;
});
notificationSchema.methods.markAsRead = async function () {
    if (!this.read) {
        this.read = true;
        this.readAt = new Date();
        await this.save();
    }
    return this;
};

notificationSchema.statics.markManyAsRead = async function (
    userId,
    notificationIds
) {
    return this.updateMany(
        {
            _id: { $in: notificationIds },
            userId: userId,
            read: false,
        },
        {
            $set: {
                read: true,
                readAt: new Date(),
            },
        }
    );
};

notificationSchema.statics.markAllAsRead = async function (userId) {
    return this.updateMany(
        {
            userId: userId,
            read: false,
        },
        {
            $set: {
                read: true,
                readAt: new Date(),
            },
        }
    );
};

notificationSchema.statics.getUnreadCount = async function (userId) {
    return this.countDocuments({ userId: userId, read: false });
};
notificationSchema.statics.cleanupOldNotifications = async function () {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.deleteMany({
        read: true,
        readAt: { $lt: thirtyDaysAgo },
    });
};

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
