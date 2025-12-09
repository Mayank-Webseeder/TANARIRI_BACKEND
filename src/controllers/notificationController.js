import Notification from "../models/Notification.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getUserNotifications = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const userId = req.user._id;

    const filter = { userId };
    if (unreadOnly === "true") {
        filter.read = false;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const notifications = await Notification.find(filter)
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip(skip)
        .populate("data.orderId", "status totalAmount")
        .lean();

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.getUnreadCount(userId);

    res.json(
        new ApiResponse(200, "Notifications retrieved successfully", {
            notifications,
            unreadCount,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        })
    );
});

export const getUnreadCount = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const count = await Notification.getUnreadCount(userId);

    res.json(
        new ApiResponse(200, "Unread count retrieved successfully", {
            count,
        })
    );
});

export const markAsRead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOne({ _id: id, userId });

    if (!notification) {
        throw new ApiError(404, "Notification not found");
    }

    await notification.markAsRead();

    res.json(
        new ApiResponse(200, "Notification marked as read", notification)
    );
});

export const markManyAsRead = asyncHandler(async (req, res) => {
    const { notificationIds } = req.body;
    const userId = req.user._id;

    if (!notificationIds || !Array.isArray(notificationIds)) {
        throw new ApiError(400, "notificationIds must be an array");
    }

    const result = await Notification.markManyAsRead(userId, notificationIds);

    res.json(
        new ApiResponse(200, "Notifications marked as read", {
            modifiedCount: result.modifiedCount,
        })
    );
});

export const markAllAsRead = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const result = await Notification.markAllAsRead(userId);

    res.json(
        new ApiResponse(200, "All notifications marked as read", {
            modifiedCount: result.modifiedCount,
        })
    );
});

export const deleteNotification = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOneAndDelete({ _id: id, userId });

    if (!notification) {
        throw new ApiError(404, "Notification not found");
    }

    res.json(new ApiResponse(200, "Notification deleted successfully"));
});

export const deleteAllRead = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const result = await Notification.deleteMany({ userId, read: true });

    res.json(
        new ApiResponse(200, "All read notifications deleted", {
            deletedCount: result.deletedCount,
        })
    );
});

export const getNotificationStats = asyncHandler(async (req, res) => {
    const totalNotifications = await Notification.countDocuments();
    const unreadNotifications = await Notification.countDocuments({ read: false });
    const readNotifications = await Notification.countDocuments({ read: true });

    const notificationsByType = await Notification.aggregate([
        { $group: { _id: "$type", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);

    const recentNotifications = await Notification.aggregate([
        {
            $match: {
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            },
        },
        { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);

    res.json(
        new ApiResponse(200, "Notification statistics retrieved successfully", {
            total: totalNotifications,
            unread: unreadNotifications,
            read: readNotifications,
            byType: notificationsByType,
            last24Hours: recentNotifications,
        })
    );
});

export const cleanupOldNotifications = asyncHandler(async (req, res) => {
    const result = await Notification.cleanupOldNotifications();

    res.json(
        new ApiResponse(200, "Old notifications cleaned up successfully", {
            deletedCount: result.deletedCount,
        })
    );
});
