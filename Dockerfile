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

# Dependencias del backend (capa cacheada mientras no cambien package*.json).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Dependencias del admin-ui. Se instalan ANTES de copiar el código para que
# Docker cachee esta capa: mientras no cambien admin-ui/package*.json, los
# cambios en src/ NO disparan una reinstalación (build de ~8 min → <1 min).
# NODE_ENV=development en línea para que npm ci instale las devDependencies
# (vite, etc.) sin afectar el resto de la imagen, que queda en production.
COPY admin-ui/package.json admin-ui/package-lock.json ./admin-ui/
RUN cd admin-ui && NODE_ENV=development npm ci

# Ahora sí, copiar el resto del código.
COPY . .

# Build del admin-ui (Vite). Usa las devDependencies ya instaladas arriba.
RUN cd admin-ui && npm run build

EXPOSE 3000
CMD ["node", "src/server.js"]
