# Enercoop für Gladys Assistant

Diese Integration bringt die **Enercoop-Verträge** in Gladys: Gladys berechnet die Kosten deines Verbrauchs mit den
Enercoop-Preisen, weiß, wann der Niedertarif beginnt (Wochenende und Feiertage inbegriffen), und kann Szenen
starten.

Sie liest **keinen Zähler** ab: Der Verbrauch kommt von dem Stromzähler, den du schon in Gladys hast.

## Was du brauchst

- Einen **Enercoop**-Stromvertrag.
- Einen **Stromzähler in Gladys**, zum Beispiel:
  - deinen **Linky** über die **Enedis**-Integration von Gladys (mit Gladys Plus);
  - ein **Lixee TIC**-Modul (Zigbee) am Linky;
  - eine Messzange oder ein Messmodul (Shelly EM, Shelly Pro 3EM…).
- Gladys **5.3** oder neuer.

## 1. Die Integration installieren

In Gladys: **Integrationen → Enercoop → Installieren**.

Eine optionale Einstellung:

| Feld                   | Zweck                                                      |
| ---------------------- | ---------------------------------------------------------- |
| Feiertage Elsass-Mosel | Fügt Karfreitag und den 26. Dezember den Feiertagen hinzu. |

## 2. Deinem Zähler einen Enercoop-Vertrag zuordnen

Füge in den **Energie**-Einstellungen von Gladys deinem Stromzähler einen Vertrag hinzu und wähle eines der
Enercoop-Angebote der Integration:

- **Enercoop – Basisangebot**: ein Preis den ganzen Tag.
- **Enercoop – Flexibilität Niedertarif**: Hoch- / Niedertarifpreise. Die Niedertarifzeiten sind die deines
  Zählers, von Enedis festgelegt und auf deiner Rechnung angegeben (standardmäßig 22 – 6 Uhr).
- **Enercoop – Flexibilität Nacht und Wochenende**: Niedertarif werktags von 23 bis 6 Uhr, das ganze Wochenende und
  an Feiertagen.

Die vorgeschlagenen Preise sind **Richtwerte** (inkl. MwSt., 6 kVA, Oktober 2026). **Übernimm die deiner
Rechnung**: Preis pro kWh und monatliche Grundgebühr. Wenn Enercoop die Preise ändert, passe einfach den Vertrag in
Gladys an.

Geh dann zu **Integrationen → Enercoop → Konfiguration** und klicke auf **Vertrag prüfen**: Angebot, aktueller
Preis und nächster Wechsel sollten erscheinen.

Die Integration veröffentlicht den **Feiertagskalender** (`holidays-fr`) für das Angebot „Nacht und Wochenende“
selbst. Veröffentlicht ihn schon eine andere Integration, behält diese ihn: Alles funktioniert gleich.

## Widget

Füge das **Enercoop**-Widget einem Dashboard hinzu: aktueller Preis und Zeitraum (HT / NT), verfolgtes Angebot und
nächster Tarifwechsel. Verbrauch und Kosten zeigen die Energie-Widgets von Gladys an deinem Zähler.

## Szenen

**Auslöser** (Kategorie Integrationen):

- **Enercoop: Tarifzeitraum gewechselt** — Filter auf den neuen Zeitraum (Niedertarif / Hochtarif), Variablen
  `period`, `label`, `price`. Beispiel: den Warmwasserbereiter zu Beginn des Niedertarifs starten, auch am
  Wochenende.

**Aktion**:

- **Enercoop: aktuellen Preis abfragen** — liefert `period`, `label`, `price`, `is_off_peak`. Beispiel: die
  Spülmaschine nur starten, wenn `is_off_peak` wahr ist.

Die Zeitraumwechsel richten sich nach dem in Gladys zugeordneten Enercoop-Vertrag. Alles wird lokal berechnet: Es
ist kein Internetzugang nötig.

## Du hattest Version 0.0.1?

Version 0.0.1 las den Linky über Conso API und legte ein Gerät **Linky Enercoop** an. Das ist vorbei:

1. Ordne in den **Energie**-Einstellungen deinen Enercoop-Vertrag deinem echten Zähler zu (Enedis, Lixee TIC…).
2. Lösche das Gerät **Linky Enercoop**, wenn du es nicht mehr brauchst.
3. Du kannst auch die auf conso.boris.sh erteilte Zustimmung widerrufen.

## Fehlerbehebung

- **„Noch kein Enercoop-Vertrag in Gladys“**: Ordne deinem Zähler einen Enercoop-Vertrag zu (Schritt 2).
- Die Kosten bleiben leer: Prüfe, ob dein Zähler seinen Verbrauch wirklich in Gladys veröffentlicht.

Mehr Details findest du in den Logs der Integration in Gladys.
