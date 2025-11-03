\c postgres;

DROP DATABASE IF EXISTS labri_admin;
CREATE DATABASE labri_admin WITH ENCODING = UTF8;

\c labri_admin;

CREATE TABLE sexes (
  id SERIAL PRIMARY KEY,
  sexe VARCHAR(20) NOT NULL
);

CREATE TABLE nationalites (
    id SERIAL PRIMARY KEY,
    nationalite VARCHAR(40) NOT NULL
);

CREATE TABLE personnes (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(40) NOT NULL,
    prenom VARCHAR(40) NOT NULL,
    sexe INTEGER NOT NULL REFERENCES sexes(id),
    nationalite INTEGER REFERENCES nationalites(id),
    date_naissance DATE NOT NULL
);

CREATE TABLE laboratoires (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    acronyme VARCHAR(20) NOT NULL,
    numero INTEGER NOT NULL,
    date_creation DATE
);

CREATE TABLE etablissements (
  id SERIAL PRIMARY KEY,
  etablissement VARCHAR(100) NOT NULL
);

CREATE TABLE structures_laboratoires_kind (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(40) NOT NULL
);

CREATE TABLE tutelles_laboratoires (
    id SERIAL PRIMARY KEY,
    laboratoire INTEGER NOT NULL REFERENCES laboratoires(id),
    etablissement INTEGER NOT NULL REFERENCES etablissements(id)
);

CREATE TABLE structures_laboratoires (
    id SERIAL PRIMARY KEY,
    laboratoire INTEGER NOT NULL REFERENCES laboratoires(id),
    nom VARCHAR(100) NOT NULL,
    acronyme VARCHAR(60) NOT NULL,
    kind INTEGER NOT NULL REFERENCES structures_laboratoires_kind(id),
    structure_parent INTEGER REFERENCES structures_laboratoires(id),
    date_creation DATE NOT NULL
);

CREATE TABLE suppressions_structures_laboratoires (
    id SERIAL PRIMARY KEY,
    structure_laboratoire INTEGER NOT NULL REFERENCES structures_laboratoires(id),
    date_suppression DATE NOT NULL
);

CREATE TABLE affectations_laboratoires (
    id SERIAL PRIMARY KEY,
    personne INTEGER NOT NULL REFERENCES personnes(id),
    laboratoire INTEGER NOT NULL REFERENCES laboratoires(id),
    date_debut DATE NOT NULL
);

CREATE TABLE affectations_structures_laboratoires (
    id SERIAL PRIMARY KEY,
    personne INTEGER NOT NULL REFERENCES personnes(id),
    structure_laboratoire INTEGER NOT NULL REFERENCES structures_laboratoires(id),
    date_debut DATE NOT NULL
);

CREATE TABLE fin_affectations_laboratoires (
    id SERIAL PRIMARY KEY,
    affectation_laboratoire INTEGER NOT NULL REFERENCES affectations_laboratoires(id),
    date_fin DATE NOT NULL
);

CREATE TABLE fin_affectations_structures_laboratoires (
    id SERIAL PRIMARY KEY,
    affectation_structure_laboratoire INTEGER NOT NULL REFERENCES affectations_structures_laboratoires(id),
    date_fin DATE NOT NULL
);

CREATE TABLE emplois (
    id SERIAL PRIMARY KEY,
    date_debut DATE NOT NULL,
    personne INTEGER NOT NULL REFERENCES personnes(id),
    etablissement INTEGER NOT NULL REFERENCES etablissements(id)
);

CREATE TABLE fin_emplois (
    id SERIAL PRIMARY KEY,
    emploi INTEGER NOT NULL REFERENCES emplois(id),
    date_fin DATE NOT NULL
);

CREATE TABLE corps_enseignants_chercheurs (
  id SERIAL PRIMARY KEY,
  corps VARCHAR(40) NOT NULL
);

CREATE TABLE corps_chercheurs (
  id SERIAL PRIMARY KEY,
  corps VARCHAR(40) NOT NULL
);

CREATE TABLE corps_biatss (
  id SERIAL PRIMARY KEY,
  corps VARCHAR(40) NOT NULL
);

CREATE TABLE grades (
  id SERIAL PRIMARY KEY,
  grade VARCHAR(40) NOT NULL
);

CREATE TABLE baps (
  id SERIAL PRIMARY KEY,
  bap VARCHAR(40) NOT NULL
);

CREATE TABLE emplois_enseignants_chercheurs (
    id SERIAL PRIMARY KEY,
    corps INTEGER NOT NULL REFERENCES corps_enseignants_chercheurs(id),
    grade INTEGER NOT NULL REFERENCES grades(id),
    emploi INTEGER NOT NULL REFERENCES emplois(id)
);

CREATE TABLE emplois_chercheurs (
    id SERIAL PRIMARY KEY,
    corps INTEGER NOT NULL REFERENCES corps_chercheurs(id),
    grade INTEGER NOT NULL REFERENCES grades(id),
    emploi INTEGER NOT NULL REFERENCES emplois(id)
);

CREATE TABLE emplois_biatss (
    id SERIAL PRIMARY KEY,
    corps INTEGER NOT NULL REFERENCES corps_biatss(id),
    grade INTEGER NOT NULL REFERENCES grades(id),
    bap INTEGER NOT NULL REFERENCES baps(id),
    emploi INTEGER NOT NULL REFERENCES emplois(id)
);

CREATE TABLE categories_financements_theses (
    id SERIAL PRIMARY KEY,
    categorie VARCHAR(40) NOT NULL,
    description VARCHAR(100)
);

CREATE TABLE ecoles_doctorales (
    id SERIAL PRIMARY KEY,
    ecole_doctorale VARCHAR(40) NOT NULL,
    numero INTEGER NOT NULL
);

CREATE TABLE emplois_doctoraux (
    id SERIAL PRIMARY KEY,
    emploi INTEGER NOT NULL REFERENCES emplois(id),
    ecole_doctorale INTEGER NOT NULL REFERENCES ecoles_doctorales(id),
    categorie_financement_these INTEGER REFERENCES categories_financements_theses(id),
    etablissement_master INTEGER REFERENCES etablissements(id)
);

CREATE TABLE emplois_postdoctoraux (
    id SERIAL PRIMARY KEY,
    emploi INTEGER NOT NULL REFERENCES emplois(id),
    organisme_financeur VARCHAR(100)
);

CREATE TABLE emplois_cdd (
    id SERIAL PRIMARY KEY,
    emploi INTEGER NOT NULL REFERENCES emplois(id),
    duree_mois INTEGER NOT NULL
);

CREATE TABLE emplois_cdi (
    id SERIAL PRIMARY KEY,
    emploi INTEGER NOT NULL REFERENCES emplois(id)
);

CREATE TABLE emplois_stage (
    id SERIAL PRIMARY KEY,
    emploi INTEGER NOT NULL REFERENCES emplois(id),
    duree_mois INTEGER NOT NULL
);

CREATE TABLE emplois_autres (
    id SERIAL PRIMARY KEY,
    emploi INTEGER NOT NULL REFERENCES emplois(id),
    description VARCHAR(100) NOT NULL
);


CREATE TABLE emeritats (
    id SERIAL PRIMARY KEY,
    de_droit BOOLEAN NOT NULL,
    date_debut DATE NOT NULL,
    duree_mois INTEGER,
    personne INTEGER NOT NULL REFERENCES personnes(id)
);

CREATE TABLE fin_emeritats (
    id SERIAL PRIMARY KEY,
    emeritat INTEGER NOT NULL REFERENCES emeritats(id),
    date_fin DATE NOT NULL
);

CREATE TABLE hdr (
    id SERIAL PRIMARY KEY,
    date_obtention DATE NOT NULL,
    personne INTEGER NOT NULL REFERENCES personnes(id)
);


CREATE TABLE theses (
    id SERIAL PRIMARY KEY,
    titre VARCHAR(200) NOT NULL,
    debut DATE NOT NULL,
    ecole_doctorale INTEGER NOT NULL REFERENCES ecoles_doctorales(id),
    personne INTEGER NOT NULL REFERENCES personnes(id)
);

CREATE TABLE soutenances (
    id SERIAL PRIMARY KEY,
    these INTEGER NOT NULL REFERENCES theses(id),
    date_soutenance DATE NOT NULL,
    jury VARCHAR(200) NOT NULL,
    lieu VARCHAR(100),
    rapporteur_externe VARCHAR(100),
    rapporteur_interne VARCHAR(100),
    president VARCHAR(100)
);


CREATE TABLE encadrements_these (
    id SERIAL PRIMARY KEY,
    encadrement INTEGER NOT NULL REFERENCES personnes(id),
    these INTEGER NOT NULL REFERENCES theses(id),
    taux_encadrement INTEGER,
    direction BOOLEAN NOT NULL
);

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    role VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE kinds (
    id SERIAL PRIMARY KEY,
    kind VARCHAR(20) NOT NULL UNIQUE
);

CREATE TABLE account (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    salt BYTEA,
    hash BYTEA,
    role INTEGER NOT NULL REFERENCES roles(id),
    labri_id INTEGER,
    kind INTEGER REFERENCES kinds(id),
    initialized BOOLEAN DEFAULT FALSE
);
