import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs";

const multerStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new Error("Only images (jpeg, jpg, png, webp) are allowed"));
  }
};

export const uploadImages = multer({
  storage: multerStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter,
});

export const processProductImages = async (req, res, next) => {
  if (!req.files || req.files.length === 0) return next();

  const uploadDir = path.join(process.cwd(), "uploads", "products");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Pre-allocate array to maintain exact order of uploaded images
  req.body.processedImages = new Array(req.files.length);

  try {
    await Promise.all(
      req.files.map(async (file, index) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const filename = `product-${uniqueSuffix}-${index + 1}`;

        const highResName = `${filename}-high.webp`;

        // 1. High-Res 
        await sharp(file.buffer)
          .resize(1080, 1080, { fit: "cover" })
          .toFormat("webp")
          .webp({ quality: 85 })
          .toFile(path.join(uploadDir, highResName));

        // Base image object
        let imageObject = {
          highRes: `uploads/products/${highResName}`,
        };

        if (index === 0) {
          const lowResName = `${filename}-low.webp`;
          await sharp(file.buffer)
            .resize(400, 400, { fit: "cover" })
            .toFormat("webp")
            .webp({ quality: 65 })
            .toFile(path.join(uploadDir, lowResName));

          imageObject.lowRes = `uploads/products/${lowResName}`;
        }

        req.body.processedImages[index] = imageObject;
      }),
    );

    next();
  } catch (error) {
    console.error("Sharp Image Processing Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Error processing images" });
  }
};
