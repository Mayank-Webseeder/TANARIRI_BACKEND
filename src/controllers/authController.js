import crypto from 'crypto';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateToken } from '../utils/jwt.js';
import { sendPasswordResetEmail, sendWelcomeEmail } from '../services/emailService.js';

const passwordResetTokens = new Map();

export const signup = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, phone, addresses } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, 'User already exists with this email');
  }

  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    phone,
    addresses,
    role: 'customer',
  });

  try {
    await sendWelcomeEmail(email, firstName);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
  }

  const token = generateToken(user._id, user.role);

  const userResponse = user.toObject();
  delete userResponse.password;

  res.status(201).json(
    new ApiResponse(201, 'User registered successfully', {
      user: userResponse,
      token,
    })
  );
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Account is deactivated');
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const token = generateToken(user._id, user.role);

  const userResponse = user.toObject();
  delete userResponse.password;

  res.json(
    new ApiResponse(200, 'Login successful', {
      user: userResponse,
      token,
    })
  );
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, 'User not found with this email');
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  passwordResetTokens.set(resetToken, {
    userId: user._id.toString(),
    expiresAt: Date.now() + 3600000,
  });

  try {
    await sendPasswordResetEmail(email, resetToken);
  } catch (error) {
    passwordResetTokens.delete(resetToken);
    throw new ApiError(500, 'Failed to send password reset email');
  }

  res.json(new ApiResponse(200, 'Password reset email sent'));
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  const resetData = passwordResetTokens.get(token);
  if (!resetData) {
    throw new ApiError(400, 'Invalid or expired reset token');
  }

  if (Date.now() > resetData.expiresAt) {
    passwordResetTokens.delete(token);
    throw new ApiError(400, 'Reset token has expired');
  }

  const user = await User.findById(resetData.userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  user.password = newPassword;
  await user.save();

  passwordResetTokens.delete(token);

  res.json(new ApiResponse(200, 'Password reset successful'));
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user._id;

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();

  res.json(new ApiResponse(200, 'Password changed successfully'));
});
