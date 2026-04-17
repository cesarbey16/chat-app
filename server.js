const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

let rooms = {};

io.on("connection", socket => {

  socket.on("createRoom", ({name, pass})=>{
    if(!rooms[name]){
      rooms[name] = {pass, users:[], stream:false};
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

      rooms[room].users.push({id:socket.id, name:username});

      io.to(room).emit("users", rooms[room].users.map(u=>u.name));

      if(rooms[room].stream){
        socket.emit("screenStarted",{id:null});
      }

      updateRooms();
    }
  });

  socket.on("chatMessage", msg=>{
    io.to(socket.room).emit("message", {text:msg});
  });

  /* WEBRTC */
  socket.on("offer", ({offer, to})=>{
    io.to(to).emit("offer", {offer, from:socket.id});
  });

  socket.on("answer", ({answer, to})=>{
    io.to(to).emit("answer", {answer, from:socket.id});
  });

  socket.on("candidate", ({candidate, to})=>{
    io.to(to).emit("candidate", {candidate, from:socket.id});
  });

  /* SCREEN */
  socket.on("startScreen", ()=>{
    if(socket.room){
      rooms[socket.room].stream = true;
      socket.to(socket.room).emit("screenStarted",{id:socket.id});
    }
  });

  socket.on("disconnect", ()=>{
    if(socket.room && rooms[socket.room]){
      rooms[socket.room].users =
        rooms[socket.room].users.filter(u=>u.id!==socket.id);

      io.to(socket.room).emit("users", rooms[socket.room].users.map(u=>u.name));
      updateRooms();
    }
  });

  function updateRooms(target){
    const data = Object.keys(rooms).map(r=>({
      name:r,
      count:rooms[r].users.length,
      locked:!!rooms[r].pass
    }));

    if(target) target.emit("rooms", data);
    else io.emit("rooms", data);
  }

});

const PORT = process.env.PORT || 3000;
http.listen(PORT, ()=>console.log("Server çalışıyor:", PORT));
