"use strict";

require("dotenv").config();

const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const { Pool } = require("pg");
const { createLaboratoriesRouter } = require("./laboratoriesRouter");
const { createPersonnesRouter } = require("./personnesRouter");
const { createStructuresRouter } = require("./structuresRouter");

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/labri_admin";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/laboratoires", createLaboratoriesRouter(pool));
app.use("/personnes", createPersonnesRouter(pool));
app.use("/structures", createStructuresRouter(pool));

app.get("/sexes", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, sexe FROM sexes ORDER BY id"
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/nationalites", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, nationalite FROM nationalites ORDER BY nationalite"
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/etablissements", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, etablissement FROM etablissements ORDER BY etablissement"
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/structures-kinds", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, nom FROM structures_laboratoires_kind ORDER BY nom"
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

async function start() {
  try {
    await pool.query("SELECT 1");
    app.locals.db = pool;
    const server = app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
    return server;
  } catch (error) {
    console.error("Failed to connect to the database", error);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { app, start, pool };
