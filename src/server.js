import dontenv from "dotenv";
dontenv.config();
import express from "express";
import logger from "morgan";
import helmet from "helmet";
import cors from "cors";
import http from "http";
import { v4 as uuid } from "uuid";
import createError from "http-errors";
import { hash as bcryptHash, compareSync } from "bcrypt";
import jwt from "jsonwebtoken";
import isEmail from "isemail";

import Users from "./pg/models/users.js";
import Videos from "./pg/models/videos.js";
import {
  ACCOUNT_ID,
  AI_API_TOKEN,
  JWT_SECRET,
  CLIENTS,
} from "./config/index.js";
import { dataURLtoBlob } from "./utils.js";
import connectPG from "./pg/connect.js";
import { Op } from "sequelize";
const routes = express.Router();

const app = express();

var port = process.env.PORT || 3000;
app.set("port", port);

var server = http.createServer(app);

server.listen(port);
server.on("error", (err) => {
  throw err;
});
server.on("listening", () => {
  console.log(`Server on ${port}`);
  connectPG();
});

const BASE_API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}`;

const MODELS = {
  ImageToText: "@cf/unum/uform-gen2-qwen-500m",
  TextClassification: "@cf/huggingface/distilbert-sst-2-int8",
  ObjectDetection: "@cf/facebook/detr-resnet-50",
  VectorEmbedding: "@cf/baai/bge-base-en-v1.5",
  Summerisation: "@cf/facebook/bart-large-cnn",
};

app.use(helmet({ contentSecurityPolicy: false }));
app.use(logger("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(
  cors({
    methods: "GET, POST, DELETE",
    origin: [...CLIENTS.split(" ,")],
    credentials: true,
  })
);
app.use(routes);
function isValidToken(token) {
  try {
    const valid = jwt.verify(token, JWT_SECRET);
    return { id: valid.id };
  } catch (err) {
    return false;
  }
}
function createJwtToken({ email, id }) {
  const maxAge = "43200 mins";
  return jwt.sign({ email, id }, JWT_SECRET, { expiresIn: maxAge });
}
function catchAsyncErrors(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

async function authenticateUser(req, res, next) {
  const auth = req.headers?.authorization;
  const err = { success: false, message: "Please log in to continue" };
  if (!auth) {
    return res.status(401).json(err);
  }
  const token = auth.split(" ")[1];
  if (!token) {
    return res.status(401).json(err);
  }

  jwt.verify(token, JWT_SECRET, (err, info) => {
    try {
      if (err) {
        return res.status(401).json(err);
      } else {
        req.user = {
          id: info.id,
        };
        next();
      }
    } catch (err) {
      return res.json(err);
    }
  });
}

function analyseAllSnapshots(snapshots) {
  const allAnalysisPromises = snapshots.map(
    async (snapshot) => await analyseSnapshot(snapshot)
  );
  return Promise.all(allAnalysisPromises);
}
async function analyseSnapshot(snapshot) {
  // console.log(snapshot.id);
  const blob = dataURLtoBlob(snapshot.path);
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
  // const textClassification = await fetch(
  //   `${BASE_API}/ai/run/${MODELS.TextClassification}`,
  //   {
  //     method: "POST",
  //     body: JSON.stringify({
  //       text: imageToTextRes.result.description,
  //     }),
  //     headers: {
  //       "Content-Type": "application/json",
  //       Authorization: `Bearer ${AI_API_TOKEN}`,
  //     },
  //   }
  // );
  // const textClassificationRes = await textClassification.json();
  // const embedding = await getEmbeddings(imageToTextRes.result.description);

  return {
    description: imageToTextRes.result.description,
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

async function getEmbeddings(text) {
  try {
    const vec = await fetch(`${BASE_API}/ai/run/${MODELS.VectorEmbedding}`, {
      method: "POST",
      body: JSON.stringify({
        text,
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

app.post(
  "/signin",
  catchAsyncErrors(async (req, res) => {
    const { email, password } = req.body;
    console.log(req.body);
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "No email or password provided",
      });
    }
    if (!isEmail.validate(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide an email address to continue",
      });
    }
    let user = await Users.findOne({ where: { email } });
    if (!user) {
      const hashed = await bcryptHash(password, 10);
      user = await Users.create({ email, password: hashed });
    } else {
      if (!compareSync(password, user.password)) {
        return res
          .status(200)
          .json({ success: false, message: "Incorrect credentials" });
      }
    }
    const authToken = createJwtToken({ email, id: user.id });
    return res.status(200).json({
      success: true,
      message: "Sign in successfull",
      data: { authToken },
    });
  })
);

async function summeriseText(text) {
  const textClassification = await fetch(
    `${BASE_API}/ai/run/${MODELS.Summerisation}`,
    {
      method: "POST",
      body: JSON.stringify({
        input_text: text,
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_TOKEN}`,
      },
    }
  );
  return await textClassification.json();
}

app.post(
  "/analysis/begin",
  authenticateUser,
  catchAsyncErrors(async (req, res) => {
    const { snapshots, video } = req.body;
    console.log(snapshots.length);
    if (!snapshots || !Array.isArray(snapshots) || !video) {
      return res.status(400).json({
        success: false,
        message: "Invalid req body",
      });
    }
    // if (
    //   await Videos.findOne({
    //     where: {
    //       name: video.name,
    //       [Op.or]: [{ analysisStatus: "started" }, { analysisStatus: "done" }],
    //     },
    //   })
    // ) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Video has already been uploaded",
    //   });
    // }
    const newVid = await Videos.create({
      path: video.path,
      name: video.name,
      type: video.type,
      size: video.size,
      duration: video.duration,
      userId: req.user.id,
      type: video.type,
      analysisStatus: "started",
    });
    analyseAllSnapshots(snapshots).then(async (result) => {
      let all = [];
      result.forEach(async (snapshot) => {
        all.push(snapshot.description);
      });
      all = all.join(" ---- ");
      const summerise = await summeriseText(all);

      await Videos.update(
        {
          description: all,
          analysisStatus: "done",
          summerised: summerise.result.summary,
        },
        { where: { id: newVid.id } }
      );
    });
    return res.status(200).json({
      success: false,
      message: "Analysis started",
      data: { videoId: video.id },
    });
  })
);
app.get(
  "/analysis/status/:videoId",
  authenticateUser,
  catchAsyncErrors(async (req, res) => {
    const { videoId } = req.params;
    const find = await Videos.findByPk(videoId);
    if (!find) {
      return res.sendStatus(404);
    }
    if (find.analysisStatus !== "done") {
      return res.status(200).json({
        success: false,
        message: `Analysis ${find.analysisStatus}`,
        data: {
          summary: find.summary,
        },
      });
    }
    return res.status(200).json({
      success: true,
      message: `Analysis ${find.analysisStatus}`,
    });
  })
);
app.get(
  "/videos/:videoId",
  authenticateUser,
  catchAsyncErrors(async (req, res) => {
    const { videoId } = req.params;
    const prompt =
      req.query.prompt ||
      "Describe in summary, including objects, scenes, and any relevant context. Imagine you're explaining the image to someone who can't see it. Use complete sentences and natural language";

    const vectors = await getEmbeddings(prompt);
    const SIMILARITY_CUTOFF = 0.75;
  })
);
app.get(
  "/videos",
  authenticateUser,
  catchAsyncErrors(async (req, res) => {
    const find = await Videos.findAll({
      where: { userId: req.user.id },
      attributes: ["name", "analysisStatus", "id", "createdAt"],
    });
    return res.status(200).json({
      success: true,
      message:
        find.length === 0
          ? "No Analysed videos found"
          : "Analysed videos returned",
      data: {
        videos: find,
      },
    });
  })
);

app.get("/", (req, res) =>
  res.status(200).json({ success: true, message: "Alive!!" })
);

app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
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
