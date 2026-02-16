FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
		&& apt-get install -y --no-install-recommends \
			poppler-utils \
			tesseract-ocr \
			tesseract-ocr-eng \
			tesseract-ocr-spa \
		&& rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Build admin-ui before starting the server
# Temporarily set NODE_ENV to development to install devDependencies (vite, etc.)
WORKDIR /app/admin-ui
ENV NODE_ENV=development
RUN npm ci
RUN npm run build

# Return to app root and reset NODE_ENV to production
WORKDIR /app
ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "src/server.js"]
