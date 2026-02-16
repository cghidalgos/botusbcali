FROM node:20-slim

# Instalar Tesseract OCR para extraer texto de PDFs escaneados
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libtesseract-dev \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Build admin UI (Vite) and publish to public/admin
RUN NODE_ENV=development npm --prefix admin-ui install --include=dev \
	&& npm --prefix admin-ui run build \
	&& rm -rf public/* \
	&& cp -r admin-ui/dist/* public/ \
	&& rm -rf admin-ui/node_modules

EXPOSE 3000
CMD ["npm", "start"]
