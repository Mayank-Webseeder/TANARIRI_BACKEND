import Product from "../models/Product.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import fs from "fs";
import path from "path";

export const createProduct = asyncHandler(async (req, res) => {
  const imageAssets = req.body.processedImages || [];

  const allowedFields = [
    "productName",
    "description",
    "originalPrice",
    "discountPrice",
    "priceINR",
    "discountPriceINR",
    "priceUSD",
    "discountPriceUSD",
    "stock",
    "category",
    "subCategoryId",
    "isActive",
    "bestSeller",
    "hideProduct",
  ];

  const productData = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      productData[field] = req.body[field];
    }
  });

  productData.priceINR = productData.priceINR || 0;
  productData.discountPriceINR = productData.discountPriceINR || 0;
  productData.priceUSD = productData.priceUSD || 0;
  productData.discountPriceUSD = productData.discountPriceUSD || 0;

  productData.productImages = imageAssets;

  const product = await Product.create(productData);

  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        "Product created successfully with optimized WebP images",
        product,
      ),
    );
});

export const getAllProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    category,
    subCategoryId,
    minPrice,
    maxPrice,
    search,
  } = req.query;

  const filter = {};

  if (category) {
    filter.category = category;
  }

  if (subCategoryId) {
    filter.subCategoryId = subCategoryId;
  }

  if (minPrice || maxPrice) {
    filter.discountPrice = {};
    if (minPrice) filter.discountPrice.$gte = Number(minPrice);
    if (maxPrice) filter.discountPrice.$lte = Number(maxPrice);
  }

  if (search) {
    filter.$or = [
      { productName: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const products = await Product.find(filter)
    .populate("category", "name")
    .limit(Number(limit))
    .skip(skip)
    .sort({ createdAt: -1 });

  const total = await Product.countDocuments(filter);

  res.json(
    new ApiResponse(200, "Products retrieved successfully", {
      products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    }),
  );
});

export const getActiveProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({
    isActive: true,
    hideProduct: false,
  }).populate("category", "name");

  res.json(
    new ApiResponse(200, "Active products retrieved successfully", products),
  );
});

export const getBestSellerProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({
    bestSeller: true,
    isActive: true,
    hideProduct: false,
  })
    .populate("category", "name")
    .limit(10);

  res.json(
    new ApiResponse(
      200,
      "Best seller products retrieved successfully",
      products,
    ),
  );
});

export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findById(id).populate(
    "category",
    "name subCategories",
  );

  if (!product) throw new ApiError(404, "Product not found");

  // Find the specific subcategory from the populated category
  const subCategory = product.category.subCategories.find(
    (sub) => sub._id.toString() === product.subCategoryId.toString(),
  );

  // Format subCategoryId as an object in the response
  const response = {
    ...product.toObject(),
    subCategoryId: subCategory
      ? { _id: subCategory._id, name: subCategory.name }
      : null,
  };

  res.json(new ApiResponse(200, "Product retrieved successfully", response));
});

export const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findById(id);
  if (!product) throw new ApiError(404, "Product not found");

  // 1. If admin uploaded NEW images via the middleware
  if (req.body.processedImages && req.body.processedImages.length > 0) {
    // Permanently delete old images from the disk to free up space
    if (product.productImages && product.productImages.length > 0) {
      product.productImages.forEach((img) => {
        if (img.highRes) {
          const highPath = path.join(process.cwd(), img.highRes);
          if (fs.existsSync(highPath)) fs.unlinkSync(highPath);
        }
        if (img.lowRes) {
          const lowPath = path.join(process.cwd(), img.lowRes);
          if (fs.existsSync(lowPath)) fs.unlinkSync(lowPath);
        }
      });
    }

    // Assign new processed images to the product
    product.productImages = req.body.processedImages;
  }

  // 2. Update remaining fields
  Object.keys(req.body).forEach((key) => {
    // Prevent overriding productImages with raw strings and processedImages array
    if (key !== "productImages" && key !== "processedImages") {
      product[key] = req.body[key];
    }
  });

  await product.save();
  res.json(new ApiResponse(200, "Product updated successfully", product));
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  // Delete images from disk before removing the product document
  if (product.productImages && product.productImages.length > 0) {
    product.productImages.forEach((img) => {
      // Delete High Res
      if (img.highRes) {
        const highPath = path.join(process.cwd(), img.highRes);
        if (fs.existsSync(highPath)) fs.unlinkSync(highPath);
      }
      // Delete Low Res
      if (img.lowRes) {
        const lowPath = path.join(process.cwd(), img.lowRes);
        if (fs.existsSync(lowPath)) fs.unlinkSync(lowPath);
      }
    });
  }

  await product.deleteOne();

  res.json(new ApiResponse(200, "Product deleted successfully"));
});

export const toggleProductStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  product.isActive = !product.isActive;
  await product.save();

  res.json(
    new ApiResponse(
      200,
      `Product ${product.isActive ? "activated" : "deactivated"} successfully`,
      product,
    ),
  );
});

export const toggleBestSeller = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  product.bestSeller = !product.bestSeller;
  await product.save();

  res.json(
    new ApiResponse(
      200,
      `Product ${product.bestSeller ? "marked" : "unmarked"} as bestseller`,
      product,
    ),
  );
});

export const toggleHideProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  product.hideProduct = !product.hideProduct;
  await product.save();

  res.json(
    new ApiResponse(
      200,
      `Product ${product.hideProduct ? "hidden" : "visible"}`,
      product,
    ),
  );
});

export const updateStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { quantity, operation } = req.body;

  if (!quantity || !operation || !["add", "remove"].includes(operation)) {
    throw new ApiError(400, "Invalid quantity or operation");
  }

  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  if (operation === "add") {
    product.stock += Number(quantity);
  } else if (operation === "remove") {
    if (product.stock < Number(quantity)) {
      throw new ApiError(400, "Insufficient stock");
    }
    product.stock -= Number(quantity);
  }

  await product.save();

  res.json(new ApiResponse(200, "Stock updated successfully", product));
});
