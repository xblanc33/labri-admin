"use strict";

require("dotenv").config();

const { Client } = require("pg");



const old_client = new Client({
    password: "mysecretpassword",
    user: "postgres",
    database: "labri"
});

const new_client = new Client({
    password: "mysecretpassword",
    user: "postgres",
    database: "labri_admin"
});


async function membresToPersonnes() {
    console.log("Migrating membres to personnes...");
    let query = `SELECT nom, prenom, sexe, date_naissance FROM membres`;
    const { rows } = await old_client.query(query);
    console.log(rows);
    console.log(`Migrating ${rows.length} membres to personnes...`);
    for (const row of rows) {
        // Check if person already exists
        const checkQuery = `
            SELECT id FROM personnes 
            WHERE nom = $1 AND prenom = $2
        `;
        const existingPerson = await new_client.query(checkQuery, [row.nom, row.prenom]);
        
        if (existingPerson.rows.length === 0 && row.nom != 'Nouveau') {
            const insertQuery = `
                INSERT INTO personnes (nom, prenom, sexe, date_naissance)
                VALUES ($1, $2, $3, $4)
            `;
            await new_client.query(insertQuery, [row.nom, row.prenom, row.sexe, row.date_naissance]);
            console.log(`Inserted: ${row.prenom} ${row.nom}`);
        } else {
            console.log(`Skipped duplicate: ${row.prenom} ${row.nom}`);
        }
    }
}


async function migrateDoctorantsToPersonnes() {
    // Similar implementation as membresToPersonnes
    // Fetch doctorants from old database and insert into new database
    // with duplicate checks
    const query = `SELECT nom, prenom, sexe, date_naissance, nationalite FROM doctorants`;
    // Implementation goes here
    const { rows } = await old_client.query(query);
    for (const row of rows) {
        // Check if person already exists
        const checkQuery = `
            SELECT id FROM personnes 
            WHERE nom = $1 AND prenom = $2
        `;
        const existingPerson = await new_client.query(checkQuery, [row.nom, row.prenom]);
        
        if (existingPerson.rows.length === 0) {
            //get nationalite id from new database
            let nationalite_id = null;
            if (row.nationalite) {
                console.log(`Looking up nationalite: ${row.nationalite}`);
                const natQuery = `SELECT id FROM nationalites WHERE id = $1`;
                const natResult = await new_client.query(natQuery, [row.nationalite]);
                if (natResult.rows.length > 0) {
                    nationalite_id = natResult.rows[0].id;
                }
            }
            const insertQuery = `
                INSERT INTO personnes (nom, prenom, sexe, date_naissance, nationalite)
                VALUES ($1, $2, $3, $4, $5)
            `;
            console.log(nationalite_id)
            await new_client.query(insertQuery, [row.nom, row.prenom, row.sexe, row.date_naissance, nationalite_id]);
            console.log(`Inserted: ${row.prenom} ${row.nom}`);
        } else {
            console.log(`Skipped duplicate: ${row.prenom} ${row.nom}`);
        }
    }
}

async function create_etablissements() {
    // for all etablissements in the old database, insert them into the new database
    const query = `SELECT * FROM etablissements`;
    const { rows } = await old_client.query(query);
    for (const etablissement of rows) {
        //check name uniqueness
        const checkQuery = `SELECT id FROM etablissements WHERE UPPER(etablissement) = UPPER($1)`;
        const existingEtablissement = await new_client.query(checkQuery, [etablissement.etablissement]);
        if (existingEtablissement.rows.length === 0) {
            const insertQuery = `INSERT INTO etablissements (etablissement) VALUES ($1)`;
            await new_client.query(insertQuery, [etablissement.etablissement]);
            console.log(`Inserted etablissements: ${etablissement.etablissement}`);
        } else {
            console.log(`Skipped duplicate etablissements: ${etablissement.etablissement}`);
        }
    }
}

async function set_tutelles_to_labri() {
    const tutelles = ['CNRS', 'Université de Bordeaux', 'Bordeaux INP'];
    for (const tutelle of tutelles) {
        const checkQuery = `SELECT id FROM etablissements WHERE UPPER(etablissement) = UPPER($1)`;
        const existingTutelle = await new_client.query(checkQuery, [tutelle]);
        if (existingTutelle.rows.length === 0) {
            const insertQuery = `INSERT INTO tutelles_laboratoires (laboratoire, etablissement) VALUES ($1, $2)`;
            await new_client.query(insertQuery, [tutelle, 1]); // assuming 1 is the id for LABRI
            console.log(`Inserted tutelle: ${tutelle}`);
        } else {
            console.log(`Skipped duplicate tutelle: ${tutelle}`);
        }
    }
}

async function create_labri_structures() {
    await create_structures_kinds();
    await set_structures_to_labri();
}

async function create_structures_kinds() {
    const kinds = ['Département', 'Équipe', 'Axe'];
    for (const kind of kinds) {
        const checkQuery = `SELECT id FROM structures_laboratoires_kind WHERE UPPER(nom) = UPPER($1)`;
        const existingKind = await new_client.query(checkQuery, [kind]);
        if (existingKind.rows.length === 0) {
            const insertQuery = `INSERT INTO structures_laboratoires_kind (nom) VALUES ($1)`;
            await new_client.query(insertQuery, [kind]);
            console.log(`Inserted structure kind: ${kind}`);
        } else {
            console.log(`Skipped duplicate structure kind: ${kind}`);
        }
    }
} 

function structure_old_id_to_new_id(kind, old_id) {
    if (kind === 'departement') {
        switch (old_id) {
            case 1: return 1; // CombAlgo
            case 2: return 6; // I&S
            case 3: return 9; // M2F
            case 4: return 15; // SATANAS
            case 5: return 19; // SeD
            case 6: return 23; // SAR
            default: return null;
        }
    } else if (kind === 'equipe') {
        switch (old_id) {
            case 1: return 2; // CI
            case 2: return 3; // GO
            case 3: return 4; // AD
            case 4: return 5; // ICQ
            case 5: return 7; // MANIOC
            case 6: return 8; // TAD
            case 7: return 10; // MTV
            case 8: return 11; // LX
            case 9: return 12; // RATIO
            case 10: return 13; // DART
            case 11: return 14; // SYNTHESE
            case 12: return 16; // STORM
            case 13: return 17; // TADaaM
            case 14: return 18; // TOPAL
            case 15: return 20; // Progress
            case 16: return 21; // BKB
            case 17: return 22; // NeS
            case 18: return 24; // Administration
            case 19: return 25; // Finance
            case 20: return 26; // Système
            default: return null;
        }
    } else if (kind === 'axe') {
        switch (old_id) {
            case 1: return 27; // IA
            case 2: return 28; // SN
            default: return null;
        }
    }
}

async function set_structures_to_labri() {
    const departements = [
        {nom: 'Combinatoire et Algorithmique', acronyme:'CombAlgo'},
        {nom: 'Image et Son', acronyme:'I&S'},
        {nom: 'Méthodes et Modèles Formels', acronyme:'M2F'},
        {nom: 'Supports et AlgoriThmes pour les Applications Numériques hAutes performanceS', acronyme:'SATANAS'},
        {nom: 'Systèmes et Données', acronyme:'SeD'},
        {nom: 'Soutien à la Recherche', acronyme:'SAR'},
    ];
    const equipes = [
        [
            {nom: 'Combinatoire et Interactions', acronyme: 'CI'},
            {nom: 'Graphes et Optimisation', acronyme: 'GO'},
            {nom: 'Algorithmique Distribuée', acronyme: 'AD'},
            {nom: 'Information et Calcul Quantique', acronyme: 'ICQ'}
        ],
        [
            {nom: 'MANIOC', acronyme: 'MANIOC'},
            {nom: 'Traitement et analyse de données', acronyme: 'TAD'}
        ],
        [
            {nom: 'Modèles et Technologies pour la Vérification', acronyme: 'MTV'},
            {nom: 'Fondements logiques du calcul', acronyme: 'LX'},
            {nom: 'Raisonnement sur les données, les connaissances et les contraintes', acronyme: 'RATIO'},
            {nom: 'Robotique et Systèmes de Transports Intelligents', acronyme: 'DART'},
            {nom: 'SYNTHESE', acronyme: 'SYNTHESE'}
        ],
        [
            {nom: 'STatic Optimizations, Runtime Methods', acronyme: 'STORM'},
            {nom: 'Topology-aware system-scale data management for high-performance computing', acronyme: 'TADaaM'},
            {nom: 'Tools and Optimization for high Performance Applications and Learning', acronyme: 'TOPAL'}
        ],
        [
            {nom: 'Programmation, Réseaux et Systèmes', acronyme: 'Progress'},
            {nom: 'Bench to Knowledge and Beyond', acronyme: 'BKB'},
            {nom: 'Numérique-et-soutenabilité', acronyme: 'NeS'}
        ],
        [
            {nom: 'Administration', acronyme: 'Administration'},
            {nom: 'Finance', acronyme: 'Finance'},
            {nom: 'Système', acronyme: 'Système'}
        ]
    ];
    const axes = [
        {nom: 'Intelligence Artificielle', acronyme: 'IA'},
        {nom: 'Santé Numérique', acronyme: 'SN'}
    ];

    for (const dep of departements) {
        const checkQuery = `SELECT id FROM structures_laboratoires WHERE UPPER(nom) = UPPER($1)`;
        const existingDep = await new_client.query(checkQuery, [dep.nom]);
        if (existingDep.rows.length === 0) {
            // ask the query to return the id of the inserted row, the DB is postgres
            const insertQuery = `INSERT INTO structures_laboratoires (nom, acronyme, laboratoire, date_creation, kind) VALUES ($1, $2, $3, $4, $5) RETURNING id`;
            const result = await new_client.query(insertQuery, [dep.nom, dep.acronyme, 1, '2021-01-01', 1]);
            const newDepId = result.rows[0].id;
            console.log(`Inserted departement: ${dep.nom}`);
            await set_equipes_to_labri(newDepId, equipes[departements.indexOf(dep)]);
        } else {
            console.log(`Skipped duplicate departement: ${dep.nom}`);
        }
    }

    for (const axe of axes) {
        const checkQuery = `SELECT id FROM structures_laboratoires WHERE UPPER(nom) = UPPER($1)`;
        const existingAxe = await new_client.query(checkQuery, [axe.nom]);
        if (existingAxe.rows.length === 0) {
            const insertQuery = `INSERT INTO structures_laboratoires (nom, acronyme, laboratoire, date_creation, kind) VALUES ($1, $2, $3, $4, $5)`;
            await new_client.query(insertQuery, [axe.nom, axe.acronyme, 1, '2021-01-01', 3]);
            console.log(`Inserted axe: ${axe.nom}`);
        } else {
            console.log(`Skipped duplicate axe: ${axe.nom}`);
        }
    }
}

async function set_equipes_to_labri(departement_id, equipes) {
    for (const equipe of equipes) {
        const checkQuery = `SELECT id FROM structures_laboratoires WHERE UPPER(nom) = UPPER($1)`;
        const existingEquipe = await new_client.query(checkQuery, [equipe.nom]);
        if (existingEquipe.rows.length === 0) {
            const insertQuery = `INSERT INTO structures_laboratoires (nom, acronyme, laboratoire, date_creation, kind, structure_parent) VALUES ($1, $2, $3, $4, $5, $6)`;
            await new_client.query(insertQuery, [equipe.nom, equipe.acronyme, 1, '2021-01-01', 2, departement_id]);
            console.log(`Inserted equipe: ${equipe.nom}`);
        } else {
            console.log(`Skipped duplicate equipe: ${equipe.nom}`);
        }
    }
}

async function affectation_laboratoire() {
    await affectation_laboratoire_membres();
    await affectation_laboratoire_doctorants();
}

async function affectation_laboratoire_membres() {
    // for all arrivees in the old database joined with membres, set an affectations_laboratoires for the corresponding personne
    const query = `SELECT m.nom, m.prenom, a.date_arrivee
        FROM arrivees a
        JOIN membres m ON a.membre = m.id`;
    // Implementation goes here
    const { rows } = await old_client.query(query);
    for (const row of rows) {
        // get personne id
        const checkQuery = `
            SELECT id FROM personnes 
            WHERE UPPER(nom) = UPPER($1) AND UPPER(prenom) = UPPER($2)
        `;
        const existingPerson = await new_client.query(checkQuery, [row.nom, row.prenom]);
        if (existingPerson.rows.length > 0) {
            const personne_id = existingPerson.rows[0].id;
            // insert affectation_laboratoire
            const insertQuery = `
                INSERT INTO affectations_laboratoires (personne, laboratoire, date_debut)
                VALUES ($1, $2, $3)
            `;
            await new_client.query(insertQuery, [personne_id, 1, row.date_arrivee]); // assuming 1 is the id for LABRI
            console.log(`Inserted affectation for: ${row.prenom} ${row.nom}`);
        }
    }

    // for all departs in the old database joined with membres, set the date_fin for the corresponding affectations_laboratoires
    const departQuery = `SELECT m.nom, m.prenom, d.date_depart
        FROM departs d
        JOIN membres m ON d.membre = m.id`;
    const departRows = await old_client.query(departQuery);
    for (const row of departRows.rows) {
        // get personne id
        const checkQuery = `
            SELECT id FROM personnes 
            WHERE UPPER(nom) = UPPER($1) AND UPPER(prenom) = UPPER($2)
        `;
        const existingPerson = await new_client.query(checkQuery, [row.nom, row.prenom]);
        if (existingPerson.rows.length > 0) {
            const personne_id = existingPerson.rows[0].id;
            // get the latest affectation_laboratoire for this personne
            const affectationQuery = `
                SELECT id FROM affectations_laboratoires
                WHERE personne = $1
                ORDER BY date_debut DESC
                LIMIT 1
            `;
            const affectationResult = await new_client.query(affectationQuery, [personne_id]);
            if (affectationResult.rows.length > 0) {
                const affectation_id = affectationResult.rows[0].id;
                // update the affectation_laboratoire with date_fin
                const updateQuery = `
                    INSERT INTO fin_affectations_laboratoires (affectation_laboratoire, date_fin)
                    VALUES ($1, $2)
                `;
                await new_client.query(updateQuery, [affectation_id, row.date_depart]);
                console.log(`Inserted fin_affectation for: ${row.prenom} ${row.nom}`);
            }
        }
    }
}

async function affectation_laboratoire_doctorants() {
    //for all doctorant in the old database, set an affectations_laboratoires for the corresponding personne
    const query = `SELECT d.nom, d.prenom, d.date_debut, date_fin
        FROM doctorants d`;
    const { rows } = await old_client.query(query);
    for (const row of rows) {
        // get personne id
        const checkQuery = `
            SELECT id FROM personnes 
            WHERE UPPER(nom) = UPPER($1) AND UPPER(prenom) = UPPER($2)
        `;
        const existingPerson = await new_client.query(checkQuery, [row.nom, row.prenom]);
        if (existingPerson.rows.length > 0) {
            const personne_id = existingPerson.rows[0].id;
            // insert affectation_laboratoire
            const insertQuery = `
                INSERT INTO affectations_laboratoires (personne, laboratoire, date_debut)
                VALUES ($1, $2, $3)
                returning id
            `;
            const result = await new_client.query(insertQuery, [personne_id, 1, row.date_debut]); // assuming 1 is
            console.log(`Inserted affectation for: ${row.prenom} ${row.nom}`);
            if (row.date_fin) {
                const updateQuery = `
                    INSERT INTO fin_affectations_laboratoires (affectation_laboratoire, date_fin)
                    VALUES ($1, $2)
                `;
                await new_client.query(updateQuery, [result.rows[0].id, row.date_fin]);
                console.log(`Inserted fin_affectation for: ${row.prenom} ${row.nom}`);
            }
        }
    }
}

async function set_affectations_structures() {
    await affectation_structures_membres();
    await affectation_structures_doctorants();
}

async function affectation_structures_membres() {
    //for all membre in the old database, set an affectations_structures for the corresponding personne
    const query = `SELECT m.nom, m.prenom, m.departement
        FROM membres m`;
    const { rows } = await old_client.query(query);
    for (const row of rows) {
        // get personne id
        const checkQuery = `
            SELECT id FROM personnes
            WHERE UPPER(nom) = UPPER($1) AND UPPER(prenom) = UPPER($2)
        `;
        const existingPerson = await new_client.query(checkQuery, [row.nom, row.prenom]);
        if (existingPerson.rows.length > 0) {
            const personne_id = existingPerson.rows[0].id;
            // get last affectations_laboratoires for this personne
            const lastAffectationQuery = `
                SELECT id, date_debut FROM affectations_laboratoires
                WHERE personne = $1
                ORDER BY date_debut DESC
                LIMIT 1
            `;
            const lastAffectation = await new_client.query(lastAffectationQuery, [personne_id]);

            if (lastAffectation.rows.length === 0) {
                console.log(`No affectation_laboratoire found for: ${row.prenom} ${row.nom}, skipping affectation_structure.`);
                break;
            }
            // insert affectation_structure
            const insertQuery = `
                INSERT INTO affectations_structures_laboratoires (personne, structure_laboratoire, date_debut)
                VALUES ($1, $2, $3)
                returning id
            `;
            const result = await new_client.query(insertQuery, [personne_id, structure_old_id_to_new_id('departement', row.departement), lastAffectation.rows[0].date_debut]); 
            console.log(`Inserted affectation for: ${row.prenom} ${row.nom}`);
        }
    }

    //for all membres_equipes in the old database, set the date_fin for the corresponding affectations_structures
    const membresEquipesQuery = `SELECT m.nom, m.prenom, me.equipe
        FROM membres_equipes me
        JOIN membres m ON me.membre = m.id`;
    const membresEquipesRows = await old_client.query(membresEquipesQuery);
    for (const row of membresEquipesRows.rows) {
        // get personne id
        const checkQuery = `
            SELECT id FROM personnes
            WHERE UPPER(nom) = UPPER($1) AND UPPER(prenom) = UPPER($2)
        `;
        const existingPerson = await new_client.query(checkQuery, [row.nom, row.prenom]);
        if (existingPerson.rows.length > 0) {
            const personne_id = existingPerson.rows[0].id;
            // get the last affectations_structures for this personne
            const lastAffectationQuery = `
                SELECT id, date_debut FROM affectations_laboratoires
                WHERE personne = $1 AND laboratoire = 1
                ORDER BY date_debut DESC
                LIMIT 1
            `;
            const lastAffectation = await new_client.query(lastAffectationQuery, [personne_id]);
            // update the affectation_structure with date_fin

            if (lastAffectation.rows.length === 0 || !lastAffectation.rows[0].date_debut) {
                console.log(`No affectation_laboratoire found for: ${row.prenom} ${row.nom}, skipping affectation_structure.`);
                break;
            }
            
            // set an affectations_structures_laboratoires
            const updateQuery = `
                INSERT INTO affectations_structures_laboratoires (personne, structure_laboratoire, date_debut)
                VALUES ($1, $2, $3)
            `;
            await new_client.query(updateQuery, [personne_id, structure_old_id_to_new_id('equipe', row.equipe), lastAffectation.rows[0].date_debut]); // assuming 1 is the structure id
        }
    }
}

async function affectation_structures_doctorants() {
    //for all doctorants in the old database, set an affectations_structures for the corresponding personne
    const query = `SELECT m.nom, m.prenom, m.departement
        FROM doctorants m`;
    const { rows } = await old_client.query(query);
    for (const row of rows) {
        // get personne id
        const checkQuery = `
            SELECT id FROM personnes
            WHERE UPPER(nom) = UPPER($1) AND UPPER(prenom) = UPPER($2)
        `;
        const existingPerson = await new_client.query(checkQuery, [row.nom, row.prenom]);
        if (existingPerson.rows.length > 0) {
            const personne_id = existingPerson.rows[0].id;
            // get last affectations_laboratoires for this personne
            const lastAffectationQuery = `
                SELECT id, date_debut FROM affectations_laboratoires
                WHERE personne = $1
                ORDER BY date_debut DESC
                LIMIT 1
            `;
            const lastAffectation = await new_client.query(lastAffectationQuery, [personne_id]);

            if (lastAffectation.rows.length === 0) {
                console.log(`No affectation_laboratoire found for: ${row.prenom} ${row.nom}, skipping affectation_structure.`);
                break;
            }
            // insert affectation_structure
            const insertQuery = `
                INSERT INTO affectations_structures_laboratoires (personne, structure_laboratoire, date_debut)
                VALUES ($1, $2, $3)
                returning id
            `;
            const result = await new_client.query(insertQuery, [personne_id, structure_old_id_to_new_id('departement', row.departement), lastAffectation.rows[0].date_debut]); 
            console.log(`Inserted affectation for: ${row.prenom} ${row.nom}`);
        }
    }

    //for all doctorants_equipes in the old database, set the date_fin for the corresponding affectations_structures
    const doctorantsEquipesQuery = `SELECT d.nom, d.prenom, de.equipe
        FROM doctorants_equipes de
        JOIN doctorants d ON de.doctorant = d.id`;
    const doctorantsEquipesRows = await old_client.query(doctorantsEquipesQuery);
    for (const row of doctorantsEquipesRows.rows) {
        // get personne id
        const checkQuery = `
            SELECT id FROM personnes
            WHERE UPPER(nom) = UPPER($1) AND UPPER(prenom) = UPPER($2)
        `;
        const existingPerson = await new_client.query(checkQuery, [row.nom, row.prenom]);
        if (existingPerson.rows.length > 0) {
            const personne_id = existingPerson.rows[0].id;
            // get the last affectations_structures for this personne
            const lastAffectationQuery = `
                SELECT id, date_debut FROM affectations_laboratoires
                WHERE personne = $1 AND laboratoire = 1
                ORDER BY date_debut DESC
                LIMIT 1
            `;
            const lastAffectation = await new_client.query(lastAffectationQuery, [personne_id]);
            // update the affectation_structure with date_fin

            if (lastAffectation.rows.length === 0 || !lastAffectation.rows[0].date_debut) {
                console.log(`No affectation_laboratoire found for: ${row.prenom} ${row.nom}, skipping affectation_structure.`);
                break;
            }
            
            // set an affectations_structures_laboratoires
            const updateQuery = `
                INSERT INTO affectations_structures_laboratoires (personne, structure_laboratoire, date_debut)
                VALUES ($1, $2, $3)
            `;
            await new_client.query(updateQuery, [personne_id, structure_old_id_to_new_id('equipe', row.equipe), lastAffectation.rows[0].date_debut]); // assuming 1 is the structure id
        }
    }
}

async function emplois_enseignants_chercheurs() {
    // For all membres with type_emploi 'enseignant-chercheur', create an emploi in the new database
    const query = `SELECT m.nom, m.prenom, te.type_emploi, g.grade, c.corp, e.etablissement
        FROM membres m
        JOIN types_emploi te ON m.type_emploi = te.id
        JOIN grades g ON m.grade = g.id
        JOIN corps c ON m.corps = c.id
        JOIN etablissements e ON m.etablissement = e.id
        WHERE te.type_emploi = 'Enseignant Chercheur titulaire';`;
    const { rows } = await old_client.query(query);
    for (const row of rows) {
        // get personne id
        const checkQuery = `
            SELECT id FROM personnes
            WHERE UPPER(nom) = UPPER($1) AND UPPER(prenom) = UPPER($2)
        `;
        const existingPerson = await new_client.query(checkQuery, [row.nom, row.prenom]);
        if (existingPerson.rows.length > 0) {
            const personne_id = existingPerson.rows[0].id;

            const lastAffectationQuery = `
                SELECT id, date_debut FROM affectations_laboratoires
                WHERE personne = $1 AND laboratoire = 1
                ORDER BY date_debut DESC
                LIMIT 1
            `;
            const lastAffectation = await new_client.query(lastAffectationQuery, [personne_id]);

            if (lastAffectation.rows.length === 0) {
                console.log(`No affectation_laboratoire found for: ${row.prenom} ${row.nom}, skipping emploi creation.`);
                break;
            }

            // get etablissement id
            let etablissement_id = null;
            if (row.etablissement) {
                console.log(`Looking up etablissement: ${row.etablissement}`);
                const etabQuery = `SELECT id FROM etablissements WHERE UPPER(etablissement) = UPPER($1)`;
                const etabResult = await new_client.query(etabQuery, [row.etablissement]);
                if (etabResult.rows.length > 0) {
                    etablissement_id = etabResult.rows[0].id;
                }
            }

            if (!etablissement_id) {
                console.log(`Etablissement not found for: ${row.prenom} ${row.nom}, skipping emploi creation.`);
                break;
            }
            
            // insert emploi and return id
            const insertQuery = `
                INSERT INTO emplois (personne, date_debut, etablissement, type_emploi) 
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `;
            const insertResult = await new_client.query(insertQuery, [personne_id, lastAffectation.rows[0].date_debut, etablissement_id, 1]); // assuming 1 is the id for 'Fonctionnaire'
            const emploi_id = insertResult.rows[0].id;
            console.log(`Inserted emploi for: ${row.prenom} ${row.nom}`);

            // get corps id
            let corp_id = null;
            if (row.corp) {
                console.log(`Looking up corp: ${row.corp}`);
                const corpQuery = `SELECT id FROM corps_enseignants_chercheurs WHERE UPPER(corps) = UPPER($1)`;
                const corpResult = await new_client.query(corpQuery, [row.corp]);
                if (corpResult.rows.length > 0) {
                    corp_id = corpResult.rows[0].id;
                }
            }

            // get grade id
            let grade_id = null;
            if (row.grade) {
                console.log(`Looking up grade: ${row.grade}`);
                const gradeQuery = `SELECT id FROM grades WHERE UPPER(grade) = UPPER($1)`;
                const gradeResult = await new_client.query(gradeQuery, [row.grade]);
                if (gradeResult.rows.length > 0) {
                    grade_id = gradeResult.rows[0].id;
                }
            }

            if (corp_id && grade_id) {
                // insert emplois_enseignants_chercheurs
                const emploiECInsertQuery = `
                    INSERT INTO emplois_enseignants_chercheurs (corps, grade, emploi)
                    VALUES ($1, $2, $3)
                `;
                await new_client.query(emploiECInsertQuery, [corp_id, grade_id, emploi_id]);
                console.log(`Inserted emploi_enseignant_chercheur for: ${row.prenom} ${row.nom}`);
            } else {
                console.log(`Corp or Grade not found for: ${row.prenom} ${row.nom}, skipping emploi_enseignant_chercheur creation.`);
            }

        }
    }
}


async function emplois_chercheurs() {
    // For all membres with type_emploi 'Chercheur titulaire', create an emploi in the new database
    const query = `SELECT m.nom, m.prenom, te.type_emploi, g.grade, c.corp, e.etablissement
        FROM membres m
        JOIN types_emploi te ON m.type_emploi = te.id
        JOIN grades g ON m.grade = g.id
        JOIN corps c ON m.corps = c.id
        JOIN etablissements e ON m.etablissement = e.id
        WHERE te.type_emploi = 'Chercheur titulaire';`;
    const { rows } = await old_client.query(query);
    for (const row of rows) {
        // get personne id
        const checkQuery = `
            SELECT id FROM personnes
            WHERE UPPER(nom) = UPPER($1) AND UPPER(prenom) = UPPER($2)
        `;
        const existingPerson = await new_client.query(checkQuery, [row.nom, row.prenom]);
        if (existingPerson.rows.length > 0) {
            const personne_id = existingPerson.rows[0].id;

            const lastAffectationQuery = `
                SELECT id, date_debut FROM affectations_laboratoires
                WHERE personne = $1 AND laboratoire = 1
                ORDER BY date_debut DESC
                LIMIT 1
            `;
            const lastAffectation = await new_client.query(lastAffectationQuery, [personne_id]);

            if (lastAffectation.rows.length === 0) {
                console.log(`No affectation_laboratoire found for: ${row.prenom} ${row.nom}, skipping emploi creation.`);
                break;
            }

            // get etablissement id
            let etablissement_id = null;
            if (row.etablissement) {
                console.log(`Looking up etablissement: ${row.etablissement}`);
                const etabQuery = `SELECT id FROM etablissements WHERE UPPER(etablissement) = UPPER($1)`;
                const etabResult = await new_client.query(etabQuery, [row.etablissement]);
                if (etabResult.rows.length > 0) {
                    etablissement_id = etabResult.rows[0].id;
                }
            }

            if (!etablissement_id) {
                console.log(`Etablissement not found for: ${row.prenom} ${row.nom}, skipping emploi creation.`);
                break;
            }
            
            // insert emploi and return id
            const insertQuery = `
                INSERT INTO emplois (personne, date_debut, etablissement, type_emploi) 
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `;
            const insertResult = await new_client.query(insertQuery, [personne_id, lastAffectation.rows[0].date_debut, etablissement_id, 1]);
            const emploi_id = insertResult.rows[0].id;
            console.log(`Inserted emploi for: ${row.prenom} ${row.nom}`);

            // get corps id
            let corp_id = null;
            if (row.corp) {
                console.log(`Looking up corp: ${row.corp}`);
                const corpQuery = `SELECT id FROM corps_chercheurs WHERE UPPER(corps) = UPPER($1)`;
                const corpResult = await new_client.query(corpQuery, [row.corp]);
                if (corpResult.rows.length > 0) {
                    corp_id = corpResult.rows[0].id;
                }
            }

            // get grade id
            let grade_id = null;
            if (row.grade) {
                console.log(`Looking up grade: ${row.grade}`);
                const gradeQuery = `SELECT id FROM grades WHERE UPPER(grade) = UPPER($1)`;
                const gradeResult = await new_client.query(gradeQuery, [row.grade]);
                if (gradeResult.rows.length > 0) {
                    grade_id = gradeResult.rows[0].id;
                }
            }

            if (corp_id && grade_id) {
                // insert emplois_chercheurs
                const emploiCInsertQuery = `
                    INSERT INTO emplois_chercheurs (corps, grade, emploi)
                    VALUES ($1, $2, $3)
                `;
                await new_client.query(emploiCInsertQuery, [corp_id, grade_id, emploi_id]);
                console.log(`Inserted emploi_chercheur for: ${row.prenom} ${row.nom}`);
            } else {
                console.log(`Corp or Grade not found for: ${row.prenom} ${row.nom}, skipping emploi_chercheur creation.`);
            }

        }
    }
}



async function emplois_biatss() {
    // For all membres with type_emploi 'BIATSS - BAP E' or 'BIATSS - BAP J', create an emploi in the new database
    const query = `SELECT m.nom, m.prenom, te.type_emploi, g.grade, c.corp, e.etablissement
        FROM membres m
        JOIN types_emploi te ON m.type_emploi = te.id
        JOIN grades g ON m.grade = g.id
        JOIN corps c ON m.corps = c.id
        JOIN etablissements e ON m.etablissement = e.id
        WHERE te.type_emploi IN ('BIATSS - BAP E', 'BIATSS - BAP J');`;
    const { rows } = await old_client.query(query);
    for (const row of rows) {
        // get personne id
        const checkQuery = `
            SELECT id FROM personnes
            WHERE UPPER(nom) = UPPER($1) AND UPPER(prenom) = UPPER($2)
        `;
        const existingPerson = await new_client.query(checkQuery, [row.nom, row.prenom]);
        if (existingPerson.rows.length > 0) {
            const personne_id = existingPerson.rows[0].id;

            const lastAffectationQuery = `
                SELECT id, date_debut FROM affectations_laboratoires
                WHERE personne = $1 AND laboratoire = 1
                ORDER BY date_debut DESC
                LIMIT 1
            `;
            const lastAffectation = await new_client.query(lastAffectationQuery, [personne_id]);

            if (lastAffectation.rows.length === 0) {
                console.log(`No affectation_laboratoire found for: ${row.prenom} ${row.nom}, skipping emploi creation.`);
                break;
            }

            // get etablissement id
            let etablissement_id = null;
            if (row.etablissement) {
                console.log(`Looking up etablissement: ${row.etablissement}`);
                const etabQuery = `SELECT id FROM etablissements WHERE UPPER(etablissement) = UPPER($1)`;
                const etabResult = await new_client.query(etabQuery, [row.etablissement]);
                if (etabResult.rows.length > 0) {
                    etablissement_id = etabResult.rows[0].id;
                }
            }

            if (!etablissement_id) {
                console.log(`Etablissement not found for: ${row.prenom} ${row.nom}, skipping emploi creation.`);
                break;
            }
            
            // insert emploi and return id
            const insertQuery = `
                INSERT INTO emplois (personne, date_debut, etablissement, type_emploi) 
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `;
            const insertResult = await new_client.query(insertQuery, [personne_id, lastAffectation.rows[0].date_debut, etablissement_id, 1]);
            const emploi_id = insertResult.rows[0].id;
            console.log(`Inserted emploi for: ${row.prenom} ${row.nom}`);

            // get corps id
            let corp_id = null;
            if (row.corp) {
                console.log(`Looking up corp: ${row.corp}`);
                const corpQuery = `SELECT id FROM corps_biatss WHERE UPPER(corps) = UPPER($1)`;
                const corpResult = await new_client.query(corpQuery, [row.corp]);
                if (corpResult.rows.length > 0) {
                    corp_id = corpResult.rows[0].id;
                }
            }

            // get grade id
            let grade_id = null;
            if (row.grade) {
                console.log(`Looking up grade: ${row.grade}`);
                const gradeQuery = `SELECT id FROM grades WHERE UPPER(grade) = UPPER($1)`;
                const gradeResult = await new_client.query(gradeQuery, [row.grade]);
                if (gradeResult.rows.length > 0) {
                    grade_id = gradeResult.rows[0].id;
                }
            }

            // get bap id by checking if bap is included in row.type_emploi
            let bap_id = null;
            if (row.type_emploi) {
                console.log(`Looking up bap: ${row.type_emploi}`);
                const bapQuery = `SELECT id FROM baps WHERE POSITION(UPPER(bap) IN UPPER($1)) > 0;`;
                const bapResult = await new_client.query(bapQuery, [row.type_emploi]);
                if (bapResult.rows.length > 0) {
                    bap_id = bapResult.rows[0].id;
                }
            }

            if (corp_id && grade_id && bap_id) {
                // insert emplois_biatss
                const emploiBiatssInsertQuery = `
                    INSERT INTO emplois_biatss (corps, grade, emploi, bap)
                    VALUES ($1, $2, $3, $4)
                `;
                await new_client.query(emploiBiatssInsertQuery, [corp_id, grade_id, emploi_id, bap_id]);
                console.log(`Inserted emploi_biatss for: ${row.prenom} ${row.nom}`);
            } else {
                console.log(`Corp or Grade not found for: ${row.prenom} ${row.nom}, skipping emploi_biatss creation.`);
            }

        }
    }
}



async function emplois_postdoc() {
    // For all membres with type_emploi 'postdoc', create an emploi in the new database
    const query = `SELECT m.nom, m.prenom, te.type_emploi, g.grade, c.corp, e.etablissement
        FROM membres m
        JOIN types_emploi te ON m.type_emploi = te.id
        JOIN grades g ON m.grade = g.id
        JOIN corps c ON m.corps = c.id
        JOIN etablissements e ON m.etablissement = e.id
        WHERE c.corp = 'postdoc';`;
    const { rows } = await old_client.query(query);
    for (const row of rows) {
        // get personne id
        const checkQuery = `
            SELECT id FROM personnes
            WHERE UPPER(nom) = UPPER($1) AND UPPER(prenom) = UPPER($2)
        `;
        const existingPerson = await new_client.query(checkQuery, [row.nom, row.prenom]);
        if (existingPerson.rows.length > 0) {
            const personne_id = existingPerson.rows[0].id;

            const lastAffectationQuery = `
                SELECT id, date_debut FROM affectations_laboratoires
                WHERE personne = $1 AND laboratoire = 1
                ORDER BY date_debut DESC
                LIMIT 1
            `;
            const lastAffectation = await new_client.query(lastAffectationQuery, [personne_id]);

            if (lastAffectation.rows.length === 0) {
                console.log(`No affectation_laboratoire found for: ${row.prenom} ${row.nom}, skipping emploi creation.`);
                break;
            }

            // get etablissement id
            let etablissement_id = null;
            if (row.etablissement) {
                console.log(`Looking up etablissement: ${row.etablissement}`);
                const etabQuery = `SELECT id FROM etablissements WHERE UPPER(etablissement) = UPPER($1)`;
                const etabResult = await new_client.query(etabQuery, [row.etablissement]);
                if (etabResult.rows.length > 0) {
                    etablissement_id = etabResult.rows[0].id;
                }
            }

            if (!etablissement_id) {
                console.log(`Etablissement not found for: ${row.prenom} ${row.nom}, skipping emploi creation.`);
                break;
            }
            
            // insert emploi and return id
            const insertQuery = `
                INSERT INTO emplois (personne, date_debut, etablissement, type_emploi) 
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `;
            const insertResult = await new_client.query(insertQuery, [personne_id, lastAffectation.rows[0].date_debut, etablissement_id, 3]);
            const emploi_id = insertResult.rows[0].id;
            console.log(`Inserted emploi for: ${row.prenom} ${row.nom}`);

            // insert emplois_postdoctoraux
            const emploiPostdocInsertQuery = `
                INSERT INTO emplois_postdoctoraux (emploi)
                VALUES ($1)
            `;
            await new_client.query(emploiPostdocInsertQuery, [emploi_id]);
            console.log(`Inserted emploi_postdoctoraux for: ${row.prenom} ${row.nom}`);

        }
    }
}



async function emplois_cdd_cdi() {
    // For all membres with type_emploi 'CDD' or 'CDI', create an emploi in the new database
    const query = `SELECT m.nom, m.prenom, te.type_emploi, g.grade, c.corp, e.etablissement
        FROM membres m
        JOIN types_emploi te ON m.type_emploi = te.id
        JOIN grades g ON m.grade = g.id
        JOIN corps c ON m.corps = c.id
        JOIN etablissements e ON m.etablissement = e.id
        WHERE te.type_emploi IN ('CDI','CDD') AND c.corp != 'postdoc';`;
    const { rows } = await old_client.query(query);
    for (const row of rows) {
        // get personne id
        const checkQuery = `
            SELECT id FROM personnes
            WHERE UPPER(nom) = UPPER($1) AND UPPER(prenom) = UPPER($2)
        `;
        const existingPerson = await new_client.query(checkQuery, [row.nom, row.prenom]);
        if (existingPerson.rows.length > 0) {
            const personne_id = existingPerson.rows[0].id;

            const lastAffectationQuery = `
                SELECT id, date_debut FROM affectations_laboratoires
                WHERE personne = $1 AND laboratoire = 1
                ORDER BY date_debut DESC
                LIMIT 1
            `;
            const lastAffectation = await new_client.query(lastAffectationQuery, [personne_id]);

            if (lastAffectation.rows.length === 0) {
                console.log(`No affectation_laboratoire found for: ${row.prenom} ${row.nom}, skipping emploi creation.`);
                break;
            }

            // get etablissement id
            let etablissement_id = null;
            if (row.etablissement) {
                console.log(`Looking up etablissement: ${row.etablissement}`);
                const etabQuery = `SELECT id FROM etablissements WHERE UPPER(etablissement) = UPPER($1)`;
                const etabResult = await new_client.query(etabQuery, [row.etablissement]);
                if (etabResult.rows.length > 0) {
                    etablissement_id = etabResult.rows[0].id;
                }
            }

            if (!etablissement_id) {
                console.log(`Etablissement not found for: ${row.prenom} ${row.nom}, skipping emploi creation.`);
                break;
            }

            const type_emploi_id = (row.type_emploi === 'CDI') ? 2 : 3; // assuming 2 is CDI and 3 is CDD
            
            // insert emploi and return id
            const insertQuery = `
                INSERT INTO emplois (personne, date_debut, etablissement, type_emploi) 
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `;
            const insertResult = await new_client.query(insertQuery, [personne_id, lastAffectation.rows[0].date_debut, etablissement_id, type_emploi_id]);
            const emploi_id = insertResult.rows[0].id;
            console.log(`Inserted emploi for: ${row.prenom} ${row.nom}`);

            // get corps id
            let corp_id = null;
            if (row.corp) {
                console.log(`Looking up corp: ${row.corp}`);
                const corpQuery = `SELECT id FROM corps_biatss WHERE UPPER(corps) = UPPER($1)`;
                const corpResult = await new_client.query(corpQuery, [row.corp]);
                if (corpResult.rows.length > 0) {
                    corp_id = corpResult.rows[0].id;
                }
            }

            // get grade id
            let grade_id = null;
            if (row.grade) {
                console.log(`Looking up grade: ${row.grade}`);
                const gradeQuery = `SELECT id FROM grades WHERE UPPER(grade) = UPPER($1)`;
                const gradeResult = await new_client.query(gradeQuery, [row.grade]);
                if (gradeResult.rows.length > 0) {
                    grade_id = gradeResult.rows[0].id;
                }
            }

            // get bap id by checking if bap is included in row.type_emploi
            let bap_id = 5;
            

            if (corp_id && grade_id && bap_id) {
                // insert emplois_biatss
                const emploiBiatssInsertQuery = `
                    INSERT INTO emplois_biatss (corps, grade, emploi, bap)
                    VALUES ($1, $2, $3, $4)
                `;
                await new_client.query(emploiBiatssInsertQuery, [corp_id, grade_id, emploi_id, bap_id]);
                console.log(`Inserted emploi_biatss for: ${row.prenom} ${row.nom}`);
            } else {
                console.log(`Corp or Grade not found for: ${row.prenom} ${row.nom}, skipping emploi_biatss creation.`);
            }

        }
    }
}



async function emplois_doctoraux() {
    // For all doctorants
    const query = `SELECT d.nom, d.prenom, d.etablissement_employeur, d.categorie_financement, e.etablissement, cf.categorie
        FROM doctorants d
        JOIN categories_financement_these cf ON d.categorie_financement = cf.id
        JOIN etablissements e ON d.etablissement_employeur = e.id;`;
    const { rows } = await old_client.query(query);
    for (const row of rows) {
        // get personne id
        const checkQuery = `
            SELECT id FROM personnes
            WHERE UPPER(nom) = UPPER($1) AND UPPER(prenom) = UPPER($2)
        `;
        const existingPerson = await new_client.query(checkQuery, [row.nom, row.prenom]);
        if (existingPerson.rows.length > 0) {
            const personne_id = existingPerson.rows[0].id;

            const lastAffectationQuery = `
                SELECT id, date_debut FROM affectations_laboratoires
                WHERE personne = $1 AND laboratoire = 1
                ORDER BY date_debut DESC
                LIMIT 1
            `;
            const lastAffectation = await new_client.query(lastAffectationQuery, [personne_id]);

            if (lastAffectation.rows.length === 0) {
                console.log(`No affectation_laboratoire found for: ${row.prenom} ${row.nom}, skipping emploi creation.`);
                break;
            }

            // get etablissement id
            let etablissement_id = null;
            if (row.etablissement) {
                console.log(`Looking up etablissement: ${row.etablissement}`);
                const etabQuery = `SELECT id FROM etablissements WHERE UPPER(etablissement) = UPPER($1)`;
                const etabResult = await new_client.query(etabQuery, [row.etablissement]);
                if (etabResult.rows.length > 0) {
                    etablissement_id = etabResult.rows[0].id;
                }
            }

            if (!etablissement_id) {
                console.log(`Etablissement not found for: ${row.prenom} ${row.nom}, skipping emploi creation.`);
                break;
            }

            
            // insert emploi and return id
            const insertQuery = `
                INSERT INTO emplois (personne, date_debut, etablissement, type_emploi) 
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `;
            const insertResult = await new_client.query(insertQuery, [personne_id, lastAffectation.rows[0].date_debut, etablissement_id, 3]);
            const emploi_id = insertResult.rows[0].id;
            console.log(`Inserted emploi for: ${row.prenom} ${row.nom}`);


            // get categorie_financement id
            let categorie_financement_id = null;
            if (row.categorie) {
                console.log(`Looking up categorie_financement: ${row.categorie}`);
                const catFinQuery = `SELECT id FROM categories_financements_theses WHERE UPPER(categorie) = UPPER($1)`;
                const catFinResult = await new_client.query(catFinQuery, [row.categorie]);
                if (catFinResult.rows.length > 0) {
                    categorie_financement_id = catFinResult.rows[0].id;
                }
            }

            if (!categorie_financement_id) {
                console.log(`Categorie_financement not found for: ${row.prenom} ${row.nom}, skipping emploi_doctoraux creation.`);
                break;
            }

            // insert emplois_doctoraux

            const emploiDoctorauxInsertQuery = `
                INSERT INTO emplois_doctoraux (emploi, categorie_financement_these)
                VALUES ($1, $2)
            `;
            await new_client.query(emploiDoctorauxInsertQuery, [emploi_id, categorie_financement_id]);
            console.log(`Inserted emploi_doctoraux for: ${row.prenom} ${row.nom}`);

        }
    }
}

async function hdrs() {
    const query = `SELECT m.nom, m.prenom, oh.date_obtention
	FROM obtentions_hdr oh
	JOIN membres m ON m.id = oh.membre;`;
    const { rows } = await old_client.query(query);
    for (const row of rows) {
        // get personne id
        const checkQuery = `
            SELECT id FROM personnes
            WHERE UPPER(nom) = UPPER($1) AND UPPER(prenom) = UPPER($2)
        `;
        const existingPerson = await new_client.query(checkQuery, [row.nom, row.prenom]);
        if (existingPerson.rows.length > 0) {
            const personne_id = existingPerson.rows[0].id;
            
            // insert hdr
            const insertQuery = `
                INSERT INTO hdrs (personne, date_obtention)
                VALUES ($1, $2)
            `;
            await new_client.query(insertQuery, [personne_id, row.date_obtention]);
            console.log(`Inserted HDR for: ${row.prenom} ${row.nom}`);
        }
    }
}

async function emeritats() {
    const query = `SELECT m.nom, m.prenom, e.date_debut, e.date_fin
	FROM membres m
	JOIN emeritats e ON m.id = e.membre;`;

    const { rows } = await old_client.query(query);
    for (const row of rows) {
        // get personne id
        const checkQuery = `
            SELECT id FROM personnes
            WHERE UPPER(nom) = UPPER($1) AND UPPER(prenom) = UPPER($2)
        `;
        const existingPerson = await new_client.query(checkQuery, [row.nom, row.prenom]);
        if (existingPerson.rows.length > 0) {
            const personne_id = existingPerson.rows[0].id;
            
            // insert emeritat
            const insertQuery = `
                INSERT INTO emeritats (personne, de_droit, date_debut, duree_mois)
                VALUES ($1, $2, $3, $4)
            `;
            await new_client.query(insertQuery, [personne_id, false, row.date_debut, calculateDurationInMonths(row.date_debut, row.date_fin)]);
            console.log(`Inserted Emeritat for: ${row.prenom} ${row.nom}`);
        }
    }

    function calculateDurationInMonths(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        let months;
        months = (end.getFullYear() - start.getFullYear()) * 12;
        months -= start.getMonth();
        months += end.getMonth();
        return months <= 0 ? 0 : months;
    }
}



async function migrate() {
    console.log("Starting migration from old database to new database...");
    await membresToPersonnes();
    await migrateDoctorantsToPersonnes();
    await create_etablissements();
    await set_tutelles_to_labri();
    await create_labri_structures();
    await affectation_laboratoire();
    await set_affectations_structures();
    await emplois_enseignants_chercheurs();
    await emplois_chercheurs();
    await emplois_biatss();
    await emplois_postdoc();
    await emplois_cdd_cdi();
    await emplois_doctoraux();
    await hdrs();
    await emeritats();
    console.log("Migration completed.");

}

(async () => {
    try {
        await old_client.connect();
        await new_client.connect();
        await migrate();
        console.log("Migration completed successfully.");
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await old_client.end();
        await new_client.end();
    }
})();