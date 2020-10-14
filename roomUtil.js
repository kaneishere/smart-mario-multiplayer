// socket.on("player connect",
// socket.on("disconnect",
// socket.on("get rooms",
const playerConnect = (data) => {
  console.log(`${currentPlayer.name} recv: player connect`);
  for (let i = 0; i < rooms.length; i++) {
    if (rooms[i].roomID === data.roomID) {
      console.log();
      if (rooms[i].roomCapacity > rooms[i].clients.length) {
        for (let j = 0; j < rooms[i].clients.length; j++) {
          let playerConnected = {};
          playerConnected = {
            name: rooms[i].clients[j].name,
            roomID: rooms[i].clients[j].roomID,
            isOwner: rooms[i].clients[j].isOwner,
            position: rooms[i].clients[j].position,
          };
          console.log(playerConnected);
          // in your current game, we need to tell u about the other player
          socket.join(data.roomID);
          socket.emit("other player connected", playerConnected);
          console.log(
            `${
              currentPlayer.name
            } emit: other player connected: ${JSON.stringify(playerConnected)}`,
          );
        }
      } else {
        console.log(`Room ${data.roomName} is full`);
        socket.emit("room is full", data);
      }
    }
  }
};

const getRooms = () => {
  const allRooms = [];
  for (let i = 0; i < rooms.length; i++) {
    if (!rooms[i].inMinigame) {
      const room = {
        roomID: rooms[i].roomID,
        roomName: rooms[i].roomName,
        roomOwner: rooms[i].roomOwner,
        noOfClients: rooms[i].noOfClients,
        roomCapacity: rooms[i].roomCapacity,
        minigameSelected: rooms[i].minigameSelected,
        difficultySelected: rooms[i].difficultySelected,
      };
      allRooms.push(room);
    }
  }
  const roomsData = {
    rooms: allRooms,
  };
  socket.emit("get rooms", roomsData);
};

const disconnect = (reason) => {
  console.log(`${currentPlayer.name} recv: disconnect ${currentPlayer.name}`);
  socket.broadcast
    .to(currentPlayer.roomID)
    .emit("other player disconnected", currentPlayer);
  console.log(
    `${currentPlayer.name} bcst: other player disconnected ${JSON.stringify(
      currentPlayer,
    )}`,
  );
  console.log(`reason: ${reason}`);
  for (let i = 0; i < rooms.length; i++) {
    if (rooms[i].roomID === currentPlayer.roomID) {
      for (let j = 0; j < rooms[i].clients.length; j++) {
        if (rooms[i].clients[j].name === currentPlayer.name) {
          rooms[i].clients.splice(j, 1);
          rooms[i].noOfClients -= 1;
          if (rooms[i].noOfClients === 1) {
            socket.broadcast.to(currentPlayer.roomID).emit("only player");
          }
        }
      }
      if (rooms[i].clients.length === 0) {
        rooms.splice(i, 1);
      } else if (currentPlayer.isOwner) {
        rooms[i].clients[0].isOwner = true;
        rooms[i].roomOwner = rooms[i].clients[0].name;
        socket.broadcast
          .to(currentPlayer.roomID)
          .emit("owner disconnected", rooms[i].clients[0]);
      }
    }
  }
  socket.leave(currentPlayer.roomID);
};

// socket.on("player move",
const playerMove = (data) => {
  console.log(`recv: move ${JSON.stringify(data)}`);
  currentPlayer.position = data.position;
  console.log(
    `${currentPlayer.name} recv: player move ${currentPlayer.roomID}`,
  );
  socket.broadcast.to(currentPlayer.roomID).emit("player move", currentPlayer);
};

module.exports = {
  playerConnect,
  getRooms,
  disconnect,
  playerMove,
};
