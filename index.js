/* eslint-disable no-restricted-syntax */
const PORT = process.env.PORT || 3000;
const io = require("socket.io").listen(PORT);

console.log(`listening at port ${PORT}`);

const clients = {};
const rooms = {};
let playersConnected = 0;

const createRoom = (roomId, capacity, owner) => {
  rooms[roomId] = { fullCapacity: capacity, capacity, owner };
};

io.on("connection", (socket) => {
  console.log("new player joined");
  console.log(`number of players ${++playersConnected}`);

  socket.on("join room", (data) => {
    const { username, isRoomOwner, roomId, capacity } = data;
    clients[username] = { username, isRoomOwner, roomId };

    if (!(roomId in rooms)) {
      createRoom(roomId, capacity, username);
    }
    console.log(`roomId: ${roomId}`);
    if (rooms[roomId].capacity === 0) {
      console.log("can't join room");
      socket.emit("unable to join room: Room full");
      return;
    }

    socket.join(roomId);
    io.to(roomId).emit("new player", data);

    rooms[roomId].capacity--;

    if (isRoomOwner) socket.emit(`create room in database`);
    else {
      socket.emit("update room capacity in database", {
        newCapacity: rooms[roomId].capacity,
      });
    }
    console.log(rooms);
    console.log(clients);
    console.log(socket.rooms);
  });

  socket.on("leave room", (data) => {
    const { username, isRoomOwner, roomId } = data;
    socket.leave(roomId, () => {
      if (!(roomId in rooms)) return;
      if (++rooms[roomId].capacity === rooms[roomId].fullCapacity) {
        socket.emit("remove room from database");
        delete rooms[roomId];
      } else if (isRoomOwner) {
        clients[username].isRoomOwner = false;
        clients[username].roomId = -1;
        clients[username].capacity = -1;
        for (const client in clients) {
          if (clients[client].roomId === roomId) {
            rooms[roomId].owner = client;
            io.to(roomId).emit("new owner", { client });
            break;
          }
        }
      }
      console.log(clients);
      console.log(rooms);
      console.log(socket.rooms);
    });
  });

  socket.on("player move", (data) => {
    const { username, roomId, position } = data;
    clients[username.position] = position;
    io.room(roomId).emit("change position", data);
  });
});
