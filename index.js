const app = require("express")();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const { onPlay } = require("./onConnect");

const {
  onMinigameInit,
  rollDice,
  answerQuestion,
  questionResult,
  endGame,
  minigameStart,
  minigameConnect,
  endTurn,
} = require("./minigame");

const {
  playerConnect,
  getRooms,
  disconnect,
  playerMove,
} = require("./roomUtil");

server.listen(3000);

// global variables for the Server
const rooms = [];
let playerSpawnPoints = [];

app.get("/", (req, res) => {
  res.send('hey you got back get "/"');
});

io.on("connection", (socket) => {
  let currentPlayer = {};
  currentPlayer.name = "unknown";
  socket.on("play", onPlay);

  socket.on("minigame initialization", onMinigameInit);
  socket.on("roll dice", rollDice);
  socket.on("answer question", answerQuestion);
  socket.on("qn result", questionResult);
  socket.on("end turn", endTurn);
  socket.on("end game", endGame);
  socket.on("minigame start", minigameStart);
  socket.on("minigame connect", minigameConnect);

  socket.on("player connect", playerConnect);
  socket.on("player move", playerMove);
  socket.on("disconnect", disconnect);
  socket.on("get rooms", getRooms);
});

console.log("----server is running...");
