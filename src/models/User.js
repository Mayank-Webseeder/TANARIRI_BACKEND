import mongoose from "mongoose";
import bcrypt from "bcrypt";

const addressSchema = new mongoose.Schema(
  {
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    pincode: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    region: { type: String, trim: true },
  },
  { _id: false },
);

const bankDetailsSchema = new mongoose.Schema(
  {
    accountHolderName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    bankName: { type: String, required: true, trim: true },
    ifscCode: { type: String, trim: true },
    branchName: { type: String, trim: true },
    swiftCode: { type: String, trim: true },
    iban: { type: String, trim: true },
    routingNumber: { type: String },
    country: { type: String },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ["customer", "admin", "userpannel"],
      default: "customer",
    },
    isActive: { type: Boolean, default: true },
    phone: { type: String, sparse: true, unique: true },
    addresses: { type: [addressSchema], default: [] }, 
    modules: { type: [String], default: undefined },
    bankDetails: { type: bankDetailsSchema, default: undefined },
  },
  { timestamps: true },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.pre("save", function (next) {
  if (this.role === "userpannel" && !this.modules) {
    this.modules = [
      "/categories",
      "/users",
      "/catalogue/product",
      "/sales/orders",
    ];
  }

  if (this.role === "customer" && !this.phone) {
    return next(new Error("Phone is required for customer role"));
  }

  if (this.bankDetails && this.role !== "customer") {
    return next(new Error("Bank details can only be added for customers"));
  }

  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
