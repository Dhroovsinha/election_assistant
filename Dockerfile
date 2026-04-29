# ── Stage: serve ─────────────────────────────────────────────
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config (listens on port 8080 for Cloud Run)
COPY nginx.conf /etc/nginx/nginx.conf

# Copy static app files
COPY index.html       /usr/share/nginx/html/index.html
COPY css/             /usr/share/nginx/html/css/
COPY js/              /usr/share/nginx/html/js/

# Expose Cloud Run port
EXPOSE 8080

# Start nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
