const { Console } = require("console");

const debug = process.argv.slice(2)[0] === "debug";
if (!debug) {
  console.log = () => {};
}

const app = require("express")();
/**
 * Server object
 */
const server = require("http").Server(app);
/**
 * Web socket object
 */
const io = require("socket.io")(server);

/**
 * Specifies which port to listen to
 */
const PORT = process.env.PORT || 3000;

server.listen(PORT);

// global variables for the Server
/**
 * Array containing properties of each room
 */
const rooms = [];
/**
 * Array containing spawn points for each player
 */
let playerSpawnPoints = [];
/**
 *  Contains most recent event and data related to the event
 */
const messageLog = {};

/**
 *  Generates a Unique User ID for a user
 */
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
  res.send('hey you got back get "/"');
});

/**
 * Handles player connection event
 * @function onConnection
 *
 */
io.on("connection", (socket) => {
  /**
   * Player object stored in closure
   * with player attributes
   * @name currentPlayer
   */
  let currentPlayer = {};
  currentPlayer.name = "unknown";

  /**
   * Handles "play" event
   * @function onPlay
   * @param {Object} data - JSON object containing information about the player
   * @param {Array} data.playerSpawnPoints - An array of floats containing the player's location on the xyz plane.
   * @param {string} data.roomName - name of the room
   * @param {string} data.customChar indicate character selected
   * @param {string} data.name - name of the player
   * @param {string} data.roomPassword - password selected for the room
   * @param {string} data.minigameSelected - minigame selected
   * @param {string} data.difficultySelected - difficulty selected
   * @param {string} data.levelSelected - level selected
   */
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
        roomPassword: data.roomPassword,
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
    } else if (rooms[index].roomPassword !== data.roomPassword) {
      console.log(`Password for Room ${data.roomName} is incorrect`);
      socket.emit("wrong room password", data);
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

  /**
   * Logic for initializing a minigame upon receiving a
   * "minigame initialization" event
   * @function onMiniGameInitialization
   * @param {Object} data contains paramters of Player. Same as data for onPlay
   */
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

  /**
   * Logic for rolling a dice and broadcasting dice roll
   * results to other players upon receiving "roll dice"
   * event
   * @function onRollDice
   * @param {Object} data - same as data for onPlay
   */
  socket.on("roll dice", (data) => {
    messageLog.message = `You rolled a ${data.anyIntVariable}`;
    console.log(messageLog);
    socket.emit("update message", messageLog);

    messageLog.message = `${currentPlayer.name} rolled a ${data.anyIntVariable}`;
    console.log(messageLog);
    socket.broadcast
      .to(currentPlayer.roomID)
      .emit("update message", messageLog);
  });

  /**
   * Handles the event when a player is answering a question
   * @function onAnswerQuestion
   */

  socket.on("answer question", () => {
    messageLog.message = "You are answering a qn";
    console.log(messageLog);
    socket.emit("update message", messageLog);

    messageLog.message = `${currentPlayer.name} is answering a qn`;
    console.log(messageLog);
    socket.broadcast
      .to(currentPlayer.roomID)
      .emit("update message", messageLog);
  });

  /**
   * Handles the event in which question is answered
   * @function onQnResult
   * @param {Object} data - same as onPlay
   */
  socket.on("qn result", (data) => {
    const scoreChange = parseInt(data.anyIntVariable, 10);

    if (scoreChange > 0) messageLog.message = "You answered a qn correctly";
    else messageLog.message = "You answered a qn wrongly";
    console.log(messageLog);
    socket.emit("update message", messageLog);

    if (scoreChange > 0)
      messageLog.message = `${currentPlayer.name} answered a qn correctly`;
    else messageLog.message = `${currentPlayer.name} answered a qn wrongly`;
    console.log(messageLog);
    socket.broadcast
      .to(currentPlayer.roomID)
      .emit("update message", messageLog);

    playerScoreChange = {
      playerName: currentPlayer.name,
      scoreChange,
    };
    socket.broadcast
      .to(currentPlayer.roomID)
      .emit("score change", playerScoreChange);
  });

  /**
   * Handles "matched card" event
   * @function onMatchedCard
   * @param {Object} data - same as onPlay
   */
  socket.on("matched card", (data) => {
    messageLog.message = "You just matched a card!";
    console.log(messageLog);
    socket.emit("update message", messageLog);

    messageLog.message = `${currentPlayer.name} just matched a card!`;
    console.log(messageLog);
    socket.broadcast
      .to(currentPlayer.roomID)
      .emit("update message", messageLog);

    messageLog.message = `You have ${data.anyIntVariable} pairs left`;
    console.log(messageLog);
    socket.emit("update message", messageLog);

    messageLog.message = `${currentPlayer.name} has ${data.anyIntVariable} pairs left`;
    console.log(messageLog);
    socket.broadcast
      .to(currentPlayer.roomID)
      .emit("update message", messageLog);
  });

  /**
   * handles logic for "end game" event
   * @function onEndGame
   *
   */
  socket.on("end game", () => {
    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].roomID === currentPlayer.roomID) {
        rooms[i].levelComplete = true;
      }
    }
    socket.broadcast.to(currentPlayer.roomID).emit("end game");
  });

  /**
   * handles logic for "end game2" event
   * @function onEndGame2
   */
  socket.on("end game2", () => {
    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].roomID === currentPlayer.roomID) {
        rooms[i].levelComplete = true;
      }
    }
    socket.broadcast.to(currentPlayer.roomID).emit("end game2");
  });

  /**
   * handles logic for "player connect" event
   * @function onPlayerConnect
   * @param {Object} data - same as onPlay
   */
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
        } else if (rooms[i].roomPassword !== data.roomPassword) {
          console.log(`Password for Room ${data.roomName} is incorrect`);
          socket.emit("wrong room password", data);
        } else {
          console.log(`Room ${data.roomName} is full`);
          socket.emit("room is full", data);
        }
      }
    }
  });

  /**
   * handles logic for "minigame start" event
   * @function onMinigameStart
   * @param {Object} data - same as onPlay
   */
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

  /**
   * Handles logic for "minigame2 enter" event
   * @function onMinigame2Enter
   *
   */
  socket.on("minigame2 enter", () => {
    console.log("recv: minigame2 start ");
    socket.broadcast.to(currentPlayer.roomID).emit("minigame2 enter");

    messageLog.message = "Waiting for owner"; //! !
    console.log(messageLog);
    io.in(currentPlayer.roomID).emit("update message", messageLog);
  });

  /**
   * Handles logic for "minigame2 start" event
   * @function onMinigame2Start
   */
  socket.on("minigame2 start", () => {
    console.log("recv: minigame2 start ");
    socket.broadcast.to(currentPlayer.roomID).emit("minigame2 start");
  });

  /**
   * Handles logic for "minigame connect" event
   * @function onMinigameConnect
   * @param {Object} data - same as onPlay
   */
  socket.on("minigame connect", (data) => {
    let currentTurnPlayerName;
    let minigameSelected;
    console.log(`${currentPlayer.name} recv: minigame connect`);
    for (let i = 0; i < rooms.length; i++) {
      console.log(`found roomlength${rooms.length}`);
      console.log(`${rooms[i].roomID} ${data.roomID}`);
      if (rooms[i].roomID === currentPlayer.roomID) {
        rooms[i].inMinigame = true;
        minigameSelected = rooms[i].minigameSelected;
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
              `${
                currentPlayer.name
              } emit: other player connected minigame: ${JSON.stringify(
                playerConnected,
              )}`,
            );
            messageLog.message = `${playerConnected.name} has joined`;
            console.log(messageLog);
            socket.emit("update message", messageLog);
          }
        }
        break;
      }
    }

    if (
      minigameSelected === "World 2 Stranded" ||
      minigameSelected === "World 1 Stranded"
    ) {
      messageLog.message = `${currentTurnPlayerName}'s turn`;
      console.log(messageLog);
      socket.emit("update message", messageLog);
    }
  });

  /**
   * Handles "end turn" event
   * @function onEndTurn
   * @param {Object} data - same as onPlay
   */
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
      `${currentPlayer.name} emit: next player: ${JSON.stringify(
        playerConnected,
      )}`,
    );
    messageLog.message = `${playerConnected.name}'s turn`;
    console.log(messageLog);
    io.in(currentPlayer.roomID).emit("update message", messageLog);
  });

  /**
   * Handles "player move" event
   * @function onPlayerMove
   * @param {Object} data - same as onPlay
   */
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

  // TODO returning to lobby before closing the application cause disconnect to occur twice resulting
  // in for loop rooms[i].clients to be undefined as the first disconnect has removed the room entirely
  // can be fixed by following 'reason' (if-else loop)
  /**
   * Handles a disconnection event and outputs the reason for disconnection
   * @function onDisconnect
   * @param {string} reason - reason for the disconnect
   */
  socket.on("disconnect", (reason) => {
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
            // if current turn in minigame is the player that is disconnected
            // assign current turn to next player
            if (rooms[i].clients[j].currentTurn) {
              nextPlayerIndex = (j + 1) % rooms[i].clients.length;
              rooms[i].clients[nextPlayerIndex].currentTurn = true;
              socket.emit("next player", rooms[i].clients[nextPlayerIndex]);
            }
            // remove player disconnected from clients array in the room
            rooms[i].clients.splice(j, 1);
            rooms[i].noOfClients -= 1;
          }
        }
        // if room is in Minigame session, update message log and remove player that disconnects
        if (rooms[i].inMinigame) {
          messageLog.message = `${currentPlayer.name} has disconnected`;
          socket.broadcast
            .to(currentPlayer.roomID)
            .emit("update message", messageLog);
          socket.broadcast
            .to(currentPlayer.roomID)
            .emit("player left minigame", currentPlayer);
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

  /**
   * Handles event "get rooms"
   * and returns rooms array
   * @function onGetRooms
   */
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
          roomPassword: rooms[i].roomPassword,
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
