# Imagen de desarrollo del backend (hot-reload con tsx).
FROM node:20-alpine

WORKDIR /app

# Instala dependencias primero para aprovechar la caché de capas.
COPY package.json ./
RUN npm install

# El código se monta como volumen en docker-compose; esto sirve de respaldo.
COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev"]
