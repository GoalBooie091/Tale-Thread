import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "storycrafter-scenes",
    allowed_formats: ["jpg", "png", "jpeg", "mp4", "webm"],
    resource_type: "auto"
  },
});
const upload = multer({ storage: storage });

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-key-change-in-production";
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:3000",
  "http://127.0.0.1:3000"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.static(path.join(__dirname, '..')));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

const authMiddleware = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(400).json({ error: "Invalid token." });
  }
};

const loggerMiddleware = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
};

app.use(loggerMiddleware);

app.get("/ssr/home", async (req, res) => {
  const token = req.cookies.token;
  let user = null;
  
  if (token) {
    try {
      user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      user = null;
    }
  }
  
  const stories = await prisma.story.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { username: true } } }
  });

  res.render("home", {
    title: "StoryCrafter AI - Home",
    user: user,
    stories: stories
  });
});

app.get("/api/stories", authMiddleware, async (req, res) => {
  const stories = await prisma.story.findMany({
    where: { authorId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { username: true } } }
  });
  res.json(stories);
});

app.get("/api/stories/:id", authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
  
  const story = await prisma.story.findUnique({
    where: { id },
    include: { author: { select: { username: true } } }
  });
  
  if (!story) return res.status(404).json({ error: "Story not found" });
  res.json(story);
});

app.post("/api/auth/signup", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(400).json({ error: "User already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  
  const newUser = await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword
    }
  });

  console.log(`✅ New user registered: ${username}`);
  res.status(201).json({ message: "User created successfully", userId: newUser.id });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: "24h" }
  );

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000
  });

  console.log(`✅ User logged in: ${user.username}`);

  res.json({ 
    message: "Login successful", 
    token,
    user: { id: user.id, username: user.username, email: user.email }
  });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json({ 
    id: user.id, 
    username: user.username, 
    email: user.email 
  });
});

app.post("/api/upload", authMiddleware, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  res.json({ url: req.file.path });
});

app.post("/api/generate", authMiddleware, async (req, res) => {
  const prompt = req.body?.prompt || "";
  console.log(`📩 Prompt received:`, prompt.substring(0, 80));

  try {
    const data = await callGemini(prompt);
    
    const newStory = await prisma.story.create({
      data: {
        prompt,
        storyText: data.story,
        references: data.references || [],
        authorId: req.user.id
      },
      include: { author: { select: { username: true } } }
    });
    
    io.emit("new-story", newStory);

    res.json(newStory);
  } catch (err) {
    console.error("❌ AI Error:", err);
    res.status(500).json({ error: String(err) });
  }
});

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY in .env");

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${key}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini error ${resp.status}: ${errText}`);
  }

  const json = await resp.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  console.log("✅ Gemini response received, length:", text.length);

  return { story: text.trim(), references: [] };
}

io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on("generate-story", async (data) => {
    try {
      const result = await callGemini(data.prompt);
      socket.emit("story-generated", result);
    } catch (err) {
      socket.emit("error", { error: err.message });
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

app.get("/", (req, res) => {
  res.send("✅ StoryCrafter backend running - Visit /ssr/home for SSR page");
});

app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

if (process.env.NODE_ENV !== "test") {
  httpServer.listen(PORT, () => {
    console.log(`🚀 Backend running on http://localhost:${PORT}`);
    console.log(`🔌 Socket.io ready on port ${PORT}`);
    console.log(`📄 SSR Home page: http://localhost:${PORT}/ssr/home`);
  });
}

export { app, httpServer, io };