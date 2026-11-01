# Enercoop pour Gladys Assistant

Cette intégration ajoute les **contrats Enercoop** dans Gladys : Gladys calcule le coût de votre consommation avec
les prix Enercoop, sait quand commencent les heures creuses (week-end et jours fériés compris) et peut lancer des
scènes.

Elle ne relève **aucun compteur** : la consommation vient du compteur électrique que vous avez déjà dans Gladys.

## Ce qu'il vous faut

- Un contrat d'électricité **Enercoop**.
- Un **compteur électrique dans Gladys**, par exemple :
  - votre **Linky** par l'intégration **Enedis** de Gladys (avec Gladys Plus) ;
  - un module **Lixee TIC** (Zigbee) branché sur le Linky ;
  - une pince ou un module de mesure (Shelly EM, Shelly Pro 3EM…).
- Gladys **5.3** ou plus récent.

## 1. Installer l'intégration

Dans Gladys : **Intégrations → Enercoop → Installer**.

Un seul réglage, facultatif :

| Champ                         | Rôle                                                         |
| ----------------------------- | ------------------------------------------------------------ |
| Jours fériés d'Alsace-Moselle | Ajoute le Vendredi saint et le 26 décembre aux jours fériés. |

## 2. Associer un contrat Enercoop à votre compteur

Dans les réglages **Énergie** de Gladys, ajoutez un contrat à votre compteur électrique et choisissez l'une des
offres Enercoop proposées par l'intégration :

- **Enercoop – Offre Base** : un seul prix toute la journée.
- **Enercoop – Flexibilité heures creuses** : prix heures pleines / heures creuses. Les heures creuses sont celles
  de votre compteur, fixées par Enedis et écrites sur votre facture (par défaut 22 h – 6 h).
- **Enercoop – Flexibilité nuit et week-end** : heures creuses en semaine de 23 h à 6 h, tout le week-end et les
  jours fériés.

Les prix proposés sont **indicatifs** (TTC, 6 kVA, octobre 2026). **Reprenez ceux de votre facture** : prix du kWh
et abonnement mensuel. Quand Enercoop change ses prix, modifiez simplement le contrat dans Gladys.

Revenez ensuite dans **Intégrations → Enercoop → Configuration** et cliquez sur **Vérifier le contrat** : l'offre,
le prix en cours et le prochain changement doivent s'afficher.

L'intégration publie elle-même le calendrier des **jours fériés** (`holidays-fr`) utilisé par l'offre « nuit et
week-end ». Si une autre intégration le publie déjà, c'est elle qui le garde : tout fonctionne pareil.

## Widget

Ajoutez le widget **Enercoop** à un tableau de bord : prix et période en cours (HP / HC), offre suivie et prochain
changement de tarif. La consommation et son coût s'affichent avec les widgets énergie de Gladys, sur votre compteur.

## Scènes

**Déclencheur** (catégorie Intégrations) :

- **Enercoop : changement de période tarifaire** — filtre sur la nouvelle période (heures creuses / pleines),
  variables `period`, `label`, `price`. Exemple : lancer le chauffe-eau au début des heures creuses, week-end
  compris.

**Action** :

- **Enercoop : lire le prix actuel** — renvoie `period`, `label`, `price`, `is_off_peak`. Exemple : ne lancer le
  lave-vaisselle que si `is_off_peak` est vrai.

Les changements de période se basent sur le contrat Enercoop associé dans Gladys. Tout se calcule en local : aucune
connexion Internet n'est nécessaire.

## Vous aviez la version 0.0.1 ?

La version 0.0.1 relevait le Linky par Conso API et créait un appareil **Linky Enercoop**. Ce n'est plus le cas :

1. Dans les réglages **Énergie**, associez votre contrat Enercoop à votre vrai compteur (Enedis, Lixee TIC…).
2. Supprimez l'appareil **Linky Enercoop** s'il ne vous sert plus.
3. Vous pouvez aussi révoquer le consentement donné sur conso.boris.sh.

## En cas de problème

- **« Pas encore de contrat Enercoop »** : associez un contrat Enercoop à votre compteur (étape 2).
- Les coûts restent vides : vérifiez que votre compteur publie bien sa consommation dans Gladys.

Pour plus de détails, regardez les logs de l'intégration dans Gladys.
