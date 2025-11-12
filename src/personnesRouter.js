"use strict";

const express = require("express");

const PERSONNE_ALLOWED_FIELDS = ["nom", "prenom", "sexe", "nationalite", "date_naissance"];
const EMPLOYMENT_TYPES = new Set([
  "chercheur",
  "enseignant-chercheur",
  "biatss",
  "cdd",
  "doctorant",
  "postdoc",
  "stage",
  "autre",
]);

let cachedHasEmploisCddTable = null;
const tableColumnCache = new Map();

async function hasEmploisCddTable(db) {
  if (cachedHasEmploisCddTable !== null) {
    return cachedHasEmploisCddTable;
  }
  try {
    const { rows } = await db.query(
      "SELECT to_regclass('public.emplois_cdd') AS regclass"
    );
    cachedHasEmploisCddTable = Boolean(rows[0]?.regclass);
  } catch (error) {
    cachedHasEmploisCddTable = false;
  }
  return cachedHasEmploisCddTable;
}

async function getTableColumnConfig(db, tableName) {
  if (tableColumnCache.has(tableName)) {
    return tableColumnCache.get(tableName);
  }
  try {
    const { rows } = await db.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1`,
      [tableName]
    );
    const columns = new Set(rows.map((row) => row.column_name));
    const config = {
      exists: columns.size > 0,
      columns,
    };
    tableColumnCache.set(tableName, config);
    return config;
  } catch (error) {
    const config = { exists: false, columns: new Set() };
    tableColumnCache.set(tableName, config);
    return config;
  }
}

async function getDoctoralColumnConfig(db) {
  return getTableColumnConfig(db, "emplois_doctoraux");
}

async function getPostdocColumnConfig(db) {
  return getTableColumnConfig(db, "emplois_postdoctoraux");
}

async function getStageColumnConfig(db) {
  return getTableColumnConfig(db, "emplois_stage");
}

async function fetchPersonneById(pool, id) {
  const { rows } = await pool.query(
    `SELECT p.id,
            p.nom,
            p.prenom,
            p.sexe,
            p.nationalite,
            n.nationalite AS nationalite_nom,
            p.date_naissance,
            COALESCE(hdr_data.hdrs, '[]'::jsonb) AS hdrs
     FROM personnes p
     LEFT JOIN nationalites n ON n.id = p.nationalite
     LEFT JOIN LATERAL (
       SELECT jsonb_agg(
                jsonb_build_object(
                  'id', h.id,
                  'date_obtention', h.date_obtention
                ) ORDER BY h.date_obtention
              ) AS hdrs
       FROM hdrs h
       WHERE h.personne = p.id
     ) hdr_data ON TRUE
     WHERE p.id = $1`,
    [id]
  );
  const personne = rows[0] ?? null;
  if (personne) {
    const hdrs = Array.isArray(personne.hdrs) ? personne.hdrs : [];
    hdrs.sort((a, b) => {
      if (!a?.date_obtention) return -1;
      if (!b?.date_obtention) return 1;
      return new Date(a.date_obtention) - new Date(b.date_obtention);
    });
    personne.hdrs = hdrs;
  }
  return personne;
}

async function fetchPersonneEmployments(pool, id) {
  const includeCdd = await hasEmploisCddTable(pool);
  const doctoralConfig = await getDoctoralColumnConfig(pool);
  const hasDoctoral = doctoralConfig.exists;
  const hasDoctoralEcole =
    hasDoctoral && doctoralConfig.columns.has("ecole_doctorale");
  const hasDoctoralCategorie =
    hasDoctoral && doctoralConfig.columns.has("categorie_financement_these");
  const hasDoctoralMaster =
    hasDoctoral && doctoralConfig.columns.has("etablissement_master");
  const postdocConfig = await getPostdocColumnConfig(pool);
  const hasPostdoc = postdocConfig.exists;
  const hasPostdocOrganisme =
    hasPostdoc && postdocConfig.columns.has("organisme_financeur");
  const stageConfig = await getStageColumnConfig(pool);
  const hasStage = stageConfig.exists;
  const hasStageDuration = hasStage && stageConfig.columns.has("duree_mois");

  const typeCaseParts = [
    "WHEN ec.emploi IS NOT NULL THEN 'chercheur'",
    "WHEN eec.emploi IS NOT NULL THEN 'enseignant-chercheur'",
    "WHEN eb.emploi IS NOT NULL THEN 'biatss'",
  ];
  if (hasDoctoral) {
    typeCaseParts.push("WHEN edoc.emploi IS NOT NULL THEN 'doctorant'");
  }
  if (hasPostdoc) {
    typeCaseParts.push("WHEN epd.emploi IS NOT NULL THEN 'postdoc'");
  }
  if (hasStage) {
    typeCaseParts.push("WHEN estage.emploi IS NOT NULL THEN 'stage'");
  }
  typeCaseParts.push("WHEN te.type_emploi ILIKE 'cdd' THEN 'cdd'");
  if (includeCdd) {
    typeCaseParts.push("WHEN cdd.emploi IS NOT NULL THEN 'cdd'");
  }
  typeCaseParts.push("ELSE 'autre'");

  const typeLabelCaseParts = [
    "WHEN ec.emploi IS NOT NULL THEN 'chercheurs'",
    "WHEN eec.emploi IS NOT NULL THEN 'enseignants_chercheurs'",
    "WHEN eb.emploi IS NOT NULL THEN 'biatss'",
  ];
  if (hasDoctoral) {
    typeLabelCaseParts.push("WHEN edoc.emploi IS NOT NULL THEN 'docteur'");
  }
  if (hasPostdoc) {
    typeLabelCaseParts.push("WHEN epd.emploi IS NOT NULL THEN 'postdoc'");
  }
  if (hasStage) {
    typeLabelCaseParts.push("WHEN estage.emploi IS NOT NULL THEN 'stage'");
  }
  typeLabelCaseParts.push("WHEN te.type_emploi ILIKE 'cdd' THEN 'cdd'");
  if (includeCdd) {
    typeLabelCaseParts.push("WHEN cdd.emploi IS NOT NULL THEN 'cdd'");
  }
  typeLabelCaseParts.push("ELSE 'autre'");

  const doctoralSelectParts = [
    hasDoctoralEcole
      ? "edoc.ecole_doctorale AS ecole_doctorale_id"
      : "NULL AS ecole_doctorale_id",
    hasDoctoralEcole
      ? "eco.ecole_doctorale AS ecole_doctorale_nom"
      : "NULL AS ecole_doctorale_nom",
    hasDoctoralCategorie
      ? "edoc.categorie_financement_these AS categorie_financement_id"
      : "NULL AS categorie_financement_id",
    hasDoctoralCategorie
      ? "cft.categorie AS categorie_financement_nom"
      : "NULL AS categorie_financement_nom",
    hasDoctoralMaster
      ? "edoc.etablissement_master AS etablissement_master_id"
      : "NULL AS etablissement_master_id",
    hasDoctoralMaster
      ? "master.etablissement AS etablissement_master_nom"
      : "NULL AS etablissement_master_nom",
  ];

  const joins = [
    "LEFT JOIN etablissements etab ON etab.id = e.etablissement",
    "LEFT JOIN types_emplois te ON te.id = e.type_emploi",
    "LEFT JOIN emplois_chercheurs ec ON ec.emploi = e.id",
    "LEFT JOIN corps_chercheurs cc ON cc.id = ec.corps",
    "LEFT JOIN grades gc ON gc.id = ec.grade",
    "LEFT JOIN emplois_enseignants_chercheurs eec ON eec.emploi = e.id",
    "LEFT JOIN corps_enseignants_chercheurs cec ON cec.id = eec.corps",
    "LEFT JOIN grades ge ON ge.id = eec.grade",
    "LEFT JOIN emplois_biatss eb ON eb.emploi = e.id",
    "LEFT JOIN corps_biatss cb ON cb.id = eb.corps",
    "LEFT JOIN grades gb ON gb.id = eb.grade",
  ];
  if (hasPostdoc) {
    joins.push("LEFT JOIN emplois_postdoctoraux epd ON epd.emploi = e.id");
  }
  if (hasStage) {
    joins.push("LEFT JOIN emplois_stage estage ON estage.emploi = e.id");
  }
  if (includeCdd) {
    joins.push("LEFT JOIN emplois_cdd cdd ON cdd.emploi = e.id");
  }
  joins.push("LEFT JOIN fin_emplois fe ON fe.emploi = e.id");
  if (hasDoctoral) {
    joins.push("LEFT JOIN emplois_doctoraux edoc ON edoc.emploi = e.id");
  }
  if (hasDoctoralEcole) {
    joins.push("LEFT JOIN ecoles_doctorales eco ON eco.id = edoc.ecole_doctorale");
  }
  if (hasDoctoralCategorie) {
    joins.push(
      "LEFT JOIN categories_financements_theses cft ON cft.id = edoc.categorie_financement_these"
    );
  }
  if (hasDoctoralMaster) {
    joins.push("LEFT JOIN etablissements master ON master.id = edoc.etablissement_master");
  }

  const dureeExpressions = [];
  if (includeCdd) {
    dureeExpressions.push("cdd.duree_mois");
  }
  if (hasStageDuration) {
    dureeExpressions.push("estage.duree_mois");
  }
  const dureeSelect =
    dureeExpressions.length > 0
      ? `COALESCE(${dureeExpressions.join(", ")})`
      : "NULL";

  const organismeSelect = hasPostdocOrganisme
    ? "epd.organisme_financeur"
    : "NULL";

  const { rows } = await pool.query(
    `SELECT e.id,
            e.date_debut,
            e.etablissement,
            etab.etablissement AS etablissement_nom,
            CASE
              ${typeCaseParts.join("\n              ")}
            END AS type,
            CASE
              ${typeLabelCaseParts.join("\n              ")}
            END AS type_label,
            COALESCE(cc.corps, cec.corps, cb.corps) AS corps_nom,
            COALESCE(gc.grade, ge.grade, gb.grade) AS grade_nom,
            ${dureeSelect} AS duree_mois,
            te.type_emploi AS type_emploi_nom,
            CASE
              WHEN ec.emploi IS NOT NULL THEN ec.corps
              WHEN eec.emploi IS NOT NULL THEN eec.corps
              WHEN eb.emploi IS NOT NULL THEN eb.corps
              ELSE NULL
            END AS corps_id,
            CASE
              WHEN ec.emploi IS NOT NULL THEN ec.grade
              WHEN eec.emploi IS NOT NULL THEN eec.grade
              WHEN eb.emploi IS NOT NULL THEN eb.grade
              ELSE NULL
            END AS grade_id,
            fe.date_fin,
            ${hasPostdocOrganisme ? "epd.organisme_financeur" : "NULL"} AS organisme_financeur,
            ${doctoralSelectParts.join(",\n            ")}
     FROM emplois e
     ${joins.join("\n     ")}
     WHERE e.personne = $1
     ORDER BY e.date_debut`,
    [id]
  );
  return rows;
}

async function fetchEmploymentById(client, personneId, emploiId) {
  const includeCdd = await hasEmploisCddTable(client);
  const doctoralConfig = await getDoctoralColumnConfig(client);
  const hasDoctoral = doctoralConfig.exists;
  const hasDoctoralEcole =
    hasDoctoral && doctoralConfig.columns.has("ecole_doctorale");
  const hasDoctoralCategorie =
    hasDoctoral && doctoralConfig.columns.has("categorie_financement_these");
  const hasDoctoralMaster =
    hasDoctoral && doctoralConfig.columns.has("etablissement_master");
  const postdocConfig = await getPostdocColumnConfig(client);
  const hasPostdoc = postdocConfig.exists;
  const hasPostdocOrganisme =
    hasPostdoc && postdocConfig.columns.has("organisme_financeur");
  const stageConfig = await getStageColumnConfig(client);
  const hasStage = stageConfig.exists;
  const hasStageDuration = hasStage && stageConfig.columns.has("duree_mois");
  const typeCaseParts = [
    "WHEN ec.emploi IS NOT NULL THEN 'chercheur'",
    "WHEN eec.emploi IS NOT NULL THEN 'enseignant-chercheur'",
    "WHEN eb.emploi IS NOT NULL THEN 'biatss'",
  ];
  if (hasDoctoral) {
    typeCaseParts.push("WHEN edoc.emploi IS NOT NULL THEN 'doctorant'");
  }
  if (hasPostdoc) {
    typeCaseParts.push("WHEN epd.emploi IS NOT NULL THEN 'postdoc'");
  }
  if (hasStage) {
    typeCaseParts.push("WHEN estage.emploi IS NOT NULL THEN 'stage'");
  }
  typeCaseParts.push("WHEN te.type_emploi ILIKE 'cdd' THEN 'cdd'");
  if (includeCdd) {
    typeCaseParts.push("WHEN cdd.emploi IS NOT NULL THEN 'cdd'");
  }
  typeCaseParts.push("ELSE 'autre'");

  const doctoralSelectParts = [
    hasDoctoralEcole
      ? "edoc.ecole_doctorale AS ecole_doctorale_id"
      : "NULL AS ecole_doctorale_id",
    hasDoctoralEcole
      ? "eco.ecole_doctorale AS ecole_doctorale_nom"
      : "NULL AS ecole_doctorale_nom",
    hasDoctoralCategorie
      ? "edoc.categorie_financement_these AS categorie_financement_id"
      : "NULL AS categorie_financement_id",
    hasDoctoralCategorie
      ? "cft.categorie AS categorie_financement_nom"
      : "NULL AS categorie_financement_nom",
    hasDoctoralMaster
      ? "edoc.etablissement_master AS etablissement_master_id"
      : "NULL AS etablissement_master_id",
    hasDoctoralMaster
      ? "master.etablissement AS etablissement_master_nom"
      : "NULL AS etablissement_master_nom",
  ];

  const joins = [
    "LEFT JOIN etablissements etab ON etab.id = e.etablissement",
    "LEFT JOIN types_emplois te ON te.id = e.type_emploi",
    "LEFT JOIN emplois_chercheurs ec ON ec.emploi = e.id",
    "LEFT JOIN corps_chercheurs cc ON cc.id = ec.corps",
    "LEFT JOIN grades gc ON gc.id = ec.grade",
    "LEFT JOIN emplois_enseignants_chercheurs eec ON eec.emploi = e.id",
    "LEFT JOIN corps_enseignants_chercheurs cec ON cec.id = eec.corps",
    "LEFT JOIN grades ge ON ge.id = eec.grade",
    "LEFT JOIN emplois_biatss eb ON eb.emploi = e.id",
    "LEFT JOIN corps_biatss cb ON cb.id = eb.corps",
    "LEFT JOIN grades gb ON gb.id = eb.grade",
  ];
  if (hasPostdoc) {
    joins.push("LEFT JOIN emplois_postdoctoraux epd ON epd.emploi = e.id");
  }
  if (hasStage) {
    joins.push("LEFT JOIN emplois_stage estage ON estage.emploi = e.id");
  }
  if (includeCdd) {
    joins.push("LEFT JOIN emplois_cdd cdd ON cdd.emploi = e.id");
  }
  joins.push("LEFT JOIN fin_emplois fe ON fe.emploi = e.id");
  if (hasDoctoral) {
    joins.push("LEFT JOIN emplois_doctoraux edoc ON edoc.emploi = e.id");
  }
  if (hasDoctoralEcole) {
    joins.push("LEFT JOIN ecoles_doctorales eco ON eco.id = edoc.ecole_doctorale");
  }
  if (hasDoctoralCategorie) {
    joins.push(
      "LEFT JOIN categories_financements_theses cft ON cft.id = edoc.categorie_financement_these"
    );
  }
  if (hasDoctoralMaster) {
    joins.push("LEFT JOIN etablissements master ON master.id = edoc.etablissement_master");
  }

  const dureeExpressions = [];
  if (includeCdd) {
    dureeExpressions.push("cdd.duree_mois");
  }
  if (hasStageDuration) {
    dureeExpressions.push("estage.duree_mois");
  }
  const dureeSelect =
    dureeExpressions.length > 0
      ? `COALESCE(${dureeExpressions.join(", ")})`
      : "NULL";

  const { rows } = await client.query(
    `SELECT e.id,
            e.date_debut,
            e.etablissement,
            etab.etablissement AS etablissement_nom,
            CASE
              ${typeCaseParts.join("\n              ")}
            END AS type,
            CASE
              ${typeLabelCaseParts.join("\n              ")}
            END AS type_label,
            COALESCE(cc.corps, cec.corps, cb.corps) AS corps_nom,
            COALESCE(gc.grade, ge.grade, gb.grade) AS grade_nom,
            ${dureeSelect} AS duree_mois,
            te.type_emploi AS type_emploi_nom,
            CASE
              WHEN ec.emploi IS NOT NULL THEN ec.corps
              WHEN eec.emploi IS NOT NULL THEN eec.corps
              WHEN eb.emploi IS NOT NULL THEN eb.corps
              ELSE NULL
            END AS corps_id,
            CASE
              WHEN ec.emploi IS NOT NULL THEN ec.grade
              WHEN eec.emploi IS NOT NULL THEN eec.grade
              WHEN eb.emploi IS NOT NULL THEN eb.grade
              ELSE NULL
            END AS grade_id,
            fe.date_fin,
            ${organismeSelect} AS organisme_financeur,
            ${doctoralSelectParts.join(",\n            ")}
     FROM emplois e
     ${joins.join("\n     ")}
     WHERE e.personne = $1
       AND e.id = $2`,
    [personneId, emploiId]
  );
  return rows[0] ?? null;
}

async function detectEmploymentType(client, emploiId) {
  const includeCdd = await hasEmploisCddTable(client);
  const doctoralConfig = await getDoctoralColumnConfig(client);
  const includeDoctoral = doctoralConfig.exists;
  const postdocConfig = await getPostdocColumnConfig(client);
  const includePostdoc = postdocConfig.exists;
  const stageConfig = await getStageColumnConfig(client);
  const includeStage = stageConfig.exists;

  const selectParts = [
    "EXISTS (SELECT 1 FROM emplois_chercheurs WHERE emploi = $1) AS is_chercheur",
    "EXISTS (SELECT 1 FROM emplois_enseignants_chercheurs WHERE emploi = $1) AS is_enseignant",
    "EXISTS (SELECT 1 FROM emplois_biatss WHERE emploi = $1) AS is_biatss",
    `${includeCdd ? "EXISTS (SELECT 1 FROM emplois_cdd WHERE emploi = $1)" : "FALSE"} AS is_cdd`,
    `${includeDoctoral ? "EXISTS (SELECT 1 FROM emplois_doctoraux WHERE emploi = $1)" : "FALSE"} AS is_doctorant`,
    `${includePostdoc ? "EXISTS (SELECT 1 FROM emplois_postdoctoraux WHERE emploi = $1)" : "FALSE"} AS is_postdoc`,
    `${includeStage ? "EXISTS (SELECT 1 FROM emplois_stage WHERE emploi = $1)" : "FALSE"} AS is_stage`,
    "EXISTS (SELECT 1 FROM emplois_autres WHERE emploi = $1) AS is_autre",
    "te.type_emploi",
  ];

  const { rows } = await client.query(
    `SELECT
       ${selectParts.join(",\n       ")}
     FROM emplois e
     LEFT JOIN types_emplois te ON te.id = e.type_emploi
     WHERE e.id = $1`,
    [emploiId]
  );
  if (!rows.length) {
    return "autre";
  }
  const row = rows[0];
  if (row.is_chercheur) return "chercheur";
  if (row.is_enseignant) return "enseignant-chercheur";
  if (row.is_biatss) return "biatss";
  if (row.is_doctorant) return "doctorant";
  if (row.is_postdoc) return "postdoc";
  if (row.is_stage) return "stage";
  if (row.is_cdd) return "cdd";
  if (row.is_autre) return "autre";
  if (
    typeof row.type_emploi === "string" &&
    row.type_emploi.trim().toLowerCase() === "cdd"
  ) {
    return "cdd";
  }
  return "autre";
}

async function clearEmploymentSpecializations(client, emploiId) {
  await client.query("DELETE FROM emplois_chercheurs WHERE emploi = $1", [
    emploiId,
  ]);
  await client.query(
    "DELETE FROM emplois_enseignants_chercheurs WHERE emploi = $1",
    [emploiId]
  );
  await client.query("DELETE FROM emplois_biatss WHERE emploi = $1", [
    emploiId,
  ]);
  if (await hasEmploisCddTable(client)) {
    await client.query("DELETE FROM emplois_cdd WHERE emploi = $1", [emploiId]);
  }
  if ((await getDoctoralColumnConfig(client)).exists) {
    await client.query("DELETE FROM emplois_doctoraux WHERE emploi = $1", [
      emploiId,
    ]);
  }
  if ((await getPostdocColumnConfig(client)).exists) {
    await client.query("DELETE FROM emplois_postdoctoraux WHERE emploi = $1", [
      emploiId,
    ]);
  }
  if ((await getStageColumnConfig(client)).exists) {
    await client.query("DELETE FROM emplois_stage WHERE emploi = $1", [
      emploiId,
    ]);
  }
}

async function attachEmploymentSpecialization(
  client,
  type,
  emploiId,
  {
    corpsId = null,
    gradeId = null,
    dureeMois = null,
    organismeFinancement = null,
  } = {}
) {
  switch (type) {
    case "chercheur":
      await client.query(
        `INSERT INTO emplois_chercheurs (corps, grade, emploi)
         VALUES ($1, $2, $3)`,
        [corpsId, gradeId, emploiId]
      );
      break;
    case "enseignant-chercheur":
      await client.query(
        `INSERT INTO emplois_enseignants_chercheurs (corps, grade, emploi)
         VALUES ($1, $2, $3)`,
        [corpsId, gradeId, emploiId]
      );
      break;
    case "biatss":
      await client.query(
        `INSERT INTO emplois_biatss (corps, grade, emploi)
         VALUES ($1, $2, $3)`,
        [corpsId, gradeId, emploiId]
      );
      break;
    case "cdd":
      if (await hasEmploisCddTable(client)) {
        await client.query(
          `INSERT INTO emplois_cdd (emploi, duree_mois)
           VALUES ($1, $2)`,
          [emploiId, dureeMois]
        );
      }
      break;
    case "postdoc": {
      const config = await getPostdocColumnConfig(client);
      if (!config.exists) {
        break;
      }
      if (config.columns.has("organisme_financeur")) {
        await client.query(
          `INSERT INTO emplois_postdoctoraux (emploi, organisme_financeur)
           VALUES ($1, $2)`,
          [emploiId, organismeFinancement || null]
        );
      } else {
        await client.query(
          `INSERT INTO emplois_postdoctoraux (emploi)
           VALUES ($1)`,
          [emploiId]
        );
      }
      break;
    }
    case "stage": {
      const config = await getStageColumnConfig(client);
      if (!config.exists) {
        break;
      }
      if (config.columns.has("duree_mois") && typeof dureeMois === "number") {
        await client.query(
          `INSERT INTO emplois_stage (emploi, duree_mois)
           VALUES ($1, $2)`,
          [emploiId, dureeMois]
        );
      } else {
        await client.query(
          `INSERT INTO emplois_stage (emploi)
           VALUES ($1)`,
          [emploiId]
        );
      }
      break;
    }
    default:
      break;
  }
}

async function updateEmploymentSpecialization(
  client,
  type,
  emploiId,
  {
    corpsId = null,
    gradeId = null,
    dureeMois = null,
    organismeFinancement = undefined,
  } = {}
) {
  switch (type) {
    case "chercheur": {
      const updates = [];
      const values = [];
      let idx = 1;
      if (typeof corpsId === "number") {
        updates.push(`corps = $${idx++}`);
        values.push(corpsId);
      }
      if (typeof gradeId === "number") {
        updates.push(`grade = $${idx++}`);
        values.push(gradeId);
      }
      if (updates.length) {
        values.push(emploiId);
        await client.query(
          `UPDATE emplois_chercheurs SET ${updates.join(", ")} WHERE emploi = $${
            updates.length + 1
          }`,
          values
        );
      }
      break;
    }
    case "enseignant-chercheur": {
      const updates = [];
      const values = [];
      let idx = 1;
      if (typeof corpsId === "number") {
        updates.push(`corps = $${idx++}`);
        values.push(corpsId);
      }
      if (typeof gradeId === "number") {
        updates.push(`grade = $${idx++}`);
        values.push(gradeId);
      }
      if (updates.length) {
        values.push(emploiId);
        await client.query(
          `UPDATE emplois_enseignants_chercheurs SET ${updates.join(
            ", "
          )} WHERE emploi = $${updates.length + 1}`,
          values
        );
      }
      break;
    }
    case "biatss": {
      const updates = [];
      const values = [];
      let idx = 1;
      if (typeof corpsId === "number") {
        updates.push(`corps = $${idx++}`);
        values.push(corpsId);
      }
      if (typeof gradeId === "number") {
        updates.push(`grade = $${idx++}`);
        values.push(gradeId);
      }
      if (updates.length) {
        values.push(emploiId);
        await client.query(
          `UPDATE emplois_biatss SET ${updates.join(", ")} WHERE emploi = $${
            updates.length + 1
          }`,
          values
        );
      }
      break;
    }
    case "cdd":
      if (await hasEmploisCddTable(client) && typeof dureeMois === "number") {
        await client.query(
          `UPDATE emplois_cdd SET duree_mois = $1 WHERE emploi = $2`,
          [dureeMois, emploiId]
        );
      }
      break;
    case "postdoc": {
      const config = await getPostdocColumnConfig(client);
      if (config.exists && config.columns.has("organisme_financeur") && organismeFinancement !== undefined) {
        await client.query(
          `UPDATE emplois_postdoctoraux
           SET organisme_financeur = $1
           WHERE emploi = $2`,
          [organismeFinancement || null, emploiId]
        );
      }
      break;
    }
    case "stage": {
      const config = await getStageColumnConfig(client);
      if (config.exists && config.columns.has("duree_mois") && typeof dureeMois === "number") {
        await client.query(
          `UPDATE emplois_stage SET duree_mois = $1 WHERE emploi = $2`,
          [dureeMois, emploiId]
        );
      }
      break;
    }
    default:
      break;
  }
}

function requiresCorps(type) {
  return type === "chercheur" || type === "enseignant-chercheur" || type === "biatss";
}

function requiresGrade(type) {
  return type === "chercheur" || type === "enseignant-chercheur" || type === "biatss";
}

function requiresDuration(type, hasCdd = true) {
  return (type === "cdd" && hasCdd) || type === "stage";
}

function parseInteger(value, field) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Le champ '${field}' doit être un entier.`);
  }
  return parsed;
}

function isISODate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function createPersonnesRouter(pool) {
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    const { search, laboratoire } = req.query;
    const start = isISODate(req.query.start) ? req.query.start : null;
    const end = isISODate(req.query.end) ? req.query.end : null;
    try {
      const params = [];
      let query =
        `SELECT DISTINCT p.id,
                p.nom,
                p.prenom,
                p.sexe,
                p.nationalite,
                n.nationalite AS nationalite_nom,
                p.date_naissance
         FROM personnes p
         LEFT JOIN nationalites n ON n.id = p.nationalite`;
      const joins = [];
      const whereParts = [];
      if (laboratoire) {
        const labId = parseInt(laboratoire, 10);
        if (Number.isNaN(labId)) {
          return res.status(400).json({ error: "Invalid laboratoire id" });
        }
        params.push(labId);
        joins.push(
          `JOIN affectations_laboratoires al ON al.personne = p.id AND al.laboratoire = $${params.length}`
        );
        joins.push(
          "LEFT JOIN fin_affectations_laboratoires fal ON fal.affectation_laboratoire = al.id"
        );
        if (end) {
          params.push(end);
          whereParts.push(`al.date_debut <= $${params.length}`);
        }
        if (start) {
          params.push(start);
          whereParts.push(
            `(fal.date_fin IS NULL OR fal.date_fin >= $${params.length})`
          );
        }
      }
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
      if (joins.length) {
        query += `\n${joins.join("\n")}`;
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
      const emplois = await fetchPersonneEmployments(pool, personneId);
      personne.emplois = emplois;
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

  router.get("/:personneId/affectations", async (req, res, next) => {
    const personneId = parseInt(req.params.personneId, 10);
    if (Number.isNaN(personneId)) {
      return res.status(400).json({ error: "Invalid personne id" });
    }

    const start = isISODate(req.query.start) ? req.query.start : null;
    const end = isISODate(req.query.end) ? req.query.end : null;

    try {
      const labParams = [personneId];
      const labConditions = ["al.personne = $1"];
      if (end) {
        labParams.push(end);
        labConditions.push(`al.date_debut <= $${labParams.length}`);
      }
      if (start) {
        labParams.push(start);
        labConditions.push(
          `(fal.date_fin IS NULL OR fal.date_fin >= $${labParams.length})`
        );
      }
      const labWhere = labConditions.length
        ? `WHERE ${labConditions.join(" AND ")}`
        : "";
      const { rows: labRows } = await pool.query(
        `SELECT al.id,
                al.laboratoire,
                l.nom AS laboratoire_nom,
                l.acronyme AS laboratoire_acronyme,
                al.date_debut,
                fal.date_fin
         FROM affectations_laboratoires al
         JOIN laboratoires l ON l.id = al.laboratoire
         LEFT JOIN fin_affectations_laboratoires fal
           ON fal.affectation_laboratoire = al.id
         ${labWhere}
         ORDER BY al.date_debut`,
        labParams
      );

      const structParams = [personneId];
      const structConditions = ["asl.personne = $1"];
      if (end) {
        structParams.push(end);
        structConditions.push(`asl.date_debut <= $${structParams.length}`);
      }
      if (start) {
        structParams.push(start);
        structConditions.push(
          `(fasl.date_fin IS NULL OR fasl.date_fin >= $${structParams.length})`
        );
      }
      const structWhere = structConditions.length
        ? `WHERE ${structConditions.join(" AND ")}`
        : "";
      const { rows: structRows } = await pool.query(
        `SELECT asl.id,
                asl.structure_laboratoire,
                sl.nom AS structure_nom,
                sl.acronyme AS structure_acronyme,
                sl.kind,
                skl.nom AS kind_nom,
                asl.date_debut,
                fasl.date_fin
         FROM affectations_structures_laboratoires asl
         JOIN structures_laboratoires sl ON sl.id = asl.structure_laboratoire
         JOIN structures_laboratoires_kind skl ON skl.id = sl.kind
         LEFT JOIN fin_affectations_structures_laboratoires fasl
           ON fasl.affectation_structure_laboratoire = asl.id
         ${structWhere}
         ORDER BY asl.date_debut`,
        structParams
      );

      res.json({
        laboratoires: labRows,
        structures: structRows,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:personneId/emplois", async (req, res, next) => {
    const personneId = parseInt(req.params.personneId, 10);
    if (Number.isNaN(personneId)) {
      return res.status(400).json({ error: "Invalid personne id" });
    }
    const {
      type = "autre",
      date_debut: dateDebut,
      etablissement,
      corps,
      grade,
      duree_mois: dureeMois,
      organisme_financeur: organismeFinancement,
    } = req.body || {};

    if (!isISODate(dateDebut)) {
      return res
        .status(400)
        .json({ error: "Field 'date_debut' must be an ISO date (YYYY-MM-DD)" });
    }

    const typeNormalized = String(type || "autre").toLowerCase();
    if (!EMPLOYMENT_TYPES.has(typeNormalized)) {
      return res.status(400).json({ error: "Invalid employment type" });
    }

    const cddTableExists = await hasEmploisCddTable(pool);

    let etabId;
    try {
      etabId = parseInteger(etablissement, "etablissement");
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    let corpsId =
      corps === undefined || corps === null || corps === ""
        ? null
        : Number.parseInt(corps, 10);
    if (requiresCorps(typeNormalized) && !Number.isInteger(corpsId)) {
      return res
        .status(400)
        .json({ error: "Field 'corps' is required for this employment type" });
    }

    let gradeId =
      grade === undefined || grade === null || grade === ""
        ? null
        : Number.parseInt(grade, 10);
    if (requiresGrade(typeNormalized) && !Number.isInteger(gradeId)) {
      return res
        .status(400)
        .json({ error: "Field 'grade' is required for this employment type" });
    }

    let duree = null;
    const requiresDurationField = requiresDuration(
      typeNormalized,
      cddTableExists
    );
    if (requiresDurationField) {
      try {
        duree = parseInteger(dureeMois, "duree_mois");
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
      if (duree <= 0) {
        return res
          .status(400)
          .json({ error: "Field 'duree_mois' must be greater than 0" });
      }
    }

    const organismeValue =
      organismeFinancement === undefined
        ? undefined
        : (() => {
            if (organismeFinancement === null) {
              return null;
            }
            const text = String(organismeFinancement).trim();
            return text.length ? text : null;
          })();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const {
        rows,
      } = await client.query(
        `INSERT INTO emplois (personne, etablissement, date_debut)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [personneId, etabId, dateDebut]
      );
      const emploiId = rows[0].id;

      await attachEmploymentSpecialization(
        client,
        typeNormalized,
        emploiId,
        {
          corpsId,
          gradeId,
          dureeMois: duree,
          organismeFinancement: organismeValue,
        }
      );

      await client.query("COMMIT");
      const emploi = await fetchEmploymentById(pool, personneId, emploiId);
      res.status(201).json(emploi);
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  });

  router.patch("/:personneId/emplois/:emploiId", async (req, res, next) => {
    const personneId = parseInt(req.params.personneId, 10);
    const emploiId = parseInt(req.params.emploiId, 10);
    if (Number.isNaN(personneId) || Number.isNaN(emploiId)) {
      return res.status(400).json({ error: "Invalid identifiers" });
    }

    const {
      type,
      date_debut: dateDebut,
      etablissement,
      corps,
      grade,
      duree_mois: dureeMois,
      organisme_financeur: organismeFinancement,
    } = req.body || {};

    if (
      type === undefined &&
      dateDebut === undefined &&
      etablissement === undefined &&
      corps === undefined &&
      grade === undefined &&
      dureeMois === undefined &&
      organismeFinancement === undefined
    ) {
      return res.status(400).json({ error: "No fields provided to update" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `SELECT personne FROM emplois WHERE id = $1`,
        [emploiId]
      );
      if (!rows.length || rows[0].personne !== personneId) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Employment not found" });
      }

      if (dateDebut !== undefined && !isISODate(dateDebut)) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "Field 'date_debut' must be an ISO date (YYYY-MM-DD)" });
      }

      let etabId = null;
      if (etablissement !== undefined) {
        try {
          etabId = parseInteger(etablissement, "etablissement");
        } catch (error) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: error.message });
        }
      }

      if (dateDebut !== undefined || etablissement !== undefined) {
        const setParts = [];
        const values = [];
        let idx = 1;
        if (dateDebut !== undefined) {
          setParts.push(`date_debut = $${idx++}`);
          values.push(dateDebut);
        }
        if (etablissement !== undefined) {
          setParts.push(`etablissement = $${idx++}`);
          values.push(etabId);
        }
        values.push(emploiId);
        await client.query(
          `UPDATE emplois SET ${setParts.join(", ")} WHERE id = $${idx}`,
          values
        );
      }

      const currentType = await detectEmploymentType(client, emploiId);
      const nextType = type
        ? String(type).toLowerCase()
        : currentType || "autre";

      if (!EMPLOYMENT_TYPES.has(nextType)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid employment type" });
      }

      const cddTableExists = await hasEmploisCddTable(client);

      let corpsId =
        corps === undefined || corps === null || corps === ""
          ? null
          : Number.parseInt(corps, 10);
      let gradeId =
        grade === undefined || grade === null || grade === ""
          ? null
          : Number.parseInt(grade, 10);
      let duree =
        dureeMois === undefined || dureeMois === null || dureeMois === ""
          ? null
          : Number.parseInt(dureeMois, 10);
      const organismeValue =
        organismeFinancement === undefined
          ? undefined
          : (() => {
              if (organismeFinancement === null) {
                return null;
              }
              const text = String(organismeFinancement).trim();
              return text.length ? text : null;
            })();

      if (requiresCorps(nextType) && corps !== undefined && !Number.isInteger(corpsId)) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "Field 'corps' must be a valid integer" });
      }
      if (requiresGrade(nextType) && grade !== undefined && !Number.isInteger(gradeId)) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "Field 'grade' must be a valid integer" });
      }
      if (requiresDuration(nextType, cddTableExists) && dureeMois !== undefined) {
        if (!Number.isInteger(duree) || duree <= 0) {
          await client.query("ROLLBACK");
          return res
            .status(400)
            .json({ error: "Field 'duree_mois' must be a positive integer" });
        }
      }

      if (nextType !== currentType) {
        await clearEmploymentSpecializations(client, emploiId);
        if (requiresCorps(nextType) && !Number.isInteger(corpsId)) {
          await client.query("ROLLBACK");
          return res
            .status(400)
            .json({
              error: "Field 'corps' is required for the selected employment type",
            });
        }
        if (requiresGrade(nextType) && !Number.isInteger(gradeId)) {
          await client.query("ROLLBACK");
          return res
            .status(400)
            .json({
              error: "Field 'grade' is required for the selected employment type",
            });
        }
        if (requiresDuration(nextType, cddTableExists) && !Number.isInteger(duree)) {
          await client.query("ROLLBACK");
          return res
            .status(400)
            .json({
              error:
                "Field 'duree_mois' must be provided and greater than 0 for this employment type",
            });
        }
        await attachEmploymentSpecialization(
          client,
          nextType,
          emploiId,
          {
            corpsId,
            gradeId,
            dureeMois: duree,
            organismeFinancement: organismeValue,
          }
        );
      } else {
        await updateEmploymentSpecialization(
          client,
          currentType,
          emploiId,
          {
            corpsId,
            gradeId,
            dureeMois: duree,
            organismeFinancement: organismeValue,
          }
        );
      }

      await client.query("COMMIT");
      const emploi = await fetchEmploymentById(pool, personneId, emploiId);
      res.json(emploi);
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  });

    router.post("/:personneId/emplois/:emploiId/fin", async (req, res, next) => {
    const personneId = parseInt(req.params.personneId, 10);
    const emploiId = parseInt(req.params.emploiId, 10);
    if (Number.isNaN(personneId) || Number.isNaN(emploiId)) {
      return res.status(400).json({ error: "Invalid identifiers" });
    }

    const { date_fin } = req.body || {};
    if (!isISODate(date_fin)) {
      return res
        .status(400)
        .json({ error: "Field 'date_fin' must be provided as ISO date" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `SELECT personne FROM emplois WHERE id = $1`,
        [emploiId]
      );
      if (!rows.length || rows[0].personne !== personneId) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Employment not found" });
      }
      await client.query(
        `DELETE FROM fin_emplois WHERE emploi = $1`,
        [emploiId]
      );
      await client.query(
        `INSERT INTO fin_emplois (emploi, date_fin) VALUES ($1, $2)`,
        [emploiId, date_fin]
      );
      await client.query("COMMIT");
      const emploi = await fetchEmploymentById(pool, personneId, emploiId);
      res.status(201).json(emploi);
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  });

  router.delete("/:personneId/emplois/:emploiId/fin", async (req, res, next) => {
    const personneId = parseInt(req.params.personneId, 10);
    const emploiId = parseInt(req.params.emploiId, 10);
    if (Number.isNaN(personneId) || Number.isNaN(emploiId)) {
      return res.status(400).json({ error: "Invalid identifiers" });
    }

    try {
      const { rows } = await pool.query(
        `SELECT personne FROM emplois WHERE id = $1`,
        [emploiId]
      );
      if (!rows.length || rows[0].personne !== personneId) {
        return res.status(404).json({ error: "Employment not found" });
      }
      const result = await pool.query(
        `DELETE FROM fin_emplois WHERE emploi = $1 RETURNING id`,
        [emploiId]
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: "Fin d'emploi non trouvée." });
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

router.delete("/:personneId/emplois/:emploiId", async (req, res, next) => {
    const personneId = parseInt(req.params.personneId, 10);
    const emploiId = parseInt(req.params.emploiId, 10);
    if (Number.isNaN(personneId) || Number.isNaN(emploiId)) {
      return res.status(400).json({ error: "Invalid identifiers" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `SELECT personne FROM emplois WHERE id = $1`,
        [emploiId]
      );
      if (!rows.length || rows[0].personne !== personneId) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Employment not found" });
      }

      await clearEmploymentSpecializations(client, emploiId);
      await client.query(`DELETE FROM emplois WHERE id = $1`, [emploiId]);
      await client.query("COMMIT");
      res.status(204).send();
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  });

  router.post("/:personneId/affectations", async (req, res, next) => {
    const personneId = parseInt(req.params.personneId, 10);
    if (Number.isNaN(personneId)) {
      return res.status(400).json({ error: "Invalid personne id" });
    }

    const { laboratoire, date_debut, date_fin } = req.body || {};
    if (!laboratoire || !date_debut) {
      return res.status(400).json({ error: "Fields 'laboratoire' and 'date_debut' are required" });
    }

    if (!isISODate(date_debut)) {
      return res.status(400).json({ error: "Invalid date_debut format" });
    }

    try {
      // End any existing open affectation for this laboratoire
      await pool.query(
        `UPDATE affectations_laboratoires
         SET date_fin = $3
         WHERE personne = $1
           AND laboratoire = $2
           AND NOT EXISTS (SELECT 1 FROM fin_affectations_laboratoires fal WHERE fal.affectation_laboratoire = affectations_laboratoires.id)`,
        [personneId, laboratoire, date_debut]
      );

      const { rows } = await pool.query(
        `INSERT INTO affectations_laboratoires (personne, laboratoire, date_debut)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [personneId, laboratoire, date_debut]
      );

      const affId = rows[0].id;
      if (date_fin && isISODate(date_fin)) {
        await pool.query(
          `INSERT INTO fin_affectations_laboratoires (affectation_laboratoire, date_fin)
           VALUES ($1, $2)
           ON CONFLICT (affectation_laboratoire) DO UPDATE SET date_fin = EXCLUDED.date_fin`,
          [affId, date_fin]
        );
      }

      res.status(201).json({ id: affId });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/:personneId/affectations/:affectationId/fin",
    async (req, res, next) => {
      const personneId = parseInt(req.params.personneId, 10);
      const affectationId = parseInt(req.params.affectationId, 10);
      if (Number.isNaN(personneId) || Number.isNaN(affectationId)) {
        return res.status(400).json({ error: "Invalid identifiers" });
      }

      const { date_fin } = req.body || {};
      if (!isISODate(date_fin)) {
        return res
          .status(400)
          .json({ error: "Field 'date_fin' must be provided as ISO date" });
      }

      try {
        const { rows } = await pool.query(
          `SELECT id
           FROM affectations_laboratoires
           WHERE id = $1 AND personne = $2`,
          [affectationId, personneId]
        );
        if (!rows.length) {
          return res.status(404).json({ error: "Affectation not found" });
        }

        await pool.query(
          `INSERT INTO fin_affectations_laboratoires (affectation_laboratoire, date_fin)
           VALUES ($1, $2)
           ON CONFLICT (affectation_laboratoire) DO UPDATE SET date_fin = EXCLUDED.date_fin`,
          [affectationId, date_fin]
        );

        res.status(201).json({ id: affectationId, date_fin });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post("/:personneId/structures", async (req, res, next) => {
    const personneId = parseInt(req.params.personneId, 10);
    if (Number.isNaN(personneId)) {
      return res.status(400).json({ error: "Invalid personne id" });
    }

    const { structure, date_debut } = req.body || {};
    const structureId = parseInt(structure, 10);
    if (Number.isNaN(structureId) || !date_debut) {
      return res.status(400).json({
        error: "Fields 'structure' (numeric) and 'date_debut' are required",
      });
    }

    if (!isISODate(date_debut)) {
      return res.status(400).json({ error: "Invalid date_debut format" });
    }

    try {
      await pool.query(
        `INSERT INTO fin_affectations_structures_laboratoires (affectation_structure_laboratoire, date_fin)
         SELECT asl.id, $3
         FROM affectations_structures_laboratoires asl
         LEFT JOIN fin_affectations_structures_laboratoires fasl
           ON fasl.affectation_structure_laboratoire = asl.id
         WHERE asl.personne = $1
           AND asl.structure_laboratoire = $2
           AND fasl.id IS NULL`,
        [personneId, structureId, date_debut]
      );

      const { rows } = await pool.query(
        `INSERT INTO affectations_structures_laboratoires (personne, structure_laboratoire, date_debut)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [personneId, structureId, date_debut]
      );

      res.status(201).json({ id: rows[0].id });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/:personneId/structures/:affectationId/fin",
    async (req, res, next) => {
      const personneId = parseInt(req.params.personneId, 10);
      const affectationId = parseInt(req.params.affectationId, 10);
      if (Number.isNaN(personneId) || Number.isNaN(affectationId)) {
        return res.status(400).json({ error: "Invalid identifiers" });
      }

      const { date_fin } = req.body || {};
      if (!isISODate(date_fin)) {
        return res
          .status(400)
          .json({ error: "Field 'date_fin' must be provided as ISO date" });
      }

      try {
        const { rows } = await pool.query(
          `SELECT id
           FROM affectations_structures_laboratoires
           WHERE id = $1 AND personne = $2`,
          [affectationId, personneId]
        );
        if (!rows.length) {
          return res.status(404).json({ error: "Affectation not found" });
        }

        await pool.query(
          `INSERT INTO fin_affectations_structures_laboratoires (affectation_structure_laboratoire, date_fin)
           VALUES ($1, $2)
           ON CONFLICT (affectation_structure_laboratoire) DO UPDATE SET date_fin = EXCLUDED.date_fin`,
          [affectationId, date_fin]
        );

        res.status(201).json({ id: affectationId, date_fin });
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    "/:personneId/structures/:affectationId/fin",
    async (req, res, next) => {
      const personneId = parseInt(req.params.personneId, 10);
      const affectationId = parseInt(req.params.affectationId, 10);
      if (Number.isNaN(personneId) || Number.isNaN(affectationId)) {
        return res.status(400).json({ error: "Invalid identifiers" });
      }

      try {
        const { rows } = await pool.query(
          `SELECT id
           FROM affectations_structures_laboratoires
           WHERE id = $1 AND personne = $2`,
          [affectationId, personneId]
        );
        if (!rows.length) {
          return res.status(404).json({ error: "Affectation not found" });
        }
        const result = await pool.query(
          `DELETE FROM fin_affectations_structures_laboratoires
           WHERE affectation_structure_laboratoire = $1
           RETURNING id`,
          [affectationId]
        );
        if (!result.rows.length) {
          return res
            .status(404)
            .json({ error: "Fin d'affectation non trouvée." });
        }
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    "/:personneId/structures/:affectationId",
    async (req, res, next) => {
      const personneId = parseInt(req.params.personneId, 10);
      const affectationId = parseInt(req.params.affectationId, 10);
      if (Number.isNaN(personneId) || Number.isNaN(affectationId)) {
        return res.status(400).json({ error: "Invalid identifiers" });
      }

      try {
        const { rows } = await pool.query(
          `DELETE FROM affectations_structures_laboratoires
           WHERE id = $1 AND personne = $2
           RETURNING id`,
          [affectationId, personneId]
        );
        if (!rows.length) {
          return res.status(404).json({ error: "Affectation not found" });
        }
        await pool.query(
          `DELETE FROM fin_affectations_structures_laboratoires
           WHERE affectation_structure_laboratoire = $1`,
          [affectationId]
        );
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete("/:personneId/affectations/:affectationId", async (req, res, next) => {
    const personneId = parseInt(req.params.personneId, 10);
    const affectationId = parseInt(req.params.affectationId, 10);
    if (Number.isNaN(personneId) || Number.isNaN(affectationId)) {
      return res.status(400).json({ error: "Invalid identifiers" });
    }

    try {
      const { rows } = await pool.query(
        `DELETE FROM affectations_laboratoires
         WHERE id = $1 AND personne = $2
         RETURNING id`,
        [affectationId, personneId]
      );
      if (!rows.length) {
        return res.status(404).json({ error: "Affectation not found" });
      }
      await pool.query(
        `DELETE FROM fin_affectations_laboratoires
         WHERE affectation_laboratoire = $1`,
        [affectationId]
      );
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
