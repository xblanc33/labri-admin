"use strict";

require("dotenv").config();

const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { Pool } = require("pg");
const { createLaboratoriesRouter } = require("./laboratoriesRouter");
const { createPersonnesRouter } = require("./personnesRouter");
const { createStructuresRouter } = require("./structuresRouter");

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/labri_admin";

const DB_CONFIG = parseDatabaseUrl(DATABASE_URL);

const TMP_ROOT =
  process.env.BACKUP_TMP_DIR || path.join(os.tmpdir(), "labri-admin");
ensureDir(TMP_ROOT);
const BACKUP_DIR = path.join(TMP_ROOT, "backups");
ensureDir(BACKUP_DIR);
const UPLOAD_DIR = path.join(TMP_ROOT, "uploads");
ensureDir(UPLOAD_DIR);

const upload = multer({ dest: UPLOAD_DIR });
const unlinkAsync = promisify(fs.unlink);

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

app.get("/corps-chercheurs", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, corps FROM corps_chercheurs ORDER BY corps"
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/corps-enseignants-chercheurs", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, corps FROM corps_enseignants_chercheurs ORDER BY corps"
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/corps-biatss", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, corps FROM corps_biatss ORDER BY corps"
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/grades", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, grade FROM grades ORDER BY grade"
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/backup", async (_req, res, next) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `labri-admin-${timestamp}.sql`;
  const filePath = path.join(BACKUP_DIR, fileName);

  console.log("Creating backup:", filePath);

  try {
    await runCommand("pg_dump", buildPgDumpArgs(filePath));

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    const stream = fs.createReadStream(filePath);
    stream.on("error", next);
    res.on("finish", () => {
      cleanupFile(filePath).catch(() => {});
    });
    res.on("close", () => {
      cleanupFile(filePath).catch(() => {});
    });
    stream.pipe(res);
  } catch (error) {
    console.log("Error during backup:", error);
    await cleanupFile(filePath).catch(() => {});
    next(error);
  }
});

app.post("/backup", upload.single("file"), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: "Aucun fichier fourni." });
  }

  const filePath = req.file.path;

  try {
    await runCommand("psql", buildPsqlArgs(filePath));
    // Simple health check to ensure the pool can still reach the database
    await pool.query("SELECT 1");
    res.status(200).json({ message: "Restauration effectuée." });
  } catch (error) {
    next(error);
  } finally {
    await cleanupFile(filePath).catch(() => {});
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

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function parseDatabaseUrl(urlString) {
  const url = new URL(urlString);
  return {
    host: url.hostname,
    port: url.port || "5432",
    user: decodeURIComponent(url.username),
    password: url.password ? decodeURIComponent(url.password) : undefined,
    database: url.pathname.replace(/^\//, ""),
  };
}

function buildPgDumpArgs(outputPath) {
  const args = [
    "-h",
    DB_CONFIG.host,
    "-p",
    String(DB_CONFIG.port),
    "-U",
    DB_CONFIG.user,
    "-d",
    DB_CONFIG.database,
    "-Fp",
    "--data-only",
    "--encoding=UTF8",
    "--inserts",
    "-f",
    outputPath,
  ];
  return args;
}

function buildPsqlArgs(sqlFilePath) {
  return [
    "-h",
    DB_CONFIG.host,
    "-p",
    String(DB_CONFIG.port),
    "-U",
    DB_CONFIG.user,
    "-d",
    DB_CONFIG.database,
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    sqlFilePath,
  ];
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    if (DB_CONFIG.password) {
      env.PGPASSWORD = DB_CONFIG.password;
    }
    execFile(command, args, { env }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        return reject(error);
      }
      resolve({ stdout, stderr });
    });
  });
}

async function cleanupFile(filePath) {
  if (!filePath) return;
  try {
    await unlinkAsync(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}
