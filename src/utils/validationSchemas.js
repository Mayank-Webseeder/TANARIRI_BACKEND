import Joi from 'joi';

export const signupSchema = Joi.object({
  firstName: Joi.string().required().trim(),
  lastName: Joi.string().required().trim(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  phone: Joi.string().required(),
  addresses: Joi.array().items(
    Joi.object({
      address: Joi.string().required(),
      pincode: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      country: Joi.string().required(),
    })
  ),
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
  role: Joi.string().valid('customer', 'admin', 'userpannel'),
  phone: Joi.string().when('role', {
    is: 'customer',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  addresses: Joi.array().items(
    Joi.object({
      address: Joi.string().required(),
      pincode: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      country: Joi.string().required(),
    })
  ),
  modules: Joi.array().items(Joi.string()),
  isActive: Joi.boolean(),
});

export const updateUserSchema = Joi.object({
  firstName: Joi.string().trim(),
  lastName: Joi.string().trim(),
  email: Joi.string().email(),
  phone: Joi.string(),
  addresses: Joi.array().items(
    Joi.object({
      address: Joi.string().required(),
      pincode: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      country: Joi.string().required(),
    })
  ),
  modules: Joi.array().items(Joi.string()),
  isActive: Joi.boolean(),
});

export const categorySchema = Joi.object({
  name: Joi.string().required().trim(),
  subCategories: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        label: Joi.string().required(),
      })
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
});

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
      })
    )
    .min(1)
    .required(),
  totalAmount: Joi.number().min(0).required(),
  shippingAddress: Joi.object({
    address: Joi.string().required(),
    pincode: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    country: Joi.string().required(),
  }).required(),
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
      })
    )
    .min(1)
    .required(),
  totalAmount: Joi.number().min(0).required(),
  shippingAddress: Joi.object({
    address: Joi.string().required(),
    pincode: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    country: Joi.string().required(),
  }).required(),
});
