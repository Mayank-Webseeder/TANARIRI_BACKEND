import mongoose from "mongoose";
import { config } from "./env.js";

export const connectDatabase = async () => {
  try {
    const conn = await mongoose.connect(config.mongodbUrl);
    console.log(`MongoDB Connected: ${conn.connection.host}`.bgMagenta);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};
