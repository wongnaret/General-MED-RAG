FROM node:20-alpine

WORKDIR /app

# Copy package descriptors
COPY package*.json /app/

# Install dependencies (frozen/clean lockfile if available, otherwise standard install)
RUN npm install

# Copy application files
COPY . /app/

EXPOSE 3000

CMD ["npm", "run", "dev"]
