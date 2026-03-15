const express = require("express");
const User = require("./models/User");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const path = require("path");

dotenv.config();

connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/test-user", async (req, res) => {

  try {

    const { name, email, password } = req.body;

    const newUser = new User({
      name,
      email,
      password
    });

    const savedUser = await newUser.save();

savedUser.password = undefined;

    res.status(201).json({
        message: "User saved successfully",
        data: savedUser
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Error saving user"
    });

  }

});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});