# syntax=docker/dockerfile:1.7

# ---------- builder ----------
FROM oven/bun:1.3.13-alpine AS build
WORKDIR /repo

# 1) Copy the workspace. Bun's frozen workspace install validates all packages
#    in bun.lock; .dockerignore keeps local installs and build output out.
COPY . .

# 2) Install the locked workspace.
RUN bun install --frozen-lockfile

# 3) Build-time env. Required vars fail the build if absent (src/env.ts).
ARG TALLY_FORM_ID
ARG GITHUB_URL
ARG DOCS_URL
ARG PLATFORM_URL
ARG DEMO_URL=""
ARG PLAUSIBLE_DOMAIN=""
ENV TALLY_FORM_ID=$TALLY_FORM_ID \
    GITHUB_URL=$GITHUB_URL \
    DOCS_URL=$DOCS_URL \
    PLATFORM_URL=$PLATFORM_URL \
    DEMO_URL=$DEMO_URL \
    PLAUSIBLE_DOMAIN=$PLAUSIBLE_DOMAIN

RUN bun run -F @rntme/landing build

# Sanity check: dist/ must contain index.html. If not, fail the build here
# rather than ship an empty nginx image.
RUN test -f /repo/apps/landing/dist/index.html || (echo "dist/index.html missing after astro build" && exit 1)

# ---------- runtime ----------
FROM nginx:alpine AS runtime
COPY --from=build /repo/apps/landing/dist /usr/share/nginx/html
COPY apps/landing/nginx.conf /etc/nginx/conf.d/default.conf

# Validate the nginx config at build time so a bad conf fails the image
# instead of the container silently not binding.
RUN nginx -t

EXPOSE 80
