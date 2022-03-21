FROM node:16-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm ci

# Bundle app source
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "server"]
