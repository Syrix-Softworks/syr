
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const multer = require("multer");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const upload = multer({ dest: "uploads/" });

app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));
app.use(bodyParser.json());

const users = {};
const groups = {};
const dms = {};
const sockets = {};
const typing = {};

function saveHistory(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

app.post("/register", (req, res) => {
  const { username, password } = req.body;
  if (users[username]) return res.status(400).json({ message: "Username taken" });
  users[username] = { password, avatar: "/uploads/default.png", friends: [] };
  res.json({ message: "Registered successfully" });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!users[username] || users[username].password !== password)
    return res.status(400).json({ message: "Invalid credentials" });
  res.json({ message: "Login successful", user: users[username] });
});

app.post("/upload-avatar", upload.single("avatar"), (req, res) => {
  const username = req.body.username;
  if (!users[username]) return res.status(404).json({ message: "User not found" });
  users[username].avatar = "/uploads/" + req.file.filename;
  res.json({ message: "Avatar uploaded", path: users[username].avatar });
});

app.post("/create-group", upload.single("avatar"), (req, res) => {
  const { name, creator } = req.body;
  const groupId = Date.now().toString();
  groups[groupId] = {
    name,
    avatar: req.file ? "/uploads/" + req.file.filename : "/uploads/default.png",
    members: [creator],
    messages: []
  };
  res.json({ message: "Group created", groupId });
});

io.on("connection", (socket) => {
  socket.on("join", (username) => {
    socket.username = username;
    sockets[username] = socket;
    socket.emit("joined", { message: "Welcome " + username });
  });

  socket.on("send-group", ({ groupId, message }) => {
    const group = groups[groupId];
    if (!group) return;
    const payload = { from: socket.username, message, time: Date.now() };
    group.messages.push(payload);
    group.members.forEach(member => {
      if (sockets[member]) sockets[member].emit("group-message", { groupId, ...payload });
    });
  });

  socket.on("send-dm", ({ to, message }) => {
    const from = socket.username;
    const key = [from, to].sort().join("-");
    if (!dms[key]) dms[key] = [];
    const payload = { from, message, time: Date.now() };
    dms[key].push(payload);
    [from, to].forEach(user => {
      if (sockets[user]) sockets[user].emit("dm", { key, ...payload });
    });
  });

  socket.on("typing", ({ groupId }) => {
    groupId && socket.broadcast.emit("typing", { from: socket.username, groupId });
  });

  socket.on("disconnect", () => {
    delete sockets[socket.username];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on http://localhost:" + PORT);
});
