# Claude Code Dual-Mode Setup (Official + MiniMax/Other APIs)

This lets you keep normal Claude Code behavior and also run a provider-routed mode through a local Anthropic-compatible proxy.

## What you get

- Official mode: direct Claude Code behavior (no proxy)
- Proxy mode: route requests to providers like MiniMax, while still using Claude Code CLI

## Files added

- `scripts/claude-anthropic-proxy.mjs`
- `scripts/claude-mode-official.sh`
- `scripts/claude-mode-proxy.sh`

## 1) Start proxy

From repo root:

```sh
CLAUDE_PROXY_PORT=8765 \
MINIMAX_API_KEY="<your-minimax-key>" \
MINIMAX_BASE_URL="https://api.minimax.io/anthropic" \
CLAUDE_PROXY_DEFAULT_PROVIDER="minimax" \
CLAUDE_PROXY_MODEL_MAP='{"MiniMax-M2.7":"minimax/MiniMax-M2.7","MiniMax-M2.5-highspeed":"minimax/MiniMax-M2.5-highspeed"}' \
node scripts/claude-anthropic-proxy.mjs
```

Health check:

```sh
curl -s http://127.0.0.1:8765/health
```

## 2) Use official mode (original Claude)

```sh
./scripts/claude-mode-official.sh
```

Or with command:

```sh
./scripts/claude-mode-official.sh --print "Say hello"
```

## 3) Use proxy mode (MiniMax or other provider)

```sh
./scripts/claude-mode-proxy.sh
```

Or with command:

```sh
./scripts/claude-mode-proxy.sh --print "Say hello" --output-format stream-json
```

## 4) Integrate with GitMesh

For a GitMesh agent using Claude adapter:

- Adapter type: `claude_local`
- Command: `claude`
- In adapter `env`, set:
  - `ANTHROPIC_BASE_URL=http://127.0.0.1:8765`

Then GitMesh uses proxy mode for that agent while your normal shell can still use official mode.

## Provider routing rules

The proxy picks provider by:

1. `model` prefix like `minimax/<model>` or `anthropic/<model>`
2. `x-provider` request header (if present)
3. `CLAUDE_PROXY_DEFAULT_PROVIDER`

If mapped model contains a provider prefix, the prefix is removed before sending upstream.

## Security notes

- Never commit provider keys to git.
- Prefer env vars at runtime.
- Rotate keys if they were exposed.

## Limitations

This proxy forwards Anthropic-style endpoints. Some provider-specific features may still differ from native Anthropic behavior.
