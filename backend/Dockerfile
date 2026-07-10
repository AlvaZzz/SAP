# API NestJS — imagen de desarrollo (hot-reload).
FROM node:20-alpine

WORKDIR /app

# Dependencias primero (cache de capas).
COPY package.json ./
RUN npm install

COPY . .
# Genera el cliente Prisma dentro de la imagen.
RUN npx prisma generate

EXPOSE 4000
CMD ["sh", "./docker-entrypoint.sh"]
