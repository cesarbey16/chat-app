const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let rooms = {};

io.on("connection", (socket) => {

  // ✅ Yeni gelen herkese odaları gönder
  socket.emit("room-list", Object.keys(rooms));
  socket.emit("user-list", rooms);

  // ODA OLUŞTUR
  socket.on("create-room", ({ room, password, username }) => {
    if (rooms[room]) {
      socket.emit("error-msg", "Oda zaten var");
      return;
    }

    rooms[room] = { password, users: [] };

    socket.join(room);
    socket.room = room;

    rooms[room].users.push({ id: socket.id, username });

    io.emit("room-list", Object.keys(rooms));
    io.emit("user-list", rooms);
  });

  // ODAYA KATIL
  socket.on("join-room", ({ room, password, username }) => {
    if (!rooms[room]) {
      socket.emit("error-msg", "Oda yok");
      return;
    }

    if (rooms[room].password !== password) {
      socket.emit("error-msg", "Şifre yanlış");
      return;
    }

    socket.join(room);
    socket.room = room;

    rooms[room].users.push({ id: socket.id, username });

    io.emit("room-list", Object.keys(rooms));
    io.emit("user-list", rooms);
  });

  // MESAJ + SAAT
  socket.on("message", (msg) => {
    if (!socket.room) return;

    const now = new Date();
    const time =
      now.getHours().toString().padStart(2, "0") +
      ":" +
      now.getMinutes().toString().padStart(2, "0");

    io.to(socket.room).emit("message", {
      username: getUsername(socket.room, socket.id),
      msg,
      time,
    });
  });

  function getUsername(room, id) {
    const user = rooms[room]?.users.find((u) => u.id === id);
    return user ? user.username : "Bilinmiyor";
  }

  // TYPING
  socket.on("typing", () => {
    socket.to(socket.room).emit("typing", getUsername(socket.room, socket.id));
  });

  socket.on("stop-typing", () => {
    socket.to(socket.room).emit("stop-typing");
  });

  // WEBRTC SİNYALLEŞME
  socket.on("offer", (d) => socket.to(socket.room).emit("offer", d));
  socket.on("answer", (d) => socket.to(socket.room).emit("answer", d));
  socket.on("ice-candidate", (d) => socket.to(socket.room).emit("ice-candidate", d));
  socket.on("stop-screen", () => socket.to(socket.room).emit("stop-screen"));

  // ÇIKIŞ
  socket.on("disconnect", () => {
    const room = socket.room;
    if (!room || !rooms[room]) return;

    rooms[room].users = rooms[room].users.filter((u) => u.id !== socket.id);

    if (rooms[room].users.length === 0) delete rooms[room];

    io.emit("room-list", Object.keys(rooms));
    io.emit("user-list", rooms);
  });
});

server.listen(3000, () => console.log("Server çalışıyor"));
