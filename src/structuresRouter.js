"use strict";

const express = require("express");

function createStructuresRouter(pool) {
  const router = express.Router();

  router.get("/", async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT sl.id,
                sl.nom,
                sl.acronyme,
                sl.laboratoire,
                l.nom AS laboratoire_nom,
                l.acronyme AS laboratoire_acronyme,
                sl.kind,
                skl.nom AS kind_nom,
                sl.structure_parent,
                parent.nom AS parent_nom,
                sl.date_creation
         FROM structures_laboratoires sl
         JOIN laboratoires l ON l.id = sl.laboratoire
         JOIN structures_laboratoires_kind skl ON skl.id = sl.kind
         LEFT JOIN structures_laboratoires parent ON parent.id = sl.structure_parent
         ORDER BY l.nom, sl.nom`
      );
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:structureId", async (req, res, next) => {
    const structureId = parseInt(req.params.structureId, 10);
    if (Number.isNaN(structureId)) {
      return res.status(400).json({ error: "Invalid structure id" });
    }

    try {
      const { rows } = await pool.query(
        `SELECT sl.id,
                sl.nom,
                sl.acronyme,
                sl.laboratoire,
                l.nom AS laboratoire_nom,
                l.acronyme AS laboratoire_acronyme,
                sl.kind,
                skl.nom AS kind_nom,
                sl.structure_parent,
                parent.nom AS parent_nom,
                sl.date_creation
         FROM structures_laboratoires sl
         JOIN laboratoires l ON l.id = sl.laboratoire
         JOIN structures_laboratoires_kind skl ON skl.id = sl.kind
         LEFT JOIN structures_laboratoires parent ON parent.id = sl.structure_parent
         WHERE sl.id = $1`,
        [structureId]
      );
      if (!rows.length) {
        return res.status(404).json({ error: "Structure not found" });
      }
      res.json(rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:structureId/personnes", async (req, res, next) => {
    const structureId = parseInt(req.params.structureId, 10);
    if (Number.isNaN(structureId)) {
      return res.status(400).json({ error: "Invalid structure id" });
    }

    try {
      const { rows } = await pool.query(
        `SELECT p.id,
                p.nom,
                p.prenom,
                p.sexe,
                p.nationalite,
                n.nationalite AS nationalite_nom,
                p.date_naissance,
                asl.date_debut
         FROM affectations_structures_laboratoires asl
         JOIN personnes p ON p.id = asl.personne
         LEFT JOIN nationalites n ON n.id = p.nationalite
         WHERE asl.structure_laboratoire = $1
         ORDER BY p.nom, p.prenom`,
        [structureId]
      );
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createStructuresRouter };
