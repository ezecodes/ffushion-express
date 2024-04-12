import express from "express";
import http from "http";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import logger from "morgan";
import helmet from "helmet";
import cors from "cors";
import { v4 as uuid } from "uuid";
import Snapshots from "./pg/models/snapshots.js";
import { ACCOUNT_ID, AI_API_TOKEN } from "./config/index.js";
import { dataURLtoBlob } from "./utils.js";
import createError from "http-errors";
const route = express.Router();

const BASE_API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}`;

const MODELS = {
  ImageToText: "@cf/unum/uform-gen2-qwen-500m",
  TextClassification: "@cf/huggingface/distilbert-sst-2-int8",
  ObjectDetection: "@cf/facebook/detr-resnet-50",
  VectorEmbedding: "@cf/baai/bge-base-en-v1.5",
};
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
  },
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("sec"));
app.use(
  cors({
    methods: "GET, POST, DELETE",
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
io.attach(server);
io.on("connection", (socket) => {
  console.log("A user connected");
  socket.on("analysis", async (data) => {
    const { videoId, snapshots } = data;
    try {
      fetchAllAnalysis(snapshots)
        .then(async (result) => {
          const writeAsync = result.map(
            async (anaysis) => await insertSnapshot({ ...anaysis, videoId })
          );
          Promise.all(writeAsync).then((res) => {
            socket;
          });
        })
        .catch((err) => {
          console.error(err);
        });
    } catch (err) {
      console.error(err);
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

// function* analyseSnapshot(snapshot, snapshotsLength) {
//   let currentPos = 0;
//   while (currentPos < snapshotsLength) {
//     const { path, id, timeCaptured, playbackTime } = snapshot;
//   }
// }
function fetchAllAnalysis(snapshots) {
  const allAnalysisPromises = snapshots.map(
    async (snapshot) => await fetchAnalysis(snapshot.imageDataURL)
  );
  return Promise.all(allAnalysisPromises);
}

async function fetchAnalysis(imageDataURL) {
  const blob = dataURLtoBlob(imageDataURL);
  const imageToText = await fetch(`${BASE_API}/ai/run/${MODELS.ImageToText}`, {
    method: "POST",
    body: JSON.stringify({
      image: [...new Uint8Array(blob)],
      prompt:
        "Given the image below, describe its content in summary, including objects, scenes, and any relevant context. Imagine you're explaining the image to someone who can't see it. Use complete sentences and natural language",
    }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_TOKEN}`,
    },
  });
  const imageToTextRes = await imageToText.json();
  const textClassification = await fetch(
    `${BASE_API}/ai/run/${MODELS.TextClassification}`,
    {
      method: "POST",
      body: JSON.stringify({
        text: imageToTextRes.result.description,
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_TOKEN}`,
      },
    }
  );
  const textClassificationRes = await textClassification.json();
  const embedding = await createEmbeddings(imageToTextRes.result.description);

  return {
    embedding,
    description: imageToTextRes.result,
    classification: textClassificationRes.result,
  };
}

async function insertSnapshot({
  description,
  path,
  videoId,
  playbackTime,
  timeCaptured,
  classified,
  embedding,
}) {
  try {
    await Snapshots.create({
      embedding,
      description,
      path,
      videoId,
      playbackTime,
      timeCaptured,
      classified: JSON.stringify(classified),
    });
  } catch (err) {
    console.error(err);
  }
}

async function createEmbeddings(snapshotDescription) {
  try {
    const vec = await fetch(`${BASE_API}/ai/run/${MODELS.VectorEmbedding}`, {
      method: "POST",
      body: JSON.stringify({
        text: snapshotDescription,
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_TOKEN}`,
      },
    });
    const vecRes = await vec.json();
    if (vec.status === 200) {
      return vecRes.data[0];
    }
    throw new Error("Could not get embeddings");
  } catch (err) {
    console.error(err);
  }
}

route.get("/analysis", (req, res) => res.json("Hello, I am active"));

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
