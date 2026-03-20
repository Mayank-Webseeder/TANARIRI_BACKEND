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
  addProductReview,
  deleteProductReview,
} from "../controllers/productController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import { productSchema } from "../utils/validationSchemas.js";
import { upload } from "../middlewares/multer.js";
import {
  processProductImages,
  uploadImages,
} from "../middlewares/imageProcessor.js";

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
  uploadImages.array("productImages", 5),
  processProductImages,
  validate(productSchema),
  createProduct,
);

router.get("/getallproducts", getAllProducts);
router.get("/getactiveproducts", getActiveProducts);
router.get("/getbestsellerproducts", getBestSellerProducts);
router.get("/getproductbyid/:id", getProductById);
router.put(
  "/updateproduct/:id",
  authenticate,
  authorize("admin", "userpannel"),
  uploadImages.array("productImages", 5),
  processProductImages,
  updateProduct,
);
router.delete(
  "/deleteproduct/:id",
  authenticate,
  authorize("admin", "userpannel"),
  deleteProduct,
);
router.patch(
  "/togglestatus/:id",
  authenticate,
  authorize("admin", "userpannel"),
  toggleProductStatus,
);
router.patch(
  "/togglebestseller/:id",
  authenticate,
  authorize("admin", "userpannel"),
  toggleBestSeller,
);
router.patch(
  "/togglehide/:id",
  authenticate,
  authorize("admin", "userpannel"),
  toggleHideProduct,
);
router.post(
  "/:id/stock",
  authenticate,
  authorize("admin", "userpannel"),
  updateStock,
);

router.post("/:id/reviews", authenticate, addProductReview);

router.delete("/:id/reviews", authenticate, deleteProductReview);
export default router;
