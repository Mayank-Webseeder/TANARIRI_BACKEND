import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { config } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { swaggerSpec } from "./docs/swagger.js";
import colors from "colors";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import razorpayRoutes from "./routes/razorpayRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";

const app = express();

connectDatabase();

app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});

app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many login attempts, please try again later.",
  })
);

app.use(
  "/api/auth/signup",
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: "Too many signup attempts, please try again later.",
  })
);

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

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/razorpay", razorpayRoutes);
app.use("/api/orders", orderRoutes);

app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use(errorHandler);

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`.bgCyan);
  console.log(`API Documentation: http://localhost:${PORT}/api-docs`.bgYellow);
});

export default app;
