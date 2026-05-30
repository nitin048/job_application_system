# Stage 1: Build the React frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Final runtime environment
FROM python:3.11-slim-bookworm

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /app

# Copy the entire application
COPY . .

# Overwrite static folder with the compiled assets from Stage 1
COPY --from=frontend-builder /app/static ./static

# Install pip and package dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -e .

# Install Playwright browser and its OS dependencies
RUN playwright install --with-deps chromium

# Expose FastAPI default port
EXPOSE 8000

# Set environment variables for production
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

# Command to run the application
CMD ["python", "-m", "uvicorn", "src.server:app", "--host", "0.0.0.0", "--port", "8000"]
