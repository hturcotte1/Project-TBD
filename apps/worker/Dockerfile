# apps/worker — BullMQ workers, scheduler, browser jobs. Uses the Playwright base image so a
# local Chromium is available even when BROWSER_PROVIDER=browserbase (used for the mock site in staging).
FROM mcr.microsoft.com/playwright:v1.62.1-noble AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker
RUN pnpm install --frozen-lockfile --filter @tbd/worker...
RUN pnpm --filter @tbd/worker build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/apps/worker/dist ./dist
COPY --from=build /app/apps/worker/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build /app/packages/shared/drizzle ./drizzle
CMD ["node", "dist/index.js"]
