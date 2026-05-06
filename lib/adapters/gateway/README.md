# @gitmesh/adapter-gateway

Gateway WebSocket adapter for GitMesh Agents.

Connects to a remote gateway service over the WebSocket protocol, supporting
device-auth, session routing, and bidirectional event streaming.

## Usage

This adapter is registered internally by the GitMesh Agents server and CLI.
It is not intended for standalone use.

## Configuration

See the `agentConfigurationDoc` export in `src/index.ts` for the full list of
adapter configuration fields.
