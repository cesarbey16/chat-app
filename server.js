const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static("public"));

let rooms = {};

io.on("connection", (socket) => {

  socket.emit("room-list", Object.keys(rooms));
  socket.emit("user-list", rooms);

  socket.on("create-room", ({ room, password, username }) => {
    if (rooms[room]) return;

    rooms[room] = { password, users: [], host: null };

    socket.join(room);
    socket.room = room;

    rooms[room].users.push({ id: socket.id, username });

    io.emit("room-list", Object.keys(rooms));
    io.emit("user-list", rooms);
  });

  socket.on("join-room", ({ room, password, username }) => {
    if (!rooms[room]) return;
    if (rooms[room].password !== password) return;

    socket.join(room);
    socket.room = room;

    rooms[room].users.push({ id: socket.id, username });

    // 🔥 Eğer host varsa → yeni gelen için offer iste
    const hostId = rooms[room].host;
    if (hostId) {
      io.to(hostId).emit("request-offer");
    }

    io.emit("room-list", Object.keys(rooms));
    io.emit("user-list", rooms);
  });

  /* 🎬 HOST BAŞLAT */
  socket.on("start-stream", () => {
    if (!socket.room) return;

    rooms[socket.room].host = socket.id;

    io.to(socket.room).emit("stream-started", {
      username: getUser(socket.room, socket.id)
    });
  });

  /* 📩 OFFER İSTE */
  socket.on("request-offer", () => {
    socket.to(socket.room).emit("request-offer");
  });

  socket.on("message", (msg) => {
    if (!socket.room) return;

    const now = new Date();
    const time = now.getHours()+":"+now.getMinutes();

    io.to(socket.room).emit("message", {
      username: getUser(socket.room, socket.id),
      msg,
      time
    });
  });

  function getUser(room, id){
    return rooms[room]?.users.find(u=>u.id===id)?.username || "User";
  }

  socket.on("offer", d => socket.to(socket.room).emit("offer", d));
  socket.on("answer", d => socket.to(socket.room).emit("answer", d));
  socket.on("ice-candidate", d => socket.to(socket.room).emit("ice-candidate", d));

  socket.on("disconnect", () => {
    const room = socket.room;
    if (!room || !rooms[room]) return;

    // host ise sıfırla
    if (rooms[room].host === socket.id) {
      rooms[room].host = null;
      io.to(room).emit("stream-stopped");
    }

    rooms[room].users = rooms[room].users.filter(u => u.id !== socket.id);

    if (rooms[room].users.length === 0) delete rooms[room];

    io.emit("room-list", Object.keys(rooms));
    io.emit("user-list", rooms);
  });
});

server.listen(3000, () => console.log("Server çalışıyor"));
