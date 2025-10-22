"use strict";

const express = require("express");

const PERSONNE_ALLOWED_FIELDS = ["nom", "prenom", "sexe", "nationalite", "date_naissance"];

async function fetchPersonneById(pool, id) {
  const { rows } = await pool.query(
    `SELECT p.id,
            p.nom,
            p.prenom,
            p.sexe,
            p.nationalite,
            n.nationalite AS nationalite_nom,
            p.date_naissance
     FROM personnes p
     LEFT JOIN nationalites n ON n.id = p.nationalite
     WHERE p.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

function createPersonnesRouter(pool) {
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    const { search, laboratoire } = req.query;
    try {
      const params = [];
      let query =
        `SELECT p.id,
                p.nom,
                p.prenom,
                p.sexe,
                p.nationalite,
                n.nationalite AS nationalite_nom,
                p.date_naissance
         FROM personnes p
         LEFT JOIN nationalites n ON n.id = p.nationalite`;
      const whereParts = [];
      if (search) {
        params.push(`%${search}%`.toLowerCase());
        whereParts.push(
          "(lower(p.nom) LIKE $" +
            params.length +
            " OR lower(p.prenom) LIKE $" +
            params.length +
            " OR lower(p.nom || ' ' || p.prenom) LIKE $" +
            params.length +
            ")"
        );
      }
      if (laboratoire) {
        params.push(parseInt(laboratoire, 10));
        whereParts.push(
          "EXISTS (SELECT 1 FROM affectations_laboratoires al WHERE al.personne = p.id AND al.laboratoire = $" +
            params.length +
            ")"
        );
      }
      if (whereParts.length) {
        query += " WHERE " + whereParts.join(" AND ");
      }
      query += " ORDER BY nom, prenom";
      const { rows } = await pool.query(query, params);
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    const { nom, prenom, sexe, nationalite, date_naissance } = req.body || {};
    if (!nom || !prenom || typeof sexe !== "number") {
      return res.status(400).json({
        error: "Fields 'nom', 'prenom', and numeric 'sexe' are required",
      });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO personnes (nom, prenom, sexe, nationalite, date_naissance)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [nom, prenom, sexe, nationalite ?? null, date_naissance ?? null]
      );
      const personne = await fetchPersonneById(pool, rows[0].id);
      res.status(201).json(personne);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:personneId", async (req, res, next) => {
    const personneId = parseInt(req.params.personneId, 10);
    if (Number.isNaN(personneId)) {
      return res.status(400).json({ error: "Invalid personne id" });
    }

    try {
      const personne = await fetchPersonneById(pool, personneId);
      if (!personne) {
        return res.status(404).json({ error: "Personne not found" });
      }
      res.json(personne);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:personneId", async (req, res, next) => {
    const personneId = parseInt(req.params.personneId, 10);
    if (Number.isNaN(personneId)) {
      return res.status(400).json({ error: "Invalid personne id" });
    }

    if (
      req.body &&
      Object.prototype.hasOwnProperty.call(req.body, "sexe") &&
      typeof req.body.sexe !== "number"
    ) {
      return res
        .status(400)
        .json({ error: "Field 'sexe' must be provided as a number" });
    }
    if (
      req.body &&
      Object.prototype.hasOwnProperty.call(req.body, "nationalite") &&
      req.body.nationalite !== null &&
      typeof req.body.nationalite !== "number"
    ) {
      return res.status(400).json({
        error: "Field 'nationalite' must be a number or null",
      });
    }

    try {
      const { clause, values } = buildUpdateClause(
        req.body,
        PERSONNE_ALLOWED_FIELDS,
        2
      );
      if (!clause) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      const { rows } = await pool.query(
        `UPDATE personnes
         SET ${clause}
         WHERE id = $1
         RETURNING id`,
        [personneId, ...values]
      );
      if (!rows.length) {
        return res.status(404).json({ error: "Personne not found" });
      }
      const personne = await fetchPersonneById(pool, rows[0].id);
      res.json(personne);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:personneId", async (req, res, next) => {
    const personneId = parseInt(req.params.personneId, 10);
    if (Number.isNaN(personneId)) {
      return res.status(400).json({ error: "Invalid personne id" });
    }

    try {
      const { rows } = await pool.query(
        "DELETE FROM personnes WHERE id = $1 RETURNING id",
        [personneId]
      );
      if (!rows.length) {
        return res.status(404).json({ error: "Personne not found" });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function buildUpdateClause(body, allowedFields, startIndex) {
  if (!body || typeof body !== "object") {
    return { clause: "", values: [] };
  }
  const sets = [];
  const values = [];
  let index = startIndex;

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

module.exports = { createPersonnesRouter };
