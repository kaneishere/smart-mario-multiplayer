const { Console } = require("console");

const app = require("express")();
const server = require("http").Server(app);
const io = require("socket.io")(server);

server.listen(3000);

// global variables for the Server
const rooms = [];
let playerSpawnPoints = [];
let messageLog ={};

function create_UUID() {
  let dt = new Date().getTime();
  const uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (dt + Math.random() * 16) % 16 | 0;
    dt = Math.floor(dt / 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

  return uuid;
}

app.get("/", (req, res) => {
  res.send("hey you got back get \"/\"");
});

io.on("connection", (socket) => {
  let currentPlayer = {};
  currentPlayer.name = "unknown";

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
        currentTurn: false,
        customChar: data.customChar,
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
        levelSelected: data.levelSelected,
        levelComplete: false,
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
        currentTurn: false,
        customChar: data.customChar,
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
    messageLog.message = "You rolled a " + data.anyIntVariable;
    console.log(messageLog);
    socket.emit("update message", messageLog);

    messageLog.message = currentPlayer.name + " rolled a " + data.anyIntVariable;
    console.log(messageLog);
    socket.broadcast.to(currentPlayer.roomID).emit("update message", messageLog);
  });

  socket.on("answer question", () => {
    messageLog.message = "You are answering a qn";
    console.log(messageLog);
    socket.emit("update message", messageLog);
    
    messageLog.message = currentPlayer.name + " is answering a qn";
    console.log(messageLog);
    socket.broadcast.to(currentPlayer.roomID).emit("update message", messageLog);
  });

  socket.on("qn result", (data) => {
    scoreChange = parseInt(data.anyIntVariable, 10);
    
    if (scoreChange > 0)
      messageLog.message = "You answered a qn correctly";
    else
      messageLog.message = "You answered a qn wrongly";
    console.log(messageLog);
    socket.emit("update message", messageLog);
    
    if (scoreChange > 0)
      messageLog.message = currentPlayer.name + " answered a qn correctly";
    else
      messageLog.message = currentPlayer.name + " answered a qn wrongly";
    console.log(messageLog);
    socket.broadcast.to(currentPlayer.roomID).emit("update message", messageLog);
    
    playerScoreChange = {
      playerName: currentPlayer.name,
      scoreChange: scoreChange
    };
    socket.broadcast.to(currentPlayer.roomID).emit("score change", playerScoreChange);
  });

  socket.on("end game", () => {
    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].roomID === currentPlayer.roomID) {
        rooms[i].levelComplete = true;
      }
    }
    socket.broadcast.to(currentPlayer.roomID).emit("end game");
  });

  socket.on("player connect", (data) => {
    console.log(`${currentPlayer.name} recv: player connect`);
    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].roomID === data.roomID) {
        console.log();
        if (rooms[i].roomCapacity > rooms[i].clients.length) {
          for (let j = 0; j < rooms[i].clients.length; j++) {
            let playerConnected = {};
            playerConnected = rooms[i].clients[j];
            console.log(playerConnected);
            // in your current game, we need to tell u about the other player
            socket.join(data.roomID);
            socket.emit("other player connected", playerConnected);
            console.log(
              `${
                currentPlayer.name
              } emit: other player connected: ${JSON.stringify(
                playerConnected,
              )}`,
            );
          }
        } else {
          console.log(`Room ${data.roomName} is full`);
          socket.emit("room is full", data);
        }
      }
    }
  });

  socket.on("minigame start", (data) => {
    console.log(`recv: minigame start ${JSON.stringify(data)}`);
    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].roomID === currentPlayer.roomID) {
        for (let j = 0; j < rooms[i].clients.length; j++) {
          if (rooms[i].clients[j].name === currentPlayer.name) {
            rooms[i].clients[j].currentTurn = true;
            break;
          }
        }
        break;
      }
    }
    socket.broadcast.to(currentPlayer.roomID).emit("minigame start", data);
  });

  socket.on("minigame connect", (data) => {
    let currentTurnPlayerName;
    console.log(`${currentPlayer.name} recv: minigame connect`);
    for (let i = 0; i < rooms.length; i++) {
      console.log(`found roomlength${rooms.length}`);
      console.log(`${rooms[i].roomID } ${ data.roomID}`);
      if (rooms[i].roomID === currentPlayer.roomID) {
        rooms[i].inMinigame = true;
        console.log("found roomID");
        for (let j = 0; j < rooms[i].clients.length; j++) {
          if (rooms[i].clients[j].isOwner)
            currentTurnPlayerName = rooms[i].clients[j].name;
          if (rooms[i].clients[j].name !== currentPlayer.name) {
            let playerConnected = {};
            playerConnected = rooms[i].clients[j];
            console.log(playerConnected);
            // in your current game, we need to tell u about the other player
            socket.emit("other player connected minigame", playerConnected);
            console.log(
              `${currentPlayer.name
              } emit: other player connected minigame: ${
                JSON.stringify(playerConnected)}`,
            );
            messageLog.message = playerConnected.name + " has joined";
            console.log(messageLog);
            socket.emit('update message', messageLog);
          }
        }
        break;
      }
    }
    messageLog.message = currentTurnPlayerName + "'s turn";
    console.log(messageLog);
    socket.emit('update message', messageLog);
  });

  socket.on("end turn", (data) => {
    let playerConnected = {};
    console.log(`${currentPlayer.name} recv: end turn`);
    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].roomID === currentPlayer.roomID) {
        console.log();
        for (let j = 0; j < rooms[i].clients.length; j++) {
          if (rooms[i].clients[j].name === currentPlayer.name) {
            const len = rooms[i].clients.length;
            playerConnected = rooms[i].clients[(j + 1) % len];
            rooms[i].clients[j].currentTurn = false;
            rooms[i].clients[(j + 1) % len].currentTurn = true;
            console.log(playerConnected);
          }
        }
      }
    }
    socket.broadcast
      .to(currentPlayer.roomID)
      .emit("next player", playerConnected);
    console.log(
      `${currentPlayer.name
      } emit: next player: ${
        JSON.stringify(playerConnected)}`,
    );
    messageLog.message = playerConnected.name + "'s turn";
    console.log(messageLog);
    io.in(currentPlayer.roomID).emit('update message', messageLog);
  });

  socket.on("player move", (data) => {
    console.log(`recv: move ${JSON.stringify(data)}`);
    currentPlayer.position = data.position;
    console.log(
      `${currentPlayer.name} recv: player move ${currentPlayer.roomID}`,
    );
    socket.broadcast
      .to(currentPlayer.roomID)
      .emit("player move", currentPlayer);
  });

  //TODO returning to lobby before closing the application cause disconnect to occur twice resulting
  // in for loop rooms[i].clients to be undefined as the first disconnect has removed the room entirely
  // can be fixed by following 'reason' (if-else loop) 
  socket.on("disconnect", (reason) => {
    console.log(`${currentPlayer.name} recv: disconnect ${currentPlayer.name}`);
    socket.broadcast
      .to(currentPlayer.roomID)
      .emit("other player disconnected", currentPlayer);
    console.log(
      `${currentPlayer.name
      } bcst: other player disconnected ${
        JSON.stringify(currentPlayer)}`,
    );
    console.log(`reason: ${reason}`);
    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].roomID === currentPlayer.roomID) {
        for (let j = 0; j < rooms[i].clients.length; j++) {
          if (rooms[i].clients[j].name === currentPlayer.name) {
            // if current turn in minigame is the player that is disconnected
            // assign current turn to next player
            if (rooms[i].clients[j].currentTurn) {
              nextPlayerIndex = (j+1)%(rooms[i].clients.length)
              rooms[i].clients[nextPlayerIndex].currentTurn = true;
              socket.emit('next player', rooms[i].clients[nextPlayerIndex]);
            }
            // remove player disconnected from clients array in the room
            rooms[i].clients.splice(j, 1);
            rooms[i].noOfClients -= 1;
          }
        }
        // if room is in Minigame session, update message log and remove player that disconnects
        if (rooms[i].inMinigame) {
          messageLog.message = currentPlayer.name + " has disconnected"
          socket.broadcast.to(currentPlayer.roomID).emit("update message", messageLog);
          socket.broadcast.to(currentPlayer.roomID).emit("player left minigame", currentPlayer);
          // if only one client in a minigame, end the game and bring the player back to lobby
          if (rooms[i].clients.length === 1 && !rooms[i].levelComplete) {
            socket.broadcast.to(currentPlayer.roomID).emit("one player left");
          }
        }

        // check room is empty or that the owner of the room is disconnected
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
  });

  socket.on("get rooms", () => {
    const allRooms = [];
    for (let i = 0; i < rooms.length; i++) {
      // if clients are in a minigame, do not include it as a room that is available to join
      if (!rooms[i].inMinigame) {
        const room = {
          roomID: rooms[i].roomID,
          roomName: rooms[i].roomName,
          roomOwner: rooms[i].roomOwner,
          noOfClients: rooms[i].noOfClients,
          roomCapacity: rooms[i].roomCapacity,
          minigameSelected: rooms[i].minigameSelected,
          difficultySelected: rooms[i].difficultySelected,
          levelSelected: rooms[i].levelSelected,
        };
        allRooms.push(room);
      }
    }
    const roomsData = {
      rooms: allRooms,
    };
    socket.emit("get rooms", roomsData);
  });
});

console.log("----server is running...");