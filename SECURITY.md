# Security policy

## Reporting a vulnerability

Use GitHub's private security advisory flow for vulnerabilities. Do not open a public issue containing an exploit, API key, private prompt, or generated project with confidential data.

## Key and request model

Verve is browser-local BYOK by default:

- Provider and Pexels keys are stored in the current browser's `localStorage` only after the user saves them.
- A selected provider key is included in the generation request to the Verve route and exists in server memory while that request is handled.
- Keys are not written to a Verve database, project history, recovery checkpoint, application log, or generated ZIP.
- Generated-project history stays in the current browser unless the user exports it.

Because browser storage is readable by JavaScript running on the same origin, use Verve only from the official deployment or a trusted local checkout. Clear saved keys from the key manager after using an untrusted device.

## Supported versions

Security fixes are applied to the latest commit on `main` until the first stable release.
