"use strict";

const express = require("express");

const LAB_ALLOWED_FIELDS = ["nom", "acronyme", "numero", "date_creation"];
const TUTELLE_ALLOWED_FIELDS = ["etablissement"];
const STRUCTURE_ALLOWED_FIELDS = [
  "nom",
  "acronyme",
  "kind",
  "structure_parent",
  "date_creation",
];

function createLaboratoriesRouter(pool) {
  const router = express.Router();

  router.get("/", async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        "SELECT id, nom, acronyme, numero, date_creation FROM laboratoires ORDER BY id"
      );
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:laboratoireId/affectations", async (req, res, next) => {
    const laboratoireId = parseInt(req.params.laboratoireId, 10);
    if (Number.isNaN(laboratoireId)) {
      return res.status(400).json({ error: "Invalid laboratoire id" });
    }

    const isISODate = (value) =>
      typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

    const start = isISODate(req.query.start) ? req.query.start : null;
    const end = isISODate(req.query.end) ? req.query.end : null;

    const params = [laboratoireId];
    const conditions = ["al.laboratoire = $1"];

    if (end) {
      params.push(end);
      conditions.push(`al.date_debut <= $${params.length}`);
    }

    if (start) {
      params.push(start);
      conditions.push(
        `(fal.date_fin IS NULL OR fal.date_fin >= $${params.length})`
      );
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    try {
      const { rows } = await pool.query(
        `SELECT al.id,
                al.personne,
                p.nom,
                p.prenom,
                p.sexe,
                p.nationalite,
                n.nationalite AS nationalite_nom,
                p.date_naissance,
                al.date_debut,
                fal.date_fin
         FROM affectations_laboratoires al
         JOIN personnes p ON p.id = al.personne
         LEFT JOIN nationalites n ON n.id = p.nationalite
         LEFT JOIN fin_affectations_laboratoires fal
           ON fal.affectation_laboratoire = al.id
         ${whereClause}
         ORDER BY al.date_debut`,
        params
      );
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    const { nom, acronyme, numero, date_creation } = req.body || {};
    if (!nom || !acronyme || typeof numero !== "number" || !date_creation) {
      return res.status(400).json({
        error:
          "Missing required fields: 'nom', 'acronyme', numeric 'numero', 'date_creation'",
      });
    }

    try {
      const { rows } = await pool.query(
        "INSERT INTO laboratoires (nom, acronyme, numero, date_creation) VALUES ($1, $2, $3, $4) RETURNING id, nom, acronyme, numero, date_creation",
        [nom, acronyme, numero, date_creation]
      );
      res.status(201).json(rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:laboratoireId", async (req, res, next) => {
    const laboratoireId = parseInt(req.params.laboratoireId, 10);
    if (Number.isNaN(laboratoireId)) {
      return res.status(400).json({ error: "Invalid laboratoire id" });
    }

    try {
      const { rows } = await pool.query(
        "SELECT id, nom, acronyme, numero, date_creation FROM laboratoires WHERE id = $1",
        [laboratoireId]
      );
      if (!rows.length) {
        return res.status(404).json({ error: "Laboratoire not found" });
      }
      res.json(rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:laboratoireId", async (req, res, next) => {
    const laboratoireId = parseInt(req.params.laboratoireId, 10);
    if (Number.isNaN(laboratoireId)) {
      return res.status(400).json({ error: "Invalid laboratoire id" });
    }

    if (
      req.body &&
      Object.prototype.hasOwnProperty.call(req.body, "numero") &&
      typeof req.body.numero !== "number"
    ) {
      return res
        .status(400)
        .json({ error: "Field 'numero' must be provided as a number" });
    }

    try {
      const { clause, values } = buildUpdateClause(
        req.body,
        LAB_ALLOWED_FIELDS,
        2
      );
      if (!clause) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      const { rows } = await pool.query(
        `UPDATE laboratoires SET ${clause} WHERE id = $1 RETURNING id, nom, acronyme, numero, date_creation`,
        [laboratoireId, ...values]
      );
      if (!rows.length) {
        return res.status(404).json({ error: "Laboratoire not found" });
      }
      res.json(rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:laboratoireId", async (req, res, next) => {
    const laboratoireId = parseInt(req.params.laboratoireId, 10);
    if (Number.isNaN(laboratoireId)) {
      return res.status(400).json({ error: "Invalid laboratoire id" });
    }

    try {
      const { rows } = await pool.query(
        "DELETE FROM laboratoires WHERE id = $1 RETURNING id",
        [laboratoireId]
      );
      if (!rows.length) {
        return res.status(404).json({ error: "Laboratoire not found" });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get("/:laboratoireId/tutelles", async (req, res, next) => {
    const laboratoireId = parseInt(req.params.laboratoireId, 10);
    if (Number.isNaN(laboratoireId)) {
      return res.status(400).json({ error: "Invalid laboratoire id" });
    }

    try {
      const { rows } = await pool.query(
        `SELECT tl.id,
                tl.laboratoire,
                tl.etablissement,
                e.etablissement AS nom_etablissement
         FROM tutelles_laboratoires tl
         JOIN etablissements e ON e.id = tl.etablissement
         WHERE tl.laboratoire = $1
         ORDER BY tl.id`,
        [laboratoireId]
      );
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  router.post("/:laboratoireId/tutelles", async (req, res, next) => {
    const laboratoireId = parseInt(req.params.laboratoireId, 10);
    const { etablissement } = req.body || {};
    if (Number.isNaN(laboratoireId)) {
      return res.status(400).json({ error: "Invalid laboratoire id" });
    }
    if (typeof etablissement !== "number") {
      return res
        .status(400)
        .json({ error: "Field 'etablissement' must be provided as a number" });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO tutelles_laboratoires (laboratoire, etablissement)
         VALUES ($1, $2)
         RETURNING id, laboratoire, etablissement`,
        [laboratoireId, etablissement]
      );
      const inserted = rows[0];
      const { rows: tutelle } = await pool.query(
        `SELECT tl.id,
                tl.laboratoire,
                tl.etablissement,
                e.etablissement AS nom_etablissement
         FROM tutelles_laboratoires tl
         JOIN etablissements e ON e.id = tl.etablissement
         WHERE tl.id = $1`,
        [inserted.id]
      );
      res.status(201).json(tutelle[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/:laboratoireId/tutelles/:tutelleId",
    async (req, res, next) => {
      const laboratoireId = parseInt(req.params.laboratoireId, 10);
      const tutelleId = parseInt(req.params.tutelleId, 10);
      if (Number.isNaN(laboratoireId) || Number.isNaN(tutelleId)) {
        return res.status(400).json({ error: "Invalid identifiers" });
      }

      if (
        req.body &&
        Object.prototype.hasOwnProperty.call(req.body, "etablissement") &&
        typeof req.body.etablissement !== "number"
      ) {
        return res
          .status(400)
          .json({ error: "Field 'etablissement' must be a number" });
      }

      try {
        const { clause, values } = buildUpdateClause(
          req.body,
          TUTELLE_ALLOWED_FIELDS,
          3
        );
        if (!clause) {
          return res.status(400).json({ error: "No valid fields to update" });
        }

        const { rows } = await pool.query(
          `UPDATE tutelles_laboratoires
           SET ${clause}
           WHERE laboratoire = $1 AND id = $2
           RETURNING id, laboratoire, etablissement`,
          [laboratoireId, tutelleId, ...values]
        );
        if (!rows.length) {
          return res.status(404).json({ error: "Tutelle not found" });
        }
        const { rows: updated } = await pool.query(
          `SELECT tl.id,
                  tl.laboratoire,
                  tl.etablissement,
                  e.etablissement AS nom_etablissement
           FROM tutelles_laboratoires tl
           JOIN etablissements e ON e.id = tl.etablissement
           WHERE tl.id = $1`,
          [rows[0].id]
        );
        res.json(updated[0]);
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    "/:laboratoireId/tutelles/:tutelleId",
    async (req, res, next) => {
      const laboratoireId = parseInt(req.params.laboratoireId, 10);
      const tutelleId = parseInt(req.params.tutelleId, 10);
      if (Number.isNaN(laboratoireId) || Number.isNaN(tutelleId)) {
        return res.status(400).json({ error: "Invalid identifiers" });
      }

      try {
        const { rows } = await pool.query(
          "DELETE FROM tutelles_laboratoires WHERE laboratoire = $1 AND id = $2 RETURNING id",
          [laboratoireId, tutelleId]
        );
        if (!rows.length) {
          return res.status(404).json({ error: "Tutelle not found" });
        }
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  router.get("/:laboratoireId/structures", async (req, res, next) => {
    const laboratoireId = parseInt(req.params.laboratoireId, 10);
    if (Number.isNaN(laboratoireId)) {
      return res.status(400).json({ error: "Invalid laboratoire id" });
    }

    try {
      const { rows } = await pool.query(
        `SELECT sl.id,
                sl.laboratoire,
                sl.nom,
                sl.acronyme,
                sl.kind,
                skl.nom AS kind_nom,
                sl.structure_parent,
                sl.date_creation
         FROM structures_laboratoires sl
         JOIN structures_laboratoires_kind skl ON skl.id = sl.kind
         WHERE sl.laboratoire = $1
         ORDER BY sl.id`,
        [laboratoireId]
      );
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  router.post("/:laboratoireId/structures", async (req, res, next) => {
    const laboratoireId = parseInt(req.params.laboratoireId, 10);
    const { nom, acronyme, kind, structure_parent, date_creation } = req.body || {};

    if (Number.isNaN(laboratoireId)) {
      return res.status(400).json({ error: "Invalid laboratoire id" });
    }
    if (!nom || !acronyme || !date_creation || kind === undefined) {
      return res.status(400).json({
        error:
          "Missing required fields: 'nom', 'acronyme', 'kind', 'date_creation'",
      });
    }
    if (
      structure_parent !== undefined &&
      structure_parent !== null &&
      typeof structure_parent !== "number"
    ) {
      return res.status(400).json({
        error: "Field 'structure_parent' must be a number or null",
      });
    }
    if (typeof kind !== "number") {
      return res
        .status(400)
        .json({ error: "Field 'kind' must be provided as a number" });
    }

    const parent = structure_parent === undefined ? null : structure_parent;

    try {
      const { rows } = await pool.query(
        `INSERT INTO structures_laboratoires (laboratoire, nom, acronyme, kind, structure_parent, date_creation)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [laboratoireId, nom, acronyme, kind, parent, date_creation]
      );
      const inserted = rows[0];
      const { rows: structure } = await pool.query(
        `SELECT sl.id,
                sl.laboratoire,
                sl.nom,
                sl.acronyme,
                sl.kind,
                skl.nom AS kind_nom,
                sl.structure_parent,
                sl.date_creation
         FROM structures_laboratoires sl
         JOIN structures_laboratoires_kind skl ON skl.id = sl.kind
         WHERE sl.id = $1`,
        [inserted.id]
      );
      res.status(201).json(structure[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/:laboratoireId/structures/:structureId",
    async (req, res, next) => {
      const laboratoireId = parseInt(req.params.laboratoireId, 10);
      const structureId = parseInt(req.params.structureId, 10);
      if (Number.isNaN(laboratoireId) || Number.isNaN(structureId)) {
        return res.status(400).json({ error: "Invalid identifiers" });
      }

      if (
        req.body &&
        Object.prototype.hasOwnProperty.call(req.body, "structure_parent") &&
        req.body.structure_parent !== null &&
        typeof req.body.structure_parent !== "number"
      ) {
        return res.status(400).json({
          error: "Field 'structure_parent' must be a number or null",
        });
      }
      if (
        req.body &&
        Object.prototype.hasOwnProperty.call(req.body, "kind") &&
        typeof req.body.kind !== "number"
      ) {
        return res
          .status(400)
          .json({ error: "Field 'kind' must be provided as a number" });
      }

      const payload = { ...req.body };
      if (Object.prototype.hasOwnProperty.call(payload, "structure_parent")) {
        payload.structure_parent =
          payload.structure_parent === null ? null : payload.structure_parent;
      }
      if (Object.prototype.hasOwnProperty.call(payload, "kind")) {
        payload.kind = Number(payload.kind);
      }

      try {
        const { clause, values } = buildUpdateClause(
          payload,
          STRUCTURE_ALLOWED_FIELDS,
          3
        );
        if (!clause) {
          return res.status(400).json({ error: "No valid fields to update" });
        }

        const { rows } = await pool.query(
          `UPDATE structures_laboratoires
           SET ${clause}
           WHERE laboratoire = $1 AND id = $2
           RETURNING id`,
          [laboratoireId, structureId, ...values]
        );
        if (!rows.length) {
          return res.status(404).json({ error: "Structure not found" });
        }
        const { rows: updated } = await pool.query(
          `SELECT sl.id,
                  sl.laboratoire,
                  sl.nom,
                  sl.acronyme,
                  sl.kind,
                  skl.nom AS kind_nom,
                  sl.structure_parent,
                  sl.date_creation
           FROM structures_laboratoires sl
           JOIN structures_laboratoires_kind skl ON skl.id = sl.kind
           WHERE sl.id = $1`,
          [rows[0].id]
        );
        res.json(updated[0]);
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    "/:laboratoireId/structures/:structureId",
    async (req, res, next) => {
      const laboratoireId = parseInt(req.params.laboratoireId, 10);
      const structureId = parseInt(req.params.structureId, 10);
      if (Number.isNaN(laboratoireId) || Number.isNaN(structureId)) {
        return res.status(400).json({ error: "Invalid identifiers" });
      }

      try {
        const { rows } = await pool.query(
          "DELETE FROM structures_laboratoires WHERE laboratoire = $1 AND id = $2 RETURNING id",
          [laboratoireId, structureId]
        );
        if (!rows.length) {
          return res.status(404).json({ error: "Structure not found" });
        }
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

function buildUpdateClause(body, allowedFields, initialIndex) {
  if (!body || typeof body !== "object") {
    return { clause: "", values: [] };
  }
  const sets = [];
  const values = [];
  let index = initialIndex;

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      sets.push(`${field} = $${index}`);
      values.push(body[field]);
      index += 1;
    }
  }

  return {
    clause: sets.join(", "),
    values,
  };
}

module.exports = { createLaboratoriesRouter };
