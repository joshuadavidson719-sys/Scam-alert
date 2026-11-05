import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import profilePhotosRouter from "./routes/profilePhotos";
import postMediaRouter from "./routes/postMedia";

const app: Express = express();
// The managed reverse proxy is the single trusted hop in front of this server.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// Authenticate and rate-limit photo uploads before parsing their larger bodies.
app.use("/api/profile-photos", profilePhotosRouter);
app.use("/api/post-media", postMediaRouter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
