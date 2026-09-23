FROM node:22-bookworm-slim

WORKDIR /app

COPY map-app/package.json map-app/package-lock.json ./
RUN npm ci

COPY map-app ./

ENV NODE_ENV=production

RUN DIRECT_DATABASE_URL=postgresql://user:password@localhost:5432/distributor_map npm run generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
