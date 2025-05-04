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
    const { name, lastName, username, dateOfBirth, profilePicture } = req.body;

    const userId = req.user._id;

    if (!name || !lastName || !username || !dateOfBirth || !profilePicture) {
      return res.status(400).json({ message: "Uzupełnij dane" });
    }

    if (username.length < 3) {
      return res.status(400).json({
        message: "Nazwa użytkownika musi zawierać przynajmniej 3 znaki",
      });
    }

    if (!name.trim()) {
      return res.status(400).json({ message: "Imię nie może być puste" });
    }

    if (!lastName.trim()) {
      return res.status(400).json({ message: "Nazwisko nie może być puste" });
    }

    const image = req.user.profilePicture;
    if (profilePicture !== req.user.profilePicture) {
      image = await cloudinary.uploader.upload(profilePicture);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        name,
        lastName,
        username,
        dateOfBirth,
        profilePicture: image.secure_url,
      },
      { new: true }
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Wystąpił błąd serwera" });
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

export { register, login, logout, updateProfile, checkAuth };
