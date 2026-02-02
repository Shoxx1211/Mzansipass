FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install netcat (needed for docker-compose healthchecks)
RUN apt-get update && \
    apt-get install -y netcat-openbsd && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements first and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY . .

# Environment variables
ENV FLASK_APP=app.py
ENV FLASK_ENV=production

# Expose Flask/Gunicorn port
EXPOSE 5000

# Start the app using Gunicorn pointing to wsgi.py
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "wsgi:app"]
