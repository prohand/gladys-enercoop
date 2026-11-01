# Enercoop für Gladys Assistant

Diese Integration bringt den Verbrauch deines **Linky**-Zählers und deine **Enercoop-Verträge** in Gladys: Gladys
berechnet die Kosten jeder halben Stunde, weiß, wann der Niedertarif beginnt, und kann Szenen starten.

## Was du brauchst

- Einen **Enercoop**-Stromvertrag und einen **Linky**-Zähler.
- Deine **PRM** (Lieferstelle): 14 Ziffern, auf deiner Enercoop-Rechnung oder auf dem Linky-Display (Taste
  „n° PRM“).
- Ein **Conso-API-Token**. Enercoop liefert den Strom, aber **Enedis** liest den Zähler ab: Die Messwerte kommen von
  Enedis über [Conso API](https://conso.boris.sh), einen kostenlosen Open-Source-Dienst.
- Gladys **5.3** oder neuer.

## 1. Conso-API-Token erhalten

1. Öffne [conso.boris.sh](https://conso.boris.sh) und klicke auf die Zustimmungsschaltfläche.
2. Melde dich in deinem Enedis-Konto an und stimme der Weitergabe deiner Daten zu.
3. Kopiere das am Ende angezeigte **Token**. Behalte es für dich: Es gibt Zugriff auf deinen Verbrauch.

Für den Verbrauch **pro halbe Stunde** (nötig, um den Niedertarif richtig zu berechnen) aktiviere auch die
**halbstündliche Datenerfassung** in deinem Enedis-Konto. Ohne sie wähle die **täglichen** Messwerte.

## 2. Integration einrichten

In Gladys: **Integrationen → Enercoop → Konfiguration**.

| Feld                       | Zweck                                                                        |
| -------------------------- | ---------------------------------------------------------------------------- |
| PRM                        | Die 14 Ziffern deiner Lieferstelle.                                          |
| Conso-API-Token            | Das Token aus Schritt 1 (wird nie wieder angezeigt).                         |
| Messwerte                  | „Alle 30 Minuten“ (Lastgang) oder „Täglich“.                                 |
| Zu importierender Verlauf  | Tage, die bei der ersten Synchronisierung gelesen werden (höchstens 365).    |
| Synchronisierungsintervall | Wie oft, in Stunden, Enedis abgefragt wird (standardmäßig 6 h).              |
| Tägliche Warnschwelle      | Über so vielen kWh pro Tag löst der Szenenauslöser „Schwelle“ aus (0 = aus). |
| Feiertage Elsass-Mosel     | Fügt Karfreitag und den 26. Dezember den Feiertagen hinzu.                   |

Klicke auf **Verbindung testen**: Der letzte verfügbare Messwert sollte erscheinen.

## 3. Zähler anlegen

Öffne den Reiter **Erkennung** der Integration und lege das Gerät **Linky Enercoop** an. Solange es nicht existiert,
warten die Messwerte (der Status zeigt es an). Klicke dann auf **Jetzt synchronisieren**.

Die Werte eines Tages kommen **am nächsten Morgen**: Enedis veröffentlicht sie über Nacht. Es gibt keinen
Echtzeitwert, das ist normal.

## 4. Enercoop-Vertrag zuordnen

Füge in den **Energie**-Einstellungen von Gladys dem Zähler einen Vertrag hinzu und wähle eines der
Enercoop-Angebote der Integration:

- **Enercoop – Basisangebot**: ein Preis den ganzen Tag.
- **Enercoop – Flexibilität Niedertarif**: Hoch- / Niedertarifpreise. Die Niedertarifzeiten sind die deines Zählers,
  von Enedis festgelegt und auf deiner Rechnung angegeben (standardmäßig 22 – 6 Uhr).
- **Enercoop – Flexibilität Nacht und Wochenende**: Niedertarif werktags von 23 bis 6 Uhr, das ganze Wochenende und
  an Feiertagen.

Die vorgeschlagenen Preise sind **Richtwerte** (inkl. MwSt., 6 kVA, Oktober 2026). **Übernimm die Werte deiner
Rechnung**: Preis pro kWh und monatliche Grundgebühr. Ändert Enercoop seine Preise, passe einfach den Vertrag in
Gladys an.

Die Integration veröffentlicht selbst den **Feiertagskalender** (`holidays-fr`), den das Angebot „Nacht und
Wochenende“ liest. Veröffentlicht ihn bereits eine andere Integration, behält diese ihn: Alles funktioniert gleich.

## Widget

Füge das Widget **Enercoop** einem Dashboard hinzu: Verbrauch des letzten Tages, aktueller Preis und Zeitraum
(Hoch- / Niedertarif), Diagramm der letzten 14 Tage, nächster Tarifwechsel, Synchronisierungsstatus und eine
Schaltfläche **Jetzt abrufen**.

## Szenen

**Auslöser** (Kategorie Integrationen):

- **Enercoop: neuer Tagesverbrauch** — Variablen `date` und `kwh`.
- **Enercoop: Tagesverbrauch über der Schwelle** — Variablen `date`, `kwh`, `threshold_kwh`.
- **Enercoop: Tarifzeitraum gewechselt** — Filter auf den neuen Zeitraum (Nieder- / Hochtarif), Variablen `period`,
  `label`, `price`. Beispiel: den Warmwasserbereiter zu Beginn des Niedertarifs einschalten.

**Aktionen**:

- **Enercoop: Zähler jetzt ablesen** — liefert `published`, `last_day`, `last_day_kwh`.
- **Enercoop: aktuellen Preis abfragen** — liefert `period`, `label`, `price`, `is_off_peak`. Beispiel: die
  Spülmaschine nur starten, wenn `is_off_peak` wahr ist.

Die Zeitraumwechsel richten sich nach dem in Gladys zugeordneten Enercoop-Vertrag.

## Cloud-Verbindung

Die Messwerte gehen über das Internet (Enedis → Conso API → Gladys): Die Integration ist als **Cloud** markiert. Das
Geräte-Badge wechselt auf „nicht erreichbar“, wenn die letzte Synchronisierung fehlschlug. Niedertarifzeiten und
Feiertage werden lokal berechnet.

## Fehlerbehebung

- **„Conso API lehnt das Token ab“**: Das Token ist abgelaufen oder widerrufen. Wiederhole Schritt 1 und füge das
  neue ein.
- **„Dieses Token gilt für eine andere PRM“**: Die eingegebene PRM passt nicht zur erteilten Zustimmung.
- **„Enedis lehnt den Lastgang ab“**: Aktiviere die halbstündliche Erfassung im Enedis-Konto (sie beginnt am
  nächsten Tag) oder wechsle zu täglichen Messwerten.
- **„Der Zähler ist in Gladys noch nicht angelegt“**: Lege ihn im Reiter Erkennung an.
- Kein Preis und kein Niedertarif im Widget: Ordne dem Zähler einen Enercoop-Vertrag zu (Schritt 4).

Mehr Details findest du in den Logs der Integration in Gladys. Das Token erscheint nie in den Logs.
