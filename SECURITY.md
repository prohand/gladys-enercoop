# Security policy

## Supported versions

Only the latest release of the Enercoop integration receives security fixes.
Update the integration from the Gladys store before reporting an issue.

| Version      | Supported |
| ------------ | --------- |
| 1.x (latest) | Yes       |
| older        | No        |

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Report it privately through GitHub: open the **Security** tab of
[prohand/gladys-enercoop](https://github.com/prohand/gladys-enercoop/security), then
**Report a vulnerability**.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- any log line that helps (remove the Conso API token, your PRM and any address first).

You should get a first answer within 7 days. A fix is released as a new version of
the integration, and the advisory is published once users can update.

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (report to
[GladysAssistant/Gladys](https://github.com/GladysAssistant/Gladys/security)), Enedis and Enercoop.

## What the integration handles

- No secret and no personal identifier: no token, no PRM, no meter reading. The only setting
  is the Alsace-Moselle holidays option.
- No network access besides the Gladys host API, and nothing written to disk.
- It reads the users' Enercoop contracts (prices typed in by the user) through the Gladys
  host API, never the meter nor the consumption.

## Good practices for users

- Coming from 0.0.1, which read the Linky through Conso API: you can revoke that consent
  from your Enedis account.
- Keep Gladys and the integration up to date.
