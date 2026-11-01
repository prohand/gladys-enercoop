# Enercoop for Gladys Assistant

This integration brings the consumption of your **Linky** meter and your **Enercoop contracts** into Gladys: Gladys
computes the cost of every half-hour, knows when off-peak hours start and can run scenes.

## What you need

- An **Enercoop** electricity contract and a **Linky** meter.
- Your **PRM** (delivery point): 14 digits, on your Enercoop bill or on the Linky screen ("n° PRM" key).
- A **Conso API token**. Enercoop supplies the electricity but **Enedis** reads the meter: the readings come from
  Enedis through [Conso API](https://conso.boris.sh), a free and open-source service.
- Gladys **5.3** or later.

## 1. Get the Conso API token

1. Open [conso.boris.sh](https://conso.boris.sh) and click the consent button.
2. Sign in to your Enedis account and accept sharing your data.
3. Copy the **token** shown at the end. Keep it private: it gives access to your consumption.

To get the consumption **every half-hour** (needed to price off-peak hours right), also enable the **half-hourly
data collection** in your Enedis account. Without it, choose the **daily** readings.

## 2. Configure the integration

In Gladys: **Integrations → Enercoop → Configuration**.

| Field                          | Purpose                                                                   |
| ------------------------------ | ------------------------------------------------------------------------- |
| PRM                            | The 14 digits of your delivery point.                                     |
| Conso API token                | The token from step 1 (never shown again).                                |
| Readings                       | "Every 30 minutes" (load curve) or "Daily".                               |
| History to import              | Days read by the first sync (365 at most).                                |
| Sync interval                  | How often, in hours, Enedis is asked (6 h by default).                    |
| Daily alert threshold          | Above this many kWh a day, the "threshold" scene trigger fires (0 = off). |
| Alsace-Moselle public holidays | Adds Good Friday and 26 December to the public holidays.                  |

Click **Test the connection**: the last available reading should show.

## 3. Create the meter

Open the **Discovery** tab of the integration and create the **Linky Enercoop** device. Until it exists, the readings
wait (the status says so). Then click **Sync now**.

The readings of a day arrive **the next morning**: Enedis publishes them overnight. There is no real-time value, and
that is expected.

## 4. Attach an Enercoop contract

In the **Energy** settings of Gladys, add a contract to the meter and pick one of the Enercoop offers the integration
provides:

- **Enercoop – Base offer**: one price all day.
- **Enercoop – Flexibility, off-peak hours**: peak / off-peak prices. The off-peak hours are those of your meter,
  set by Enedis and written on your bill (22:00 – 06:00 by default).
- **Enercoop – Flexibility, night and weekend**: off-peak on weekdays from 23:00 to 06:00, all weekend and on
  public holidays.

The suggested prices are **indicative** (incl. VAT, 6 kVA, October 2026). **Copy those of your bill**: price per kWh
and monthly subscription. When Enercoop changes its prices, just edit the contract in Gladys.

The integration publishes the **public holidays** calendar (`holidays-fr`) the "night and weekend" offer reads. If
another integration already publishes it, that one keeps it: everything works the same.

## Widget

Add the **Enercoop** widget to a dashboard: last day's consumption, current price and period (peak / off-peak),
14-day chart, next tariff change, sync status and a **Sync now** button.

## Scenes

**Triggers** (Integrations category):

- **Enercoop: new daily consumption** — variables `date` and `kwh`.
- **Enercoop: daily consumption over the threshold** — variables `date`, `kwh`, `threshold_kwh`.
- **Enercoop: tariff period changed** — filter on the new period (off-peak / peak), variables `period`, `label`,
  `price`. Example: start the water heater when off-peak hours begin.

**Actions**:

- **Enercoop: read the meter now** — returns `published`, `last_day`, `last_day_kwh`.
- **Enercoop: get the current price** — returns `period`, `label`, `price`, `is_off_peak`. Example: only start the
  dishwasher when `is_off_peak` is true.

Period changes follow the Enercoop contract attached in Gladys.

## Cloud connection

The readings travel over the Internet (Enedis → Conso API → Gladys): the integration is tagged **cloud**. The device
badge turns "unreachable" when the last sync failed. Off-peak hours and public holidays are computed locally.

## Troubleshooting

- **"Conso API refused the token"**: the token expired or was revoked. Do step 1 again and paste the new one.
- **"This token gives access to another PRM"**: the PRM typed does not match the consent given.
- **"Enedis refused the load curve"**: enable the half-hourly collection in your Enedis account (it starts the next
  day), or switch to daily readings.
- **"The meter is not created in Gladys yet"**: create it in the Discovery tab.
- No price or off-peak hours in the widget: attach an Enercoop contract to the meter (step 4).

For more details, look at the integration logs in Gladys. The token never appears in the logs.
