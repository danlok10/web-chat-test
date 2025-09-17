const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cookieParser());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true, // para producción limita al origen del frontend
    credentials: true
  }
});

let chatHistory = []; // {id, user, text, time, replyTo}
const users = {};     // userId -> username

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("set id", ({ id, username }) => {
    socket.userId = id || uuidv4();
    socket.username = username || users[socket.userId] || "Anonymous";
    users[socket.userId] = socket.username;

    socket.emit("chat history", chatHistory);
    io.emit("user list", Object.values(users));
    io.emit("server message", `${socket.username} joined the chat`);
  });

  socket.on("set username", (username) => {
    if (!socket.userId) socket.userId = uuidv4();
    socket.username = username;
    users[socket.userId] = username;
    io.emit("user list", Object.values(users));
  });

  socket.on("chat message", ({ text, replyTo }) => {
    const messageData = {
      id: uuidv4(),
      user: socket.username || "Anonymous",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      replyTo: replyTo || null
    };
    chatHistory.push(messageData);
    if (chatHistory.length > 200) chatHistory.shift();
    io.emit("chat message", messageData);
  });

  socket.on("disconnect", () => {
    if (socket.userId && users[socket.userId]) {
      const name = users[socket.userId];
      delete users[socket.userId];
      io.emit("server message", `${name} left the chat`);
      io.emit("user list", Object.values(users));
    }
    console.log("Socket disconnected:", socket.id);
  });
});

// Health endpoint
app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Socket server listening on :${PORT}`));
