# Security Policy

## Project status and supported versions

Auto-Trading-Agent is under active development. No stable, versioned software release has been published or designated as supported.

| Version or branch | Security support |
| --- | --- |
| `main` | Active development; security reports are reviewed and fixes may be made here |
| Tagged releases | No supported release currently published |

Do not treat a successful build, prototype, or documentation status as security certification. The repository does not authorize mainnet trading or production wallet use.

## Reporting a vulnerability

Please report suspected vulnerabilities privately. Do not post exploit details, credentials, private keys, seed phrases, API tokens, or weaponized proof-of-concept material in public issues, pull requests, or discussions.

**Preferred route:** use GitHub's **Security and quality → Advisories → Report a vulnerability** workflow when private vulnerability reporting is enabled for this repository.

If the **Report a vulnerability** option is not available yet, open a public issue only to request a private reporting channel. Do not include technical details or evidence of the suspected vulnerability in that issue.

When the private reporting channel is available, include as much of the following as is safe:
- A concise description of the suspected vulnerability and its potential impact.
- The affected file, component, commit, or configuration.
- Reproduction steps and prerequisites.
- A minimal proof of concept, with all credentials and sensitive data removed.
- Any suggested mitigation, if known.

## Response and disclosure

This is an early-stage project and does not currently publish a formal response-time SLA. Maintainers will review reports as promptly as practical and provide updates when there is meaningful progress.

Please allow time for triage and remediation before public disclosure. Coordinate any disclosure timing with the maintainers. A report may be declined if it is out of scope, cannot be reproduced, is a duplicate, or does not describe a security vulnerability; where practical, the reporter will be given an explanation.

## Scope

Report security defects in this repository's source code, build and CI workflows, configuration, dependency handling, and documented project implementation.

Issues belonging to an upstream dependency, RPC provider, exchange, wallet, or other third-party service should also be reported to that provider through its own security process.

Please do not access, modify, or disrupt other users' data or systems while investigating a suspected issue. Use test environments and non-production credentials only.
