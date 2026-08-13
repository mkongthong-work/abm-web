# Backend: Node.js API + Python/WeasyPrint (สำหรับสร้าง PDF ภาษาไทย)
FROM node:22-bookworm-slim

# ไลบรารีระบบที่ WeasyPrint ต้องใช้ (render font/CSS/PDF)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
    libpango-1.0-0 libpangocairo-1.0-0 libcairo2 libgdk-pixbuf2.0-0 \
    libffi8 shared-mime-info fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages --no-cache-dir weasyprint

WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
