# Security Policy

## Supported Version

Security fixes are applied to the current development branch and the latest published release.

## Report a Vulnerability

Please use [GitHub private vulnerability reporting](https://github.com/i0x1/First2Fetch/security/advisories/new). Include:

- A clear description of the problem
- Reproduction steps or a proof of concept
- The affected file, feature, or release
- The expected security impact

Do not include real user data, production credentials, or private keys in a public issue.

## Secret Handling

- Keep `.env` files outside Git.
- Use only the public Supabase anon key in the desktop app.
- Store service-role, Stripe, Resend, webhook, and AI-provider secrets in the appropriate deployment secret store.
- Keep Apple and Windows signing certificates outside the repository and reference them through environment variables.
- Rotate any credential immediately if it is accidentally committed, even if the file is later deleted.
