# DEVA — web üretim imajı (Expo static export + nginx)
#
# Build:
#   docker build -t deva:1.0.0 .
#   docker build -t deva:1.0.0 --build-arg EXPO_PUBLIC_SUPABASE_URL=https://<proj>.supabase.co .
#
# Hiçbir EXPO_PUBLIC_* verilmezse imaj local-first modda çalışır:
# veri cihazda (tarayıcı) tutulur, istemci hiçbir sunucuya bağlanmaz.
# Anahtarlar yalnızca build-time gömülür; imajda sır gizlenmez.

# ---------- build ----------
FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/mobile/package.json apps/mobile/
COPY packages/db/package.json packages/db/
RUN npm ci --no-audit --no-fund

COPY . .

ARG EXPO_PUBLIC_SUPABASE_URL=
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY=
ARG EXPO_PUBLIC_PHONE_AUTH_ENABLED=false
ARG EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL \
    EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY \
    EXPO_PUBLIC_PHONE_AUTH_ENABLED=$EXPO_PUBLIC_PHONE_AUTH_ENABLED \
    EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=$EXPO_PUBLIC_GOOGLE_MAPS_API_KEY \
    EXPO_PUBLIC_USE_RN_FETCH=true

RUN npm run typecheck \
    && cd apps/mobile && npx expo export --platform web

# ---------- runtime ----------
FROM nginx:1.27-alpine AS runtime

COPY docker/nginx-global.conf /etc/nginx/nginx.conf
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/mobile/dist /usr/share/nginx/html

RUN addgroup -S deva && adduser -S deva -G deva \
    && chown -R deva:deva /usr/share/nginx/html /var/cache/nginx /var/log/nginx /var/run

USER deva
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
