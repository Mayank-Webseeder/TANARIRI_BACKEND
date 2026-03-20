import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
  {
    highRes: { type: String, required: true },
    lowRes: { type: String },
  },
  { _id: false },
);

// Review Schema
const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
  },
  { timestamps: true },
);

const productSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    originalPrice: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, required: true, min: 0 },
    priceUSD: { type: Number, required: true, min: 0 },
    discountPriceUSD: { type: Number, required: true, min: 0 },
    productImages: { type: [imageSchema], default: [] },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    subCategoryId: { type: mongoose.Schema.Types.ObjectId, required: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
    bestSeller: { type: Boolean, default: false },
    hideProduct: { type: Boolean, default: false },
    // Feedback fields
    reviews: [reviewSchema],
    numReviews: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Bestseller limit logic
productSchema.pre("save", async function (next) {
  if (this.isModified("bestSeller") && this.bestSeller === true) {
    const bestSellerCount = await mongoose.model("Product").countDocuments({
      bestSeller: true,
      _id: { $ne: this._id },
    });
    if (bestSellerCount >= 10) {
      return next(new Error("Cannot have more than 10 bestseller products"));
    }
  }
  next();
});

const Product = mongoose.model("Product", productSchema);
export default Product;
