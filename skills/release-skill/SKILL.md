# Release Skill

Release management and automation.

## Role
`release`

## Description
The Release Skill enables agents to automate software release workflows. This includes version bumping, changelog generation, release notes creation, and coordinating with CI/CD pipelines for publication.

## Capabilities
- Version bumping (major, minor, patch)
- Changelog generation and management
- Release notes creation
- Git tag management
- Publish to package registries
- Release announcement preparation
- Rollback management
- Release metrics and reporting

## Related Playbooks
Implementation details: [gitmesh/playbooks/release-agent](../playbooks/release-agent)

## Configuration
Enabled by default when creating a Release Agent via `gitmesh-agents setup`.

## Related Agents
- Release Agent (primary)
