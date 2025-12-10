import express from "express";
import {
    getUserNotifications,
    getUnreadCount,
    markAsRead,
    markManyAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
    getNotificationStats,
    cleanupOldNotifications,
} from "../controllers/notificationController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

const router = express.Router();

// User routes
router.get("/", authenticate, getUserNotifications);
router.get("/unread-count", authenticate, getUnreadCount);
router.patch("/:id/read", authenticate, markAsRead);
router.patch("/mark-many-read", authenticate, markManyAsRead);
router.patch("/mark-all-read", authenticate, markAllAsRead);
router.delete("/:id", authenticate, deleteNotification);
router.delete("/read/all", authenticate, deleteAllRead);

// Admin routes
router.get("/stats",authenticate,authorize("admin", "userpannel"), getNotificationStats);
router.delete("/cleanup",authenticate,authorize("admin"), cleanupOldNotifications);

export default router;
