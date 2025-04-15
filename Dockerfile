
# Dockerfile
FROM node:16-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy application files
COPY . .

# Set environment variables
ENV NODE_ENV=production

# Expose the port the app runs on
EXPOSE 3000

CMD ["node", "index.js"]