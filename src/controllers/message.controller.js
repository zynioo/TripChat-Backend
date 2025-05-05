import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { onlineUsers } from "../server.js";

const getUsersForSidebar = async (req, res) => {
  try {
    const userId = req.user._id;

    const filteredUsers = await User.find({ _id: { $ne: userId } })
      .select("-password -__v")
      .sort({ createdAt: -1 });

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Wystąpił błąd serwera" });
  }
};

const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const userId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: userId },
      ],
    });

    res.status(200).json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Wystąpił błąd serwera" });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!receiverId) {
      return res.status(400).json({ message: "Niepoprawne dane" });
    }

    let imageURL;

    if (image) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(image);
        imageURL = uploadResponse.secure_url;
      } catch (cloudinaryError) {
        console.error("Cloudinary upload error:", cloudinaryError);
      }
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text: text || "",
      image: imageURL || "",
    });

    // Save the message to DB
    const savedMessage = await newMessage.save();

    console.log("Message saved:", savedMessage._id);

    // Send response to client immediately
    res.status(201).json(savedMessage);

    // Then handle the socket emissions
    const recipientSocketId = onlineUsers.get(receiverId);
    const senderSocketId = onlineUsers.get(senderId.toString());

    if (global.io) {
      // Emit to recipient if online
      if (recipientSocketId) {
        console.log(
          `Emitting newMessage to recipient ${receiverId} (socket ${recipientSocketId})`
        );
        global.io.to(recipientSocketId).emit("newMessage", savedMessage);
      }

      // Emit confirmation back to sender
      if (senderSocketId) {
        console.log(
          `Emitting messageSent to sender ${senderId} (socket ${senderSocketId})`
        );
        global.io.to(senderSocketId).emit("messageSent", savedMessage);
      }
    }
  } catch (error) {
    console.error("Error in sendMessage controller:", error);
    res
      .status(500)
      .json({ message: "Wystąpił błąd serwera", error: error.message });
  }
};

// Add the missing getLastActivities function
const getLastActivities = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all conversations involving this user
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: userId.toString() },
            { receiverId: userId.toString() },
          ],
        },
      },
      {
        $sort: { createdAt: -1 }, // Sort by newest first
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$senderId", userId.toString()] },
              "$receiverId", // If user is sender, group by receiver
              "$senderId", // If user is receiver, group by sender
            ],
          },
          timestamp: { $first: "$createdAt" }, // Get the latest message date
        },
      },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          timestamp: 1,
        },
      },
    ]);

    res.status(200).json(conversations);
  } catch (error) {
    console.error("Error in getLastActivities:", error);
    res.status(500).json({ message: "Wystąpił błąd serwera" });
  }
};

// Add the missing markMessagesAsRead function if it doesn't exist
const markMessagesAsRead = async (req, res) => {
  try {
    const { id: otherUserId } = req.params;
    const userId = req.user._id;

    // Mark all messages from the other user to this user as read
    await Message.updateMany(
      {
        senderId: otherUserId,
        receiverId: userId,
        read: false,
      },
      {
        $set: { read: true },
      }
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in markMessagesAsRead:", error);
    res.status(500).json({ message: "Wystąpił błąd serwera" });
  }
};

// Add new controller function for deleting messages
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    // Find the message to delete
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: "Wiadomość nie znaleziona" });
    }

    // Check if the user is authorized to delete this message
    if (message.senderId.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Nie masz uprawnień do usunięcia tej wiadomości" });
    }

    // Delete the message
    await Message.findByIdAndDelete(messageId);

    // Notify users about the deleted message via socket
    const receiverSocketId = onlineUsers.get(message.receiverId);
    const senderSocketId = onlineUsers.get(message.senderId);

    if (global.io) {
      // Notify the receiver if online
      if (receiverSocketId) {
        global.io.to(receiverSocketId).emit("messageDeleted", { messageId });
      }

      // Also notify the sender (in case they have multiple devices)
      if (senderSocketId && senderSocketId !== receiverSocketId) {
        global.io.to(senderSocketId).emit("messageDeleted", { messageId });
      }
    }

    res.status(200).json({ message: "Wiadomość usunięta" });
  } catch (error) {
    console.error("Error deleting message:", error);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas usuwania wiadomości" });
  }
};

// Make sure to export the new functions
export {
  getUsersForSidebar,
  getMessages,
  sendMessage,
  deleteMessage,
  getLastActivities,
  markMessagesAsRead,
};
