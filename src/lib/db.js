import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(process.env.MONGO_URI);
    console.log("Połączono z MongoDB: " + connection.connection.host);
  } catch (error) {
    console.error("Błąd połączenia z MongoDB: " + error.message);
    process.exit(1);
  }
};

export { connectDB };
