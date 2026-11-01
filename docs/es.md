# Enercoop para Gladys Assistant

Esta integración lleva a Gladys el consumo de su contador **Linky** y sus **contratos de Enercoop**: Gladys calcula
el coste de cada media hora, sabe cuándo empiezan las horas valle y puede lanzar escenas.

## Lo que necesita

- Un contrato de electricidad de **Enercoop** y un contador **Linky**.
- Su **PRM** (punto de suministro): 14 dígitos, en su factura de Enercoop o en la pantalla del Linky (tecla
  «n° PRM»).
- Un **token de Conso API**. Enercoop suministra la electricidad, pero es **Enedis** quien lee el contador: las
  lecturas vienen de Enedis a través de [Conso API](https://conso.boris.sh), un servicio gratuito y de código
  abierto.
- Gladys **5.3** o posterior.

## 1. Obtener el token de Conso API

1. Abra [conso.boris.sh](https://conso.boris.sh) y pulse el botón de consentimiento.
2. Inicie sesión en su cuenta de Enedis y acepte compartir sus datos.
3. Copie el **token** que aparece al final. Guárdelo para usted: da acceso a su consumo.

Para obtener el consumo **cada media hora** (necesario para valorar bien las horas valle), active también la
**recogida de datos horarios** en su cuenta de Enedis. Sin ella, elija las lecturas **diarias**.

## 2. Configurar la integración

En Gladys: **Integraciones → Enercoop → Configuración**.

| Campo                       | Función                                                                         |
| --------------------------- | ------------------------------------------------------------------------------- |
| PRM                         | Los 14 dígitos de su punto de suministro.                                       |
| Token de Conso API          | El token del paso 1 (no se vuelve a mostrar).                                   |
| Lecturas                    | «Cada 30 minutos» (curva de carga) o «Diarias».                                 |
| Historial a importar        | Días leídos en la primera sincronización (365 como máximo).                     |
| Intervalo de sincronización | Cada cuántas horas se consulta a Enedis (6 h por defecto).                      |
| Umbral de alerta diario     | Por encima de estos kWh al día se dispara la escena «umbral» (0 = desactivado). |
| Festivos de Alsacia-Mosela  | Añade el Viernes Santo y el 26 de diciembre a los festivos.                     |

Pulse **Probar la conexión**: debe aparecer la última lectura disponible.

## 3. Crear el contador

Abra la pestaña **Descubrimiento** de la integración y cree el dispositivo **Linky Enercoop**. Mientras no exista,
las lecturas esperan (el estado lo indica). Después pulse **Sincronizar ahora**.

Las lecturas de un día llegan **a la mañana siguiente**: Enedis las publica durante la noche. No hay valor en tiempo
real, es normal.

## 4. Asignar un contrato de Enercoop

En los ajustes de **Energía** de Gladys, añada un contrato al contador y elija una de las ofertas de Enercoop que
proporciona la integración:

- **Enercoop – Oferta Base**: un solo precio todo el día.
- **Enercoop – Flexibilidad horas valle**: precios de horas punta / valle. Las horas valle son las de su contador,
  fijadas por Enedis e indicadas en su factura (22:00 – 06:00 por defecto).
- **Enercoop – Flexibilidad noche y fin de semana**: horas valle entre semana de 23:00 a 06:00, todo el fin de
  semana y los festivos.

Los precios propuestos son **orientativos** (con IVA, 6 kVA, octubre de 2026). **Copie los de su factura**: precio
del kWh y suscripción mensual. Cuando Enercoop cambie sus precios, basta con modificar el contrato en Gladys.

La integración publica ella misma el calendario de **festivos** (`holidays-fr`) que usa la oferta «noche y fin de
semana». Si otra integración ya lo publica, esa lo conserva: todo funciona igual.

## Widget

Añada el widget **Enercoop** a un panel: consumo del último día, precio y periodo actuales (punta / valle), gráfico
de los últimos 14 días, próximo cambio de tarifa, estado de la sincronización y un botón **Sincronizar**.

## Escenas

**Desencadenantes** (categoría Integraciones):

- **Enercoop: nuevo consumo diario** — variables `date` y `kwh`.
- **Enercoop: consumo diario por encima del umbral** — variables `date`, `kwh`, `threshold_kwh`.
- **Enercoop: cambio de periodo tarifario** — filtro sobre el nuevo periodo (valle / punta), variables `period`,
  `label`, `price`. Ejemplo: encender el termo al empezar las horas valle.

**Acciones**:

- **Enercoop: leer el contador ahora** — devuelve `published`, `last_day`, `last_day_kwh`.
- **Enercoop: obtener el precio actual** — devuelve `period`, `label`, `price`, `is_off_peak`. Ejemplo: lanzar el
  lavavajillas solo si `is_off_peak` es verdadero.

Los cambios de periodo siguen el contrato de Enercoop asignado en Gladys.

## Conexión en la nube

Las lecturas pasan por Internet (Enedis → Conso API → Gladys): la integración está marcada como **cloud**. La
insignia del dispositivo pasa a «inaccesible» cuando la última sincronización ha fallado. Las horas valle y los
festivos se calculan en local.

## Solución de problemas

- **«Conso API rechaza el token»**: el token ha caducado o ha sido revocado. Repita el paso 1 y pegue el nuevo.
- **«Este token da acceso a otro PRM»**: el PRM introducido no corresponde al consentimiento dado.
- **«Enedis rechaza la curva de carga»**: active la recogida horaria en su cuenta de Enedis (empieza al día
  siguiente) o cambie a lecturas diarias.
- **«El contador aún no está creado en Gladys»**: créelo en la pestaña Descubrimiento.
- Sin precio ni horas valle en el widget: asigne un contrato de Enercoop al contador (paso 4).

Para más detalles, consulte los registros de la integración en Gladys. El token nunca aparece en los registros.
