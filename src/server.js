import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import fs from "fs";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import path from "path"; // Multer static
import multer from "multer"; // Multer error handler
import colors from "colors";
import { config } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { swaggerSpec } from "./docs/swagger.js";
import { initializeSocket } from "./config/socket.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import razorpayRoutes from "./routes/razorpayRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import shippingRoutes from "./routes/shippingRoutes.js";
import helpRoutes from "./routes/helpRoutes.js";

const app = express();

connectDatabase();

// Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS Allowed Origins
const allowedOrigins = [
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
  "https://api.tanaririllp.com",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS: " + origin));
      }
    },
    credentials: true,
  })
);

app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limit - global
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   message: "Too many requests from this IP, please try again later.",
// });
// app.use(limiter);

// Rate limit - login/signup special
// app.use(
//   "/api/auth/login",
//   rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 5,
//     message: "Too many login attempts, please try again later.",
//   })
// );
// app.use(
//   "/api/auth/signup",
//   rateLimit({
//     windowMs: 60 * 60 * 1000,
//     max: 3,
//     message: "Too many signup attempts, please try again later.",
//   })
// );

// Swagger docs
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
  })
);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "E-Commerce API is running",
    documentation: "/api-docs",
  });
});

//STATIC UPLOADS FOLDER
app.use(
  "/uploads",
  (req, res, next) => {
    //CORS headers for images
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    next();
  },
  express.static(path.resolve("uploads"))
);
const helpUploadsDir = path.resolve("uploads/help");
if (!fs.existsSync(helpUploadsDir)) {
  fs.mkdirSync(helpUploadsDir, { recursive: true });
  console.log("Created uploads/help directory".black.bgGreen);
}
// API ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/razorpay", razorpayRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/shipping", shippingRoutes);
app.use("/api/help", helpRoutes);
// 404 Not Found
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// MULTER ERROR HANDLING
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Max 5MB allowed",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next(err);
});

// CUSTOM ERROR HANDLING
app.use(errorHandler);

const PORT = config.port;

const server = http.createServer(app);

initializeSocket(server);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`.black.bgCyan);
  console.log(
    `API Documentation: http://localhost:${PORT}/api-docs`.black.bgYellow
  );
  console.log(`WebSocket Server initialized on port ${PORT}`.black.bgGreen);
});

export default app;
