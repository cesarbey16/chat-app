const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

let rooms = {};
let users = {};

io.on("connection", socket => {

  socket.on("createRoom", ({name, pass}) => {
    if(!rooms[name]){
      rooms[name] = {pass, users:[]};
      updateRooms();
    }
  });

  socket.on("getRooms", ()=>{
    updateRooms(socket);
  });

  socket.on("joinRoom", ({room, username, pass})=>{
    if(rooms[room] && rooms[room].pass === pass){
      socket.join(room);
      socket.room = room;
      socket.username = username;

      rooms[room].users.push(username);
      users[socket.id] = username;

      io.to(room).emit("users", rooms[room].users);
      updateRooms();
    }
  });

  socket.on("chatMessage", msg=>{
    io.to(socket.room).emit("message", {text:msg});
  });

  socket.on("startScreen", ()=>{
    socket.to(socket.room).emit("screenStarted");
  });

  socket.on("stopScreen", ()=>{
    socket.to(socket.room).emit("screenStopped");
  });

  socket.on("disconnect", ()=>{
    if(socket.room && rooms[socket.room]){
      rooms[socket.room].users =
        rooms[socket.room].users.filter(u=>u!==socket.username);

      delete users[socket.id];
      updateRooms();
    }
  });

  function updateRooms(target){
    const data = Object.keys(rooms).map(r => ({
      name:r,
      count:rooms[r].users.length,
      locked:!!rooms[r].pass
    }));

    if(target) target.emit("rooms", data);
    else io.emit("rooms", data);

    io.emit("onlineCount", Object.keys(users).length);
  }

});

const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {
  console.log("Server çalışıyor:", PORT);
});
