const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: "MakeItSimple Server is running!" });
});

app.listen(PORT, () => {
  console.log(`MakeItSimple server listening on port ${PORT}`);
});
