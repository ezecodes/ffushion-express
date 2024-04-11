import express from "express";
import http from "http";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import logger from "morgan";
import helmet from "helmet";
import createError from "http-errors";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("sec"));

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.emit("message", "Hello, client!");

  socket.on("chat message", (msg) => {
    console.log("Message from client:", msg);
    io.emit("chat message", msg);
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

const route = express.Router();
route.use("/snapshots", (req, res) => {});

app.use(route);
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  if (req.app.get("env") === "development") {
    res.locals.error = err;
    console.error(err, err.stack);
  } else {
    res.locals.error = {};
  }

  // render the error page
  res.status(err.status || 500).json({
    success: false,
    message: err.message,
  });
});

export default app;
