FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
RUN addgroup -g 1001 appgroup && \
    adduser -D -u 1001 -G appgroup appuser
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN chown -R appuser:appgroup /usr/share/nginx/html && \
    chown -R appuser:appgroup /var/cache/nginx && \
    chown -R appuser:appgroup /var/log/nginx && \
    touch /run/nginx.pid && chown appuser:appgroup /run/nginx.pid
USER appuser
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
