module.exports = (socket, io, rooms, currentPlayer) => {
  socket.on("minigame initialization", (data) => {
    let clients = [];
    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].roomID === data.roomID) {
        clients = rooms[i].clients;
      }
    }
    io.in(data.roomID).emit("minigame initialization", {
      ...data,
      clients,
    });
  });

  socket.on("roll dice", (data) => {
    const { roomID, number, username } = data;
    io.in(roomID).emit("roll dice", {
      number,
      username,
    });
  });

  socket.on("answer question", (data) => {
    const { roomID, username } = data;
    io.in(roomID).emit("answer question", username);
  });

  socket.on("qn result", (data) => {
    const { roomID, score } = data;
    io.in(roomID).emit("qn result", {
      score,
    });
  });

  socket.on("next player", (data) => {
    const { username, roomID } = data;
    let nextPlayerName = "";
    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].roomID === roomID) {
        for (let j = 0; j < rooms[j].clients.length; j++) {
          if (rooms[i].clients[j] === username) {
            const len = rooms[i].clients[j].length;
            nextPlayerName = rooms[i].clients[(j + 1) % len];
            break;
          }
        }
        break;
      }
    }
    socket.broadcast.to(roomID).emit("next player", nextPlayerName);
  });

  socket.on("end game", (data) => {
    const { roomID } = data;
    io.broadcast.emit(roomID).emit("end game");
  });

  socket.on("minigame start", (data) => {
    console.log(`recv: minigame start ${JSON.stringify(data)}`);
    socket.broadcast.to(currentPlayer.roomID).emit("minigame start", data);
  });

  socket.on("minigame connect", (data) => {
    console.log(`${currentPlayer.name} recv: minigame connect`);
    for (let i = 0; i < rooms.length; i++) {
      console.log(`found roomlength${rooms.length}`);
      console.log(`${rooms[i].roomID} ${data.roomID}`);
      if (rooms[i].roomID === currentPlayer.roomID) {
        rooms[i].inMinigame = true;
        console.log("found roomID");
        for (let j = 0; j < rooms[i].clients.length; j++) {
          if (rooms[i].clients[j].name !== currentPlayer.name) {
            let playerConnected = {};
            playerConnected = {
              name: rooms[i].clients[j].name,
              roomID: rooms[i].clients[j].roomID,
              isOwner: rooms[i].clients[j].isOwner,
              position: rooms[i].clients[j].position,
            };
            console.log(playerConnected);
            // in your current game, we need to tell u about the other player
            socket.emit("other player connected minigame", playerConnected);
            console.log(
              `${
                currentPlayer.name
              } emit: other player connected minigame: ${JSON.stringify(
                playerConnected,
              )}`,
            );
          }
        }
      }
    }
  });

  socket.on("end turn", (data) => {
    let playerConnected = {};
    console.log(`${currentPlayer.name} recv: end turn`);
    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].roomID === currentPlayer.roomID) {
        console.log();
        for (let j = 0; j < rooms[i].clients.length; j++) {
          if (rooms[i].clients[j].name === currentPlayer.name) {
            let index = 0;
            if (j < rooms[i].clients.length - 1) {
              index = j + 1;
            }

            playerConnected = {
              name: rooms[i].clients[index].name,
              roomID: rooms[i].clients[index].roomID,
              isOwner: rooms[i].clients[index].isOwner,
              position: rooms[i].clients[index].position,
            };
            console.log(playerConnected);
          }
        }
      }
    }
    socket.broadcast
      .to(currentPlayer.roomID)
      .emit("next player", playerConnected);
    console.log(
      `${currentPlayer.name} emit: next player: ${JSON.stringify(
        playerConnected,
      )}`,
    );
  });
};
