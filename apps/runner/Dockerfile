FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
COPY src ./src
RUN useradd --create-home --uid 10001 runner && mkdir -p /tmp/task-hub-runs && chown -R runner:runner /app /tmp/task-hub-runs
USER runner
ENV RUNNER_WORK_ROOT=/tmp/task-hub-runs
CMD ["node", "src/index.mjs"]
