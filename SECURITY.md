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
[GladysAssistant/Gladys](https://github.com/GladysAssistant/Gladys/security)), Conso API
(report to [bokub/conso-api](https://github.com/bokub/conso-api)), Enedis and Enercoop.

## What the integration handles

- **The Conso API token** gives read access to the consumption of a delivery point. It is
  stored by Gladys in a `secret` field (never sent back to the browser), sent only to
  `https://conso.boris.sh` in the `Authorization` header, and never written to a log.
- **The PRM** identifies the home: it is masked (`1234 •••••• 5678`) in the logs and in the
  widget.
- The container only writes to `/data` (`state.json`: dates and daily totals, no secret).

## Good practices for users

- Keep the token only in the integration's secret field. Revoke it from your Enedis account
  if you think it leaked, then give your consent again on conso.boris.sh.
- Keep Gladys and the integration up to date.
