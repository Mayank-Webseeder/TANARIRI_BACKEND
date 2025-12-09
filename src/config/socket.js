import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "./env.js";

let io;

export const initializeSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: [
                "https://crockery-e-com-dashboard.netlify.app",
                "https://tanariri-frontend.vercel.app",
                "https://tanariry.netlify.app",
                "http://localhost:5173",
                "http://localhost:3000",
                "https://tanariry-user.netlify.app",
                "https://app.tanaririllp.com",
                "https://tanaririllp.com",
                "https://tanariri-dashboard.netlify.app",
                "https://tanariri-website.netlify.app",
            ],
            credentials: true,
        },
    });

    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;

            if (!token) {
                return next(new Error("Authentication error: No token provided"));
            }

            const decoded = jwt.verify(token, config.jwtSecret);
            socket.userId = decoded._id || decoded.userId;
            socket.userRole = decoded.role;

            if (!socket.userRole && socket.userId) {
                try {
                    const { default: User } = await import("../models/User.js");
                    const user = await User.findById(socket.userId).select("role");
                    if (user) {
                        socket.userRole = user.role;
                    }
                } catch (err) {
                    console.error("Error fetching user role for socket:", err);
                }
            }

            next();
        } catch (error) {
            next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        console.log(
            `User connected: ${socket.userId} with role: ${socket.userRole}`.cyan
        );

        socket.join(`user:${socket.userId}`);

        if (socket.userRole === "admin" || socket.userRole === "userpannel") {
            socket.join("admin");
        } else if (socket.userRole === "customer") {
            socket.join(`customer:${socket.userId}`);
        }

        socket.on("disconnect", () => {
            console.log(`User disconnected: ${socket.userId}`.yellow);
        });

        socket.emit("connected", {
            message: "Connected to order notification service",
            userId: socket.userId,
            role: socket.userRole,
        });
    });

    console.log("Socket.IO initialized successfully".green.bold);
    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};
