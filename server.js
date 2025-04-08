
// You would host this with Render or another backend service
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

const users = {};
const messages = [];

io.on('connection', (socket) => {
  socket.on('join', (user) => {
    users[socket.id] = user;
    io.emit('user-joined', user);
  });

  socket.on('send-message', (msg) => {
    messages.push(msg);
    io.emit('receive-message', msg);
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    delete users[socket.id];
    io.emit('user-left', user);
  });
});

server.listen(5000, () => console.log('Server running on port 5000'));
