import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { connectDB } from "./lib/db.js";

dotenv.config();

const app = express();
const server = createServer(app);

// CORS configuration
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Socket.IO setup with optimized settings for low latency
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  },
  pingTimeout: 60000,
  transports: ["websocket", "polling"],
  httpCompression: true,
  perMessageDeflate: {
    threshold: 2048, // Only compress messages larger than 2KB
  },
  // Speed optimizations
  upgradeTimeout: 10000,
  maxHttpBufferSize: 5e6, // 5MB
  // Disable throttling/buffering
  serveClient: false,
  allowEIO3: true,
});

// Store online users
const onlineUsers = new Map();

// Make io available globally
global.io = io;

// Socket.IO connection handler with optimized event handling
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Get user ID from query params
  const userId = socket.handshake.query.userId;

  if (userId) {
    // Store both userId and socketId for direct messaging
    onlineUsers.set(userId, socket.id);
    console.log("Online users:", Array.from(onlineUsers.keys()));
  }

  // Broadcast online users
  io.emit("getOnlineUsers", Array.from(onlineUsers.keys()));

  // Log all events for debugging
  const originalEmit = socket.emit;
  socket.emit = function () {
    console.log("SOCKET EMIT:", arguments[0]);
    return originalEmit.apply(this, arguments);
  };

  // Handle typing events
  socket.on("typing", (data) => {
    const { receiverId } = data;
    // Only forward typing events if recipient is online
    const receiverSocketId = onlineUsers.get(receiverId);

    if (receiverSocketId) {
      // Pass the userId so recipient knows who's typing
      io.to(receiverSocketId).emit("userTyping", {
        userId: userId,
      });
    }
  });

  socket.on("stopTyping", (data) => {
    const { receiverId } = data;
    const receiverSocketId = onlineUsers.get(receiverId);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userStoppedTyping", {
        userId: userId,
      });
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // Clear any typing indicators when user disconnects
    if (userId) {
      // Find all online users and notify them this user stopped typing
      for (const [otherUserId, otherSocketId] of onlineUsers.entries()) {
        if (otherUserId !== userId) {
          io.to(otherSocketId).emit("userStoppedTyping", {
            userId: userId,
          });
        }
      }

      // Remove user from online users
      onlineUsers.delete(userId);
      io.emit("getOnlineUsers", Array.from(onlineUsers.keys()));
    }
  });
});

// Express middleware
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
  connectDB();
});

// Export the io and onlineUsers for use in other files
export { io, onlineUsers };
