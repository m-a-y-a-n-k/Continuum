FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Create cache directory
RUN mkdir -p cache-data

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "src/server.js"]
