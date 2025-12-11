import express from "express";
import multer from "multer";
import path from "path";
import { submitHelpRequest } from "../controllers/helpController.js";

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/help/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "help-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, GIF, and WebP images are allowed"));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter,
});

/**
 * @swagger
 * /api/help/send-email:
 *   post:
 *     tags: [Help]
 *     summary: Submit a help request
 *     description: Send a help request email with optional image attachments
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: name
 *         type: string
 *         required: true
 *         description: Customer name
 *       - in: formData
 *         name: email
 *         type: string
 *         required: true
 *         description: Customer email
 *       - in: formData
 *         name: subject
 *         type: string
 *         required: true
 *         description: Help request subject
 *       - in: formData
 *         name: message
 *         type: string
 *         required: true
 *         description: Help request message
 *       - in: formData
 *         name: images
 *         type: file
 *         description: Optional images (max 5, 5MB each)
 *     responses:
 *       200:
 *         description: Help request sent successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post("/send-email", upload.array("images", 5), submitHelpRequest);

export default router;
