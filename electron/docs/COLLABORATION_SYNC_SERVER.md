# Collaboration Sync Server

This repo now includes a reference self-host collaboration sync server for Git Graph.

## Start

Run:

```bash
pnpm run collaboration:server
```

Default endpoint:

```text
http://127.0.0.1:4310
```

Default storage path:

```text
~/.git-graph-collaboration-sync
```

## Configure

Supported flags:

```bash
pnpm run collaboration:server -- --host 0.0.0.0 --port 4310 --storage ./tmp/git-graph-collab --token my-secret
```

Environment variables are also supported:

- `GIT_GRAPH_COLLAB_HOST`
- `GIT_GRAPH_COLLAB_PORT`
- `GIT_GRAPH_COLLAB_STORAGE`
- `GIT_GRAPH_COLLAB_TOKEN`

## App Setup

Open the app `Collaboration Center` -> `Sync` and set:

1. `Endpoint URL`: `http://127.0.0.1:4310`
2. `Project ID`: a stable shared project key
3. `Bearer token`: optional, if the server was started with `--token`

Then use:

- `Test Endpoint` to verify health
- `Push` to publish local collaboration state
- `Pull` to fetch remote state
- `Roundtrip` to merge local and remote state

## Protocol

### `GET /` or `GET /health`

Returns server health and storage metadata.

### `POST /`

Request body:

```json
{
  "projectId": "desktop-app",
  "direction": "roundtrip",
  "bundle": {
    "version": 1,
    "exportedAt": 0,
    "workspaceShares": [],
    "patchShelf": []
  }
}
```

Responses:

- `push`: `{ "ok": true }`
- `pull`: `{ "bundle": { ... } }`
- `roundtrip`: `{ "bundle": { ...merged } }`

## Current limits

This reference server is intentionally simple:

- JSON-file backed
- no user accounts or presence
- no comments or real-time updates
- bearer-token only auth

It is meant to make the app’s collaboration sync actually deployable while keeping the server easy to read and adapt.
