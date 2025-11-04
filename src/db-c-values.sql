\c labri_admin;

INSERT INTO sexes (id, sexe) VALUES
  (1, 'femme'),
  (2, 'homme'),
  (3, 'autre')
ON CONFLICT (id) DO NOTHING;

INSERT INTO nationalites (id, nationalite) VALUES
  (1, 'française'),
  (2, 'américaine'),
  (3, 'allemande'),
  (4, 'italienne'),
  (5, 'espagnole'),
  (6, 'chinoise'),
  (7, 'japonaise'),
  (8, 'russe'),
  (9, 'canadienne'),
  (10, 'brésilienne'),
  (11, 'indienne'),
  (12, 'mexicaine'),
  (13, 'argentine'),
  (14, 'australienne'),
  (15, 'sud-africaine'),
  (16, 'nigériane'),
  (17, 'égyptienne'),
  (18, 'marocaine'),
  (19, 'algérienne'),
  (20, 'tunisienne'),
  (21, 'libyenne'),
  (22, 'soudanaise'),
  (23, 'éthiopienne'),
  (24, 'kenyane'),
  (25, 'ougandaise'),
  (26, 'rwandaise'),
  (27, 'tanzanienne'),
  (28, 'gabonaise'),
  (29, 'congolaise'),
  (30, 'angolaise'),
  (31, 'mozambicaine'),
  (32, 'cap-verdienne'),
  (33, 'sénégalaise'),
  (34, 'malienne'),
  (35, 'burkinabée'),
  (36, 'nigérienne'),
  (37, 'tchadienne'),
  (38, 'centrafricaine'),
  (39, 'camerounaise'),
  (40, 'gabonaise'),
  (41, 'équato-guinéenne'),
  (42, 'gabonaise'),
  (43, 'malgache'),
  (44, 'togolaise'),
  (45, 'roumaine'),
  (46, 'hongroise'),
  (47, 'slovaque'),
  (48, 'albanaise'),
  (49, 'belge'),
  (50, 'taïwanaise'),
  (51, 'turque'),
  (52, 'tchèque'),
  (53, 'vietnamienne'),
  (54, 'équatorienne'),
  (55, 'kazakhe'),
  (56, 'luxembourgeoise'),
  (57, 'ukrainienne'),
  (58, 'anglaise')
ON CONFLICT (id) DO NOTHING;

INSERT INTO types_emplois (id, type_emploi) VALUES
  (1, 'Fonctionnaire'),
  (2, 'CDI'),
  (3, 'CDD')
ON CONFLICT (id) DO NOTHING;

INSERT INTO grades (id, grade) VALUES
  (1, 'classe normale'),
  (2, 'hors classe'),
  (3, 'classe exceptionnelle'),
  (4, '1ère classe'),
  (5, '2ème classe')
ON CONFLICT (id) DO NOTHING;

INSERT INTO corps_chercheurs (id, corps) VALUES
  (1, 'chargé de recherche'),
  (2, 'directeur de recherche'),
  (3, 'Inria Starting Faculty Position')
ON CONFLICT (id) DO NOTHING;

INSERT INTO corps_enseignants_chercheurs (id, corps) VALUES
  (1, 'maître de conférences'),
  (2, 'professeur'),
  (6, 'professeur agrégé'),
  (7, 'Chaire de Professeur Junior')
ON CONFLICT (id) DO NOTHING;

INSERT INTO corps_biatss (id, corps) VALUES
  (1, 'AJT'),
  (2, 'TCH'),
  (3, 'AI'),
  (4, 'IE'),
  (5, 'IR')
ON CONFLICT (id) DO NOTHING;

INSERT INTO baps (id, bap) VALUES
  (1, 'BAP A'),
  (2, 'BAP B'),
  (3, 'BAP C'),
  (4, 'BAP D'),
  (5, 'BAP E'),
  (6, 'BAP F'),
  (7, 'BAP G'),
  (8, 'BAP H'),
  (9, 'BAP J')
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories_financements_theses (id, categorie, description) VALUES
  (1, 'CD', 'Financement d''état'),
  (2, 'CDCOL', 'Collectivités territoriales (dont financement régionaux)'),
  (3, 'CDAGE', 'Agences françaises de financements publics de la recherche'),
  (4, 'CIFRE', 'Convention CIFRE'),
  (5, 'CDORG', 'Financements privés d''organisations implantées en France'),
  (6, 'CDUE', 'Financements de la commission européenne'),
  (7, 'CDETR', 'Financements étrangers'),
  (8, 'CDFC', 'Financements des organismes de formation continue'),
  (9, 'CDINT', 'Organismes internationaux'),
  (10, 'AUT', 'Autres')
ON CONFLICT (id) DO NOTHING;

INSERT INTO laboratoires (id, nom, acronyme, numero, date_creation) VALUES
  (1, 'Laboratoire Bordelais de Recherche en Informatique', 'LaBRI', 5800, '1987-01-01')
ON CONFLICT (id) DO NOTHING;



INSERT INTO ecoles_doctorales (id, ecole_doctorale, numero) VALUES
  (1, 'EDMI', 39),
  (2, 'autre', 0)
ON CONFLICT (id) DO NOTHING;