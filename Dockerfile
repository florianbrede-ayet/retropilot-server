FROM node:16-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm ci
RUN npm install pm2 -g

# Bundle app source
COPY . .

EXPOSE 3000
CMD ["pm2-runtime", "ecosystem.config.js"]