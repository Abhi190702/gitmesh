# Triage Skill

Automated issue triage and labeling for GitHub repositories.

## Role
`triage`

## Description
The Triage Skill enables agents to systematically categorize and prioritize GitHub issues. This includes analyzing issue descriptions, suggesting priority levels, and auto-assigning issues to appropriate project areas based on content classification.

## Capabilities
- Analyze issue descriptions and metadata
- Suggest priority levels (critical, high, medium, low)
- Auto-assign to appropriate projects
- Flag security-related issues for review
- Generate triage reports
- Manage issue labels and milestones

## Related Playbooks
Implementation details: [gitmesh/playbooks/triage](../playbooks/triage)

## Configuration
Enabled by default when creating a Triage Agent via `gitmesh-agents setup`.

## Related Agents
- Triage Agent (primary)
