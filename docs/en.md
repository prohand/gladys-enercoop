# Enercoop for Gladys Assistant

This integration adds the **Enercoop contracts** to Gladys: Gladys prices your consumption with the Enercoop
prices, knows when off-peak hours start (weekends and public holidays included) and can run scenes.

It reads **no meter**: the consumption comes from the electricity meter you already have in Gladys.

## What you need

- An **Enercoop** electricity contract.
- An **electricity meter in Gladys**, for example:
  - your **Linky** through the **Enedis** integration of Gladys (with Gladys Plus);
  - a **Lixee TIC** module (Zigbee) plugged into the Linky;
  - a clamp or metering module (Shelly EM, Shelly Pro 3EM…).
- Gladys **5.3** or newer.

## 1. Install the integration

In Gladys: **Integrations → Enercoop → Install**.

One optional setting:

| Field                          | Purpose                                                       |
| ------------------------------ | ------------------------------------------------------------- |
| Alsace-Moselle public holidays | Adds Good Friday and 26 December to the public holidays list. |

## 2. Attach an Enercoop contract to your meter

In the **Energy** settings of Gladys, add a contract to your electricity meter and pick one of the Enercoop offers
the integration provides:

- **Enercoop – Base offer**: one price all day.
- **Enercoop – Flexibility, off-peak hours**: peak / off-peak prices. The off-peak hours are those of your meter,
  set by Enedis and written on your bill (22:00 – 06:00 by default).
- **Enercoop – Flexibility, night and weekend**: off-peak on weekdays from 23:00 to 06:00, all weekend and on public
  holidays.

The prices offered are **indicative** (incl. VAT, 6 kVA, October 2026). **Copy those of your bill**: price per kWh
and monthly subscription. When Enercoop changes its prices, just edit the contract in Gladys.

Then go back to **Integrations → Enercoop → Configuration** and click **Check the contract**: the offer, the
current price and the next change should show.

The integration publishes the **public holidays** calendar (`holidays-fr`) used by the "night and weekend" offer
itself. If another integration already publishes it, that one keeps it: everything works the same.

## Widget

Add the **Enercoop** widget to a dashboard: current price and period (peak / off-peak), followed offer and next
tariff change. The consumption and its cost show in the Gladys energy widgets, on your meter.

## Scenes

**Trigger** (Integrations category):

- **Enercoop: tariff period changed** — filter on the new period (off-peak / peak), variables `period`, `label`,
  `price`. Example: start the water heater when off-peak hours begin, weekends included.

**Action**:

- **Enercoop: get the current price** — returns `period`, `label`, `price`, `is_off_peak`. Example: start the
  dishwasher only if `is_off_peak` is true.

The period changes follow the Enercoop contract attached in Gladys. Everything is computed locally: no Internet
access is needed.

## Coming from version 0.0.1?

Version 0.0.1 read the Linky through Conso API and created a **Linky Enercoop** device. It no longer does:

1. In the **Energy** settings, attach your Enercoop contract to your real meter (Enedis, Lixee TIC…).
2. Delete the **Linky Enercoop** device if you no longer need it.
3. You can also revoke the consent given on conso.boris.sh.

## Troubleshooting

- **"No Enercoop contract in Gladys yet"**: attach an Enercoop contract to your meter (step 2).
- The costs stay empty: check that your meter does publish its consumption in Gladys.

For more details, look at the integration logs in Gladys.
