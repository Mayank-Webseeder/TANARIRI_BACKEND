import Joi from "joi";

const addressValidation = Joi.object({
  address: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  country: Joi.string().required(),
  pincode: Joi.string().allow("", null).optional(),
  postalCode: Joi.string().allow("", null).optional(),
  addressLine2: Joi.string().allow("", null).optional(),
  region: Joi.string().allow("", null).optional(),
});

const bankDetailsValidation = Joi.object({
  accountHolderName: Joi.string().trim().required(),
  accountNumber: Joi.string().trim().required(),
  bankName: Joi.string().trim().required(),
  country: Joi.string().trim().allow("", null).optional(),
  ifscCode: Joi.string().trim().allow("", null).optional(),
  branchName: Joi.string().trim().allow("", null).optional(),
  swiftCode: Joi.string().trim().allow("", null).optional(),
  routingNumber: Joi.string().trim().allow("", null).optional(),
  iban: Joi.string().trim().allow("", null).optional(),
});

export const signupSchema = Joi.object({
  firstName: Joi.string().required().trim(),
  lastName: Joi.string().required().trim(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  phone: Joi.string().required(),
  addresses: Joi.array().items(addressValidation),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

export const createUserSchema = Joi.object({
  firstName: Joi.string().required().trim(),
  lastName: Joi.string().required().trim(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid("customer", "admin", "userpannel"),
  phone: Joi.string().when("role", {
    is: "customer",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  addresses: Joi.array().items(addressValidation),
  modules: Joi.array().items(Joi.string()),
  isActive: Joi.boolean(),
});

export const updateUserSchema = Joi.object({
  firstName: Joi.string().trim(),
  lastName: Joi.string().trim(),
  email: Joi.string().email(),
  phone: Joi.string(),
  addresses: Joi.array().items(addressValidation),
  modules: Joi.array().items(Joi.string()),
  isActive: Joi.boolean(),
  bankDetails: bankDetailsValidation.optional(),
});

export const categorySchema = Joi.object({
  name: Joi.string().required().trim(),
  subCategories: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        label: Joi.string().optional(),
      }),
    )
    .min(1)
    .required(),
});

export const productSchema = Joi.object({
  productName: Joi.string().required().trim(),
  description: Joi.string().required(),
  originalPrice: Joi.number().min(0).required(),
  discountPrice: Joi.number().min(0).required(),
  productImages: Joi.array().items(Joi.string()),
  category: Joi.string().required(),
  subCategoryId: Joi.string().required(),
  stock: Joi.number().min(0).required(),
  isActive: Joi.boolean(),
  bestSeller: Joi.boolean(),
  hideProduct: Joi.boolean(),
}).unknown(true);

export const supportSchema = Joi.object({
  title: Joi.string().required().trim(),
  description: Joi.string().required(),
  customerInfo: Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().required(),
  }).required(),
});

const shippingAddressSchema = Joi.object({
  address: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  country: Joi.string().required(),
  pincode: Joi.string().allow("", null).optional(),
  postalCode: Joi.string().allow("", null).optional(),
  addressLine2: Joi.string().allow("", null).optional(),
});

export const orderSchema = Joi.object({
  customerId: Joi.string().hex().length(24).required(),
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().required(),
        name: Joi.string().required(),
        price: Joi.number().min(0).required(),
        quantity: Joi.number().min(1).required(),
        subtotal: Joi.number().min(0).required(),
      }),
    )
    .min(1)
    .required(),
  totalAmount: Joi.number().min(0).required(),
  shippingAddress: shippingAddressSchema.required(),
  paymentMethod: Joi.string().valid("online", "cod").required(),
  paymentInfo: Joi.object({
    razorpayOrderId: Joi.string(),
    razorpayPaymentId: Joi.string(),
    razorpaySignature: Joi.string(),
    status: Joi.string().valid("pending", "completed", "failed"),
  }),
});

export const customerOrderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().required(),
        name: Joi.string().required(),
        price: Joi.number().min(0).required(),
        quantity: Joi.number().min(1).required(),
        subtotal: Joi.number().min(0).required(),
      }),
    )
    .min(1)
    .required(),
  totalAmount: Joi.number().min(0).required(),
  shippingAddress: shippingAddressSchema.required(),
});

// export const customerOrderSchema = Joi.object({
//   items: Joi.array()
//     .items(
//       Joi.object({
//         productId: Joi.string().hex().length(24).required(),
//         quantity: Joi.number().integer().min(1).required(),
//       })
//     )
//     .min(1)
//     .required(),

//   shippingAddress: Joi.object({
//     address: Joi.string().required(),
//     pincode: Joi.string().required(),
//     city: Joi.string().required(),
//     state: Joi.string().required(),
//     country: Joi.string().required(),
//   }).required(),
// });
