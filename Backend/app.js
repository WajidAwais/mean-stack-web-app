const path = require("path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const { MongoStore } = require("connect-mongo");

const { mongoose } = require("./app_server/models/db");
const route = require("./app_server/routes/route");
const { notFound, handleError } = require("./app_server/middleware/respond");

const SESSION_TTL_SECONDS = 8 * 60 * 60;

function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }
  return "dev-only-session-secret";
}

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);

  app.use(helmet());
  // JSON only: browsers cannot send a cross-site JSON body without CORS,
  // which together with SameSite cookies keeps state-changing calls same-site.
  app.use(express.json({ limit: "20kb" }));

  app.use(
    session({
      name: "eballot.sid",
      secret: sessionSecret(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.COOKIE_SECURE === "true",
        maxAge: SESSION_TTL_SECONDS * 1000,
      },
      store: MongoStore.create({
        clientPromise: mongoose.connection.asPromise().then((conn) => conn.getClient()),
        collectionName: "sessions",
        ttl: SESSION_TTL_SECONDS,
      }),
    }),
  );

  app.use(express.static(path.join(__dirname, "public")));
  app.use("/", route);
  app.use(notFound);
  app.use(handleError);
  return app;
}

module.exports = { createApp };
