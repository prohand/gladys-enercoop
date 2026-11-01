# Enercoop para Gladys Assistant

Esta integración añade los **contratos de Enercoop** a Gladys: Gladys calcula el coste de su consumo con los precios
de Enercoop, sabe cuándo empiezan las horas valle (fines de semana y festivos incluidos) y puede lanzar escenas.

No lee **ningún contador**: el consumo viene del contador eléctrico que ya tiene en Gladys.

## Qué necesita

- Un contrato de electricidad de **Enercoop**.
- Un **contador eléctrico en Gladys**, por ejemplo:
  - su **Linky** mediante la integración **Enedis** de Gladys (con Gladys Plus);
  - un módulo **Lixee TIC** (Zigbee) conectado al Linky;
  - una pinza o un módulo de medida (Shelly EM, Shelly Pro 3EM…).
- Gladys **5.3** o más reciente.

## 1. Instalar la integración

En Gladys: **Integraciones → Enercoop → Instalar**.

Un único ajuste, opcional:

| Campo                      | Función                                                     |
| -------------------------- | ----------------------------------------------------------- |
| Festivos de Alsacia-Mosela | Añade el Viernes Santo y el 26 de diciembre a los festivos. |

## 2. Asignar un contrato de Enercoop a su contador

En los ajustes de **Energía** de Gladys, añada un contrato a su contador eléctrico y elija una de las ofertas de
Enercoop que ofrece la integración:

- **Enercoop – Oferta Base**: un solo precio todo el día.
- **Enercoop – Flexibilidad horas valle**: precios de horas punta / valle. Las horas valle son las de su contador,
  fijadas por Enedis e indicadas en su factura (22:00 – 06:00 por defecto).
- **Enercoop – Flexibilidad noche y fin de semana**: horas valle entre semana de 23:00 a 06:00, todo el fin de
  semana y los festivos.

Los precios propuestos son **orientativos** (con IVA, 6 kVA, octubre de 2026). **Copie los de su factura**: precio
del kWh y suscripción mensual. Cuando Enercoop cambie sus precios, modifique simplemente el contrato en Gladys.

Vuelva después a **Integraciones → Enercoop → Configuración** y haga clic en **Comprobar el contrato**: deben
aparecer la oferta, el precio actual y el próximo cambio.

La integración publica ella misma el calendario de **festivos** (`holidays-fr`) que usa la oferta «noche y fin de
semana». Si otra integración ya lo publica, esa lo conserva: todo funciona igual.

## Widget

Añada el widget **Enercoop** a un panel: precio y periodo actuales (punta / valle), oferta seguida y próximo cambio
de tarifa. El consumo y su coste se muestran con los widgets de energía de Gladys, en su contador.

## Escenas

**Desencadenante** (categoría Integraciones):

- **Enercoop: cambio de periodo tarifario** — filtro sobre el nuevo periodo (horas valle / punta), variables
  `period`, `label`, `price`. Ejemplo: encender el termo al empezar las horas valle, fines de semana incluidos.

**Acción**:

- **Enercoop: obtener el precio actual** — devuelve `period`, `label`, `price`, `is_off_peak`. Ejemplo: poner el
  lavavajillas solo si `is_off_peak` es verdadero.

Los cambios de periodo siguen el contrato de Enercoop asignado en Gladys. Todo se calcula en local: no hace falta
acceso a Internet.

## ¿Tenía la versión 0.0.1?

La versión 0.0.1 leía el Linky mediante Conso API y creaba un dispositivo **Linky Enercoop**. Ya no es así:

1. En los ajustes de **Energía**, asigne su contrato de Enercoop a su contador real (Enedis, Lixee TIC…).
2. Elimine el dispositivo **Linky Enercoop** si ya no le sirve.
3. También puede revocar el consentimiento dado en conso.boris.sh.

## Solución de problemas

- **«Todavía no hay contrato de Enercoop»**: asigne un contrato de Enercoop a su contador (paso 2).
- Los costes siguen vacíos: compruebe que su contador publica su consumo en Gladys.

Para más detalles, consulte los registros de la integración en Gladys.
