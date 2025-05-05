import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../lib/utils.js";
import cloudinary from "../lib/cloudinary.js";

const register = async (req, res) => {
  const { name, lastName, username, dateOfBirth, email, password } = req.body;
  try {
    if (
      !name ||
      !lastName ||
      !username ||
      !dateOfBirth ||
      !email ||
      !password
    ) {
      return res.status(400).json({ message: "Wszystkie pola są wymagane" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Hasło musi zawierać przynajmniej 6 znaków" });
    }
    if (username.length < 3) {
      return res.status(400).json({
        message: "Nazwa użytkownika musi zawierać przynajmniej 3 znaki",
      });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        message: "Ten email posiada już konto. Spróbuj się zalogować",
      });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({
        message: "Ta nazwa użytkownika jest już zajęta. Wybierz inną.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      lastName,
      username,
      dateOfBirth,
      email,
      password: hashedPassword,
    });

    if (!newUser) {
      return res
        .status(400)
        .json({ message: "Nie udało się utworzyć użytkownika" });
    }

    generateToken(newUser._id, res);

    await newUser.save();

    res.status(201).json({
      message: "Użytkownik został pomyślnie utworzony",
      user: {
        id: newUser._id,
        name: newUser.name,
        lastName: newUser.lastName,
        username: newUser.username,
        dateOfBirth: newUser.dateOfBirth,
        email: newUser.email,
        profilePicture: newUser.profilePicture,
        bio: newUser.bio,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Wystąpił błąd serwera" });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Uzupełnij dane" });
    }
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Niepoprawne dane" });
    }
    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(400).json({ message: "Niepoprawne dane" });
    }

    generateToken(user._id, res);
    res.status(200).json({
      message: "Zalogowano pomyślnie",
      user: {
        id: user._id,
        name: user.name,
        lastName: user.lastName,
        username: user.username,
        dateOfBirth: user.dateOfBirth,
        email: user.email,
        profilePicture: user.profilePicture,
        bio: user.bio,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Wystąpił błąd serwera" });
  }
};

const logout = (req, res) => {
  try {
    res.cookie("token", "", { maxAge: 0 });

    res.status(200).json({ message: "Wylogowano pomyślnie" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Wystąpił błąd serwera" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, lastName, username, dateOfBirth, bio, profilePicture } =
      req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!name || !lastName || !username || !dateOfBirth) {
      return res.status(400).json({ message: "Uzupełnij podstawowe dane" });
    }

    if (username.length < 3) {
      return res.status(400).json({
        message: "Nazwa użytkownika musi zawierać przynajmniej 3 znaki",
      });
    }

    // Check if username is taken (excluding current user)
    const existingUser = await User.findOne({
      username,
      _id: { $ne: userId },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Nazwa użytkownika jest już zajęta" });
    }

    // Prepare update data
    let updateData = {
      name,
      lastName,
      username,
      dateOfBirth,
      bio: bio || "",
    };

    // Handle profile picture if provided and different from current one
    if (
      profilePicture &&
      typeof profilePicture === "string" &&
      profilePicture.startsWith("data:")
    ) {
      try {
        console.log("Processing profile picture");
        const uploadResult = await cloudinary.uploader.upload(profilePicture, {
          folder: "tripchat_users",
          resource_type: "image",
          format: "jpg",
          transformation: [
            { width: 400, height: 400, crop: "limit" },
            { quality: "auto:good" },
          ],
        });

        updateData.profilePicture = uploadResult.secure_url;
        console.log("Profile picture uploaded successfully");
      } catch (error) {
        console.error("Failed to upload profile picture:", error);
        // Continue without updating the picture
      }
    }

    // Update user in database
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).select("-password -__v");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Wystąpił błąd serwera" });
  }
};

const updateUser = async (req, res) => {
  try {
    const { name, lastName, username, dateOfBirth, bio, profilePicture } =
      req.body;
    const userId = req.user._id;

    console.log("Update request received for user:", userId);

    // Validate inputs
    if (!name || !lastName || !username) {
      return res
        .status(400)
        .json({ message: "Name, last name, and username are required" });
    }

    // Check if username already exists (but exclude current user)
    const existingUser = await User.findOne({
      username,
      _id: { $ne: userId },
    });

    if (existingUser) {
      return res.status(400).json({ message: "Username already taken" });
    }

    // Use let instead of const for updateData since we might modify it later
    let updateData = {
      name,
      lastName,
      username,
      dateOfBirth,
      bio: bio || "",
    };

    // Handle profile picture if provided
    if (
      profilePicture &&
      typeof profilePicture === "string" &&
      profilePicture.startsWith("data:")
    ) {
      try {
        // Insert a delay to prevent rate limiting issues
        await new Promise((resolve) => setTimeout(resolve, 300));

        console.log("Processing profile picture");

        // Try to extract just the base64 part if it's a data URL
        const base64Data = profilePicture.split(",")[1];

        if (!base64Data) {
          console.error("Invalid image format");
          return res.status(400).json({ message: "Invalid image format" });
        }

        // Upload with fixed format to avoid issues
        const uploadResult = await cloudinary.uploader.upload(profilePicture, {
          folder: "tripchat_users",
          resource_type: "image",
          format: "jpg",
          transformation: [
            { width: 400, height: 400, crop: "limit" },
            { quality: "auto:good" },
          ],
        });

        updateData.profilePicture = uploadResult.secure_url;
        console.log("Image uploaded successfully");
      } catch (cloudinaryError) {
        console.error("Cloudinary upload error:", cloudinaryError);

        // Continue with update without changing the profile picture
        console.log("Continuing update without profile picture change");
        // Do not return error response here - continue with the update
      }
    }

    // Update the user data
    console.log("Updating user with data:", JSON.stringify(updateData));
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).select("-password -__v");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error in updateUser:", error.message);
    res.status(500).json({ message: "Server error", details: error.message });
  }
};

const checkAuth = (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Wystąpił błąd serwera" });
  }
};

export { register, login, logout, updateProfile, checkAuth, updateUser };
