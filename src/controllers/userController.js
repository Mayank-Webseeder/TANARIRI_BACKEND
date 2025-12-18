import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, role, phone, addresses, modules, isActive } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, 'User already exists with this email');
  }

  const userData = {
    firstName,
    lastName,
    email,
    password,
    role: role || 'customer',
    isActive: isActive !== undefined ? isActive : true,
  };

  if (userData.role === 'customer') {
    if (!phone) {
      throw new ApiError(400, 'Phone is required for customer role');
    }
    userData.phone = phone;
    if (addresses) {
      userData.addresses = addresses;
    }
  } else if (userData.role === 'userpannel') {
    userData.modules = modules || ['/categories', '/users', '/catalogue/product', '/sales/orders'];
  }

  const user = await User.create(userData);

  const userResponse = user.toObject();
  delete userResponse.password;

  res.status(201).json(new ApiResponse(201, 'User created successfully', userResponse));
});

export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  if (updates.password) {
    throw new ApiError(400, 'Use change password endpoint to update password');
  }

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const allowedUpdates = ['firstName', 'lastName', 'email', 'phone', 'addresses', 'modules', 'isActive'];
  const updateKeys = Object.keys(updates);

  updateKeys.forEach((key) => {
    if (allowedUpdates.includes(key)) {
      user[key] = updates[key];
    }
  });

  await user.save();

  const userResponse = user.toObject();
  delete userResponse.password;

  res.json(new ApiResponse(200, 'User updated successfully', userResponse));
});

export const activateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  user.isActive = isActive;
  await user.save();

  const userResponse = user.toObject();
  delete userResponse.password;

  res.json(
    new ApiResponse(200, `User ${isActive ? 'activated' : 'deactivated'} successfully`, userResponse)
  );
});

export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findByIdAndDelete(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res.json(new ApiResponse(200, 'User deleted successfully'));
});

export const getAllUsers = asyncHandler(async (req, res) => {
  const { role } = req.query;

  const filter = {};
  if (role) {
    filter.role = role;
  }

  const users = await User.find(filter).select('-password');

  res.json(new ApiResponse(200, 'Users retrieved successfully', users));
});

export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id).select('-password');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res.json(new ApiResponse(200, 'User retrieved successfully', user));
});

export const updateAddress = asyncHandler(async (req, res) => {
  const { id, addressIndex } = req.params;
  const { address, pincode, city, state, country } = req.body;

  // Customer can only update their own addresses
  if (req.user.role === 'customer' && req.user._id.toString() !== id) {
    throw new ApiError(403, 'You can only update your own addresses');
  }

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (!user.addresses || !user.addresses[addressIndex]) {
    throw new ApiError(404, 'Address not found');
  }

  // Update address
  user.addresses[addressIndex] = {
    address: address || user.addresses[addressIndex].address,
    pincode: pincode || user.addresses[addressIndex].pincode,
    city: city || user.addresses[addressIndex].city,
    state: state || user.addresses[addressIndex].state,
    country: country || user.addresses[addressIndex].country,
  };

  await user.save();

  const userResponse = user.toObject();
  delete userResponse.password;

  res.json(new ApiResponse(200, 'Address updated successfully', userResponse));
});

export const deleteAddress = asyncHandler(async (req, res) => {
  const { id, addressIndex } = req.params;

  // Customer can only delete their own addresses
  if (req.user.role === 'customer' && req.user._id.toString() !== id) {
    throw new ApiError(403, 'You can only delete your own addresses');
  }

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (!user.addresses || !user.addresses[addressIndex]) {
    throw new ApiError(404, 'Address not found');
  }

  // Remove address
  user.addresses.splice(addressIndex, 1);
  
  await user.save();

  const userResponse = user.toObject();
  delete userResponse.password;

  res.json(new ApiResponse(200, 'Address deleted successfully', userResponse));
});
