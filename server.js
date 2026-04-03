const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let rooms = {};
const PASSWORD = "1234";

io.on("connection", (socket) => {

  socket.on("join-room", ({ username, room, password }) => {

    if (password !== PASSWORD) {
      socket.emit("error-msg", "Şifre yanlış");
      return;
    }

    socket.join(room);

    if (!rooms[room]) rooms[room] = [];
    rooms[room].push({ id: socket.id, username });

    // 🔥 HERKESE GÖNDER
    io.emit("room-list", Object.keys(rooms));
    io.emit("user-list", rooms);

    socket.on("message", (msg) => {
      const data = { username, msg, time: Date.now() };
      io.to(room).emit("message", data);
    });

    socket.on("seen", (time) => {
      socket.to(room).emit("seen", time);
    });

    socket.on("typing", () => {
      socket.to(room).emit("typing", username);
    });

    socket.on("stop-typing", () => {
      socket.to(room).emit("stop-typing");
    });

    // ekran paylaşımı
    socket.on("offer",(d)=>socket.to(room).emit("offer",d));
    socket.on("answer",(d)=>socket.to(room).emit("answer",d));
    socket.on("ice-candidate",(d)=>socket.to(room).emit("ice-candidate",d));
    socket.on("stop-screen",()=>socket.to(room).emit("stop-screen"));

    socket.on("disconnect", () => {
      if (rooms[room]) {
        rooms[room] = rooms[room].filter(u => u.id !== socket.id);

        if (rooms[room].length === 0) {
          delete rooms[room];
        }

        io.emit("room-list", Object.keys(rooms));
        io.emit("user-list", rooms);
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server çalışıyor"));