import express from "express";
import {
  createProduct,
  getAllProducts,
  getActiveProducts,
  getBestSellerProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  toggleBestSeller,
  toggleHideProduct,
  updateStock,
} from "../controllers/productController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import { productSchema } from "../utils/validationSchemas.js";

const router = express.Router();

/**
 * @swagger
 * /api/products/createproduct:
 *   post:
 *     tags:
 *       - Products
 *     summary: Create a new product
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       201:
 *         description: Product created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *
 * /api/products/getallproducts:
 *   get:
 *     tags:
 *       - Products
 *     summary: Get all products
 *     responses:
 *       200:
 *         description: List of products
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

// create product
router.post(
  "/createproduct",
  authenticate,
  authorize("admin", "userpannel"),
  validate(productSchema),
  createProduct
);
// get all products
router.get("/getallproducts", getAllProducts);
// get active products
router.get("/getactiveproducts", getActiveProducts);
// get bestseller
router.get("/getbestsellerproducts", getBestSellerProducts);
// get by id
router.get("/getproductbyid/:id", getProductById);
// update
router.put(
  "/updateproduct/:id",
  authenticate,
  authorize("admin", "userpannel"),
  updateProduct
);
// delete
router.delete(
  "/deleteproduct/:id",
  authenticate,
  authorize("admin", "userpannel"),
  deleteProduct
);
// status patch
router.patch(
  "/togglestatus/:id",
  authenticate,
  authorize("admin", "userpannel"),
  toggleProductStatus
);
// bestseller patch
router.patch(
  "/togglebestseller/:id",
  authenticate,
  authorize("admin", "userpannel"),
  toggleBestSeller
);
router.patch(
  "/togglehide/:id",
  authenticate,
  authorize("admin", "userpannel"),
  toggleHideProduct
);
// update stock
router.post(
  "/:id/stock",
  authenticate,
  authorize("admin", "userpannel"),
  updateStock
);

export default router;
