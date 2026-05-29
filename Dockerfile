FROM python:3.11-slim-bookworm

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install pip and package dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -e .

# Copy the rest of the application
COPY . .

# Install Playwright browser and its OS dependencies
RUN playwright install --with-deps chromium

# Expose FastAPI default port
EXPOSE 8000

# Set environment variables for production
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

# Command to run the application
CMD ["python", "-m", "uvicorn", "src.server:app", "--host", "0.0.0.0", "--port", "8000"]
