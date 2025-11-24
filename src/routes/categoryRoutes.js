import express from "express";
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import { categorySchema } from "../utils/validationSchemas.js";

const router = express.Router();

/**
 * @swagger
 * /api/categories/createcategory:
 *   post:
 *     tags:
 *       - Categories
 *     summary: Create a new category
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Category'
 *     responses:
 *       201:
 *         description: Category created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *
 * /api/categories/getallcategories:
 *   get:
 *     tags:
 *       - Categories
 *     summary: Get all categories
 *     responses:
 *       200:
 *         description: List of categories
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

// create category
router.post(
  "/createcategory",
  authenticate,
  authorize("admin", "userpannel"),
  validate(categorySchema),
  createCategory
);
// get category
router.get("/getallcategories", getAllCategories);
// get cat. by id
router.get("/getcategory/:id", getCategoryById);
// update category
router.put(
  "/updatecategory/:id",
  authenticate,
  authorize("admin", "userpannel"),
  validate(categorySchema),
  updateCategory
);
// delete category
router.delete(
  "/deletecategory/:id",
  authenticate,
  authorize("admin", "userpannel"),
  deleteCategory
);

export default router;
