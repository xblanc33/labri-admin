# Run

## Build (dans le répertoire src)

    sudo docker build . -t labri-effectif

## Run

    //docker run --name le1 -e POSTGRES_PASSWORD=mysecretpassword -p8080:8080 labri-effectif 

    sudo docker run --name le1 -e POSTGRES_PASSWORD=mysecretpassword -p80:8080 labri-effectif 


## Only postgres

    docker run -it --rm -v .:/tmp --network psnet postgres psql -h some-postgres -U postgres


# docker


sudo docker build --tag 'psnode' .

sudo docker run -p80:8080 -e POSTGRES_PASSWORD=mysecretpassword 'psnode'


# psql

Sur le container docker

    sudo docker exec -it le1 /bin/sh


Puis

    psql -U postgres


Dans un autre container docker

    docker run -it --rm -v .:/tmp --network psnet postgres psql -h some-postgres -U postgres


    docker run -it --rm -v .:/tmp --network psnet postgres sh



# LOAD with dump


docker run -it --rm -v .:/tmp --network psnet postgres psql -h some-postgres -U postgres



\i /tmp/src/db-a ***


exit


docker run -it --rm -v .:/tmp --network psnet postgres sh


psql -v -U postgres -d labri -h some-postgres -a -f /tmp/dump/2025...


## Local development (API + frontend)

1. Copier le fichier d'exemple et ajuster les identifiants PostgreSQL :

       cp .env.example .env
       # éditer .env pour mettre le bon DATABASE_URL / PORT

2. Installer les dépendances Node :

       npm install

3. Lancer l'API Express :

       npm run dev:server

4. Dans un autre terminal, lancer le frontend Vue :

       npm run dev:frontend

5. Ouvrir le navigateur sur l'URL indiquée par Vite (par défaut http://localhost:5173).
