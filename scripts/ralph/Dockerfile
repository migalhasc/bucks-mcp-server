FROM node:lts-slim

# Install system deps + GitHub CLI
RUN apt-get update && apt-get install -y \
      git curl jq bash ca-certificates \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
         | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
         | tee /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm + Claude Code CLI
RUN npm install -g pnpm @anthropic-ai/claude-code

WORKDIR /workspace

ENTRYPOINT ["/bin/bash"]
