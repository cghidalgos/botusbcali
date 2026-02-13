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

EXPOSE 3000
CMD ["npm", "start"]
