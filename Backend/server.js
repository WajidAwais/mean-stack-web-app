const { connect, mongoose } = require("./app_server/models/db");
const { createApp } = require("./app");

const port = Number(process.env.PORT || 3000);

async function main() {
  await connect();
  console.log("connected to MongoDB");
  const server = createApp().listen(port, () => console.log(`e-ballot listening on port ${port}`));

  const shutdown = () => {
    server.close(() => mongoose.disconnect().then(() => process.exit(0)));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("failed to start:", err.message);
  process.exit(1);
});
