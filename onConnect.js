const create_UUID = () => {
  let dt = new Date().getTime();
  const uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (dt + Math.random() * 16) % 16 | 0;
    dt = Math.floor(dt / 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

  return uuid;
};

module.exports = (socket, currentPlayer, playerSpawnPoints, rooms) => {
  socket.on("play", (data) => {
    console.log(`${currentPlayer.name} recv: play: ${JSON.stringify(data)}`);

    if (rooms.length === 0) {
      playerSpawnPoints = [];
      data.playerSpawnPoints.forEach((_playerSpawnPoint) => {
        const playerSpawnPoint = {
          position: _playerSpawnPoint.position,
        };
        playerSpawnPoints.push(playerSpawnPoint);
      });
    }

    let roomFound = false;
    let index = 0;

    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].roomID === data.roomID) {
        roomFound = true;
        index = i;
        break;
      }
    }

    if (!roomFound) {
      const clients = [];
      currentPlayer = {
        name: data.name,
        roomID: create_UUID(),
        isOwner: data.isOwner,
        position: playerSpawnPoints[0].position,
      };
      clients.push(currentPlayer);
      const currentRoom = {
        roomID: currentPlayer.roomID,
        roomName: data.roomName,
        roomCapacity: data.capacity,
        roomOwner: data.name,
        noOfClients: clients.length,
        minigameSelected: data.minigameSelected,
        difficultySelected: data.difficultySelected,
        inMinigame: false,
        // more to be added like minigame selected
        clients,
      };
      rooms.push(currentRoom);
      socket.join(currentPlayer.roomID);
      console.log(
        `${currentPlayer.name} emit: play: ${JSON.stringify(currentPlayer)}`,
      );
      socket.emit("play", currentPlayer);
    } else if (rooms[index].roomCapacity <= rooms[index].clients.length) {
      console.log(`Room ${data.roomName} is full`);
      socket.emit("room is full", data);
    } else {
      currentPlayer = {
        name: data.name,
        roomID: data.roomID,
        isOwner: data.isOwner,
        position: playerSpawnPoints[rooms[index].clients.length].position,
      };
      rooms[index].clients.push(currentPlayer);
      rooms[index].noOfClients += 1;
      // in your current game, tell you that you have joined
      console.log(
        `${currentPlayer.name} emit: play: ${JSON.stringify(currentPlayer)}`,
      );
      socket.emit("play", currentPlayer);
      // in your current game, we need to tell the other player except you
      socket.broadcast
        .to(data.roomID)
        .emit("other player connected", currentPlayer);
    }
  });
};
