import express from "express";
import protectedRoute from "../middleware/auth.middleware.js";
import {
  getUsersForSidebar,
  getMessages,
  sendMessage,
  deleteMessage,
  getLastActivities,
  markMessagesAsRead,
} from "../controllers/message.controller.js";

const router = express.Router();

router.get("/users", protectedRoute, getUsersForSidebar);
router.get("/last-activities", protectedRoute, getLastActivities);
router.get("/:id", protectedRoute, getMessages);
router.post("/read/:id", protectedRoute, markMessagesAsRead);
router.post("/send/:id", protectedRoute, sendMessage);
router.delete("/delete/:messageId", protectedRoute, deleteMessage);

export default router;
