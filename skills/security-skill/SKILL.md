# Security Skill

Security scanning and vulnerability detection.

## Role
`security`

## Description
The Security Skill enables agents to continuously monitor for security vulnerabilities, CVEs, and policy violations. All security-related actions require explicit human approval before execution.

## Capabilities
- CVE and vulnerability scanning
- Dependency auditing
- Secret detection in code
- Security policy validation
- Risk assessment and reporting
- Security advisory publication (human-gated)
- Patch recommendations
- Compliance checking

## Related Playbooks
Implementation details: [gitmesh/playbooks/security](../playbooks/security)

## Configuration
Enabled by default when creating a Security Agent via `gitmesh-agents setup`. All actions require explicit human approval.

## Related Agents
- Security Agent (primary)

## IMPORTANT
All security-related actions (publishing advisories, modifying security policies, etc.) require explicit human approval before execution.
