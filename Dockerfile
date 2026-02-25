FROM node:20-bookworm-slim

WORKDIR /app

# Install Playwright system dependencies manually.
# 'libasound2' was renamed to 'libasound2t64' on Debian 12 (Bookworm).
# We also include all other Chromium runtime dependencies here.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libasound2t64 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm install --no-fund --no-audit

# Install Playwright browser (no --with-deps since we handled deps above)
RUN npx playwright install chromium

# Copy source code
COPY . .

# Build Next.js app
RUN npm run build

# Expose port
EXPOSE 3000

# Start command
CMD ["npm", "start"]
