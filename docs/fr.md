# Enercoop pour Gladys Assistant

Cette intégration amène dans Gladys la consommation de votre compteur **Linky** et vos **contrats Enercoop** :
Gladys calcule le coût de chaque demi-heure, sait quand commencent les heures creuses et peut lancer des scènes.

## Ce qu'il vous faut

- Un contrat d'électricité **Enercoop** et un compteur **Linky**.
- Votre **PRM** (point de livraison) : 14 chiffres, sur votre facture Enercoop ou sur l'écran du Linky (touche
  « n° PRM »).
- Un **jeton Conso API**. Enercoop fournit l'électricité mais c'est **Enedis** qui relève le compteur : les relevés
  viennent d'Enedis par [Conso API](https://conso.boris.sh), un service gratuit et open source.
- Gladys **5.3** ou plus récent.

## 1. Obtenir le jeton Conso API

1. Ouvrez [conso.boris.sh](https://conso.boris.sh) et cliquez sur le bouton de consentement.
2. Connectez-vous à votre espace Enedis et acceptez le partage de vos données.
3. Copiez le **jeton** affiché à la fin. Gardez-le pour vous : il donne accès à votre consommation.

Pour avoir la consommation **à la demi-heure** (nécessaire pour bien chiffrer les heures creuses), activez aussi la
**collecte de la consommation horaire** dans votre espace client Enedis. Sans elle, choisissez les relevés
**quotidiens**.

## 2. Configurer l'intégration

Dans Gladys : **Intégrations → Enercoop → Configuration**.

| Champ                         | Rôle                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| PRM                           | Les 14 chiffres de votre point de livraison.                                       |
| Jeton Conso API               | Le jeton obtenu à l'étape 1 (jamais réaffiché).                                    |
| Relevés                       | « Toutes les 30 minutes » (courbe de charge) ou « Quotidiens ».                    |
| Historique à importer         | Nombre de jours lus à la première synchronisation (365 au plus).                   |
| Intervalle de synchronisation | Toutes les combien d'heures Enedis est interrogé (6 h par défaut).                 |
| Seuil d'alerte quotidien      | Au-dessus de ce nombre de kWh par jour, la scène « seuil » se déclenche (0 = off). |
| Jours fériés d'Alsace-Moselle | Ajoute le Vendredi saint et le 26 décembre aux jours fériés.                       |

Cliquez sur **Tester la connexion** : le dernier relevé disponible doit s'afficher.

## 3. Créer le compteur

Ouvrez l'onglet **Découverte** de l'intégration et créez l'appareil **Linky Enercoop**. Tant qu'il n'est pas créé,
les relevés attendent (le statut le signale). Cliquez ensuite sur **Synchroniser maintenant**.

Les relevés d'une journée arrivent **le lendemain matin** : Enedis les publie pendant la nuit. Il n'y a donc pas de
valeur en temps réel, c'est normal.

## 4. Associer un contrat Enercoop

Dans les réglages **Énergie** de Gladys, ajoutez un contrat au compteur et choisissez l'une des offres Enercoop
proposées par l'intégration :

- **Enercoop – Offre Base** : un seul prix toute la journée.
- **Enercoop – Flexibilité heures creuses** : prix heures pleines / heures creuses. Les heures creuses sont celles
  de votre compteur, fixées par Enedis et écrites sur votre facture (par défaut 22 h – 6 h).
- **Enercoop – Flexibilité nuit et week-end** : heures creuses en semaine de 23 h à 6 h, tout le week-end et les
  jours fériés.

Les prix proposés sont **indicatifs** (TTC, 6 kVA, octobre 2026). **Reprenez ceux de votre facture** : prix du kWh
et abonnement mensuel. Quand Enercoop change ses prix, modifiez simplement le contrat dans Gladys.

L'intégration publie elle-même le calendrier des **jours fériés** (`holidays-fr`) utilisé par l'offre « nuit et
week-end ». Si une autre intégration le publie déjà, c'est elle qui le garde : tout fonctionne pareil.

## Widget

Ajoutez le widget **Enercoop** à un tableau de bord : consommation du dernier jour, prix et période en cours (HP / HC),
graphique des 14 derniers jours, prochain changement de tarif, état de la synchronisation et bouton **Synchroniser**.

## Scènes

**Déclencheurs** (catégorie Intégrations) :

- **Enercoop : nouvelle consommation quotidienne** — variables `date` et `kwh`.
- **Enercoop : consommation quotidienne au-dessus du seuil** — variables `date`, `kwh`, `threshold_kwh`.
- **Enercoop : changement de période tarifaire** — filtre sur la nouvelle période (heures creuses / pleines),
  variables `period`, `label`, `price`. Exemple : lancer le chauffe-eau au début des heures creuses.

**Actions** :

- **Enercoop : relever le compteur maintenant** — renvoie `published`, `last_day`, `last_day_kwh`.
- **Enercoop : lire le prix actuel** — renvoie `period`, `label`, `price`, `is_off_peak`. Exemple : ne lancer le
  lave-vaisselle que si `is_off_peak` est vrai.

Les changements de période se basent sur le contrat Enercoop associé dans Gladys.

## Connexion cloud

Les relevés passent par Internet (Enedis → Conso API → Gladys) : l'intégration est marquée **cloud**. Le badge de
l'appareil passe à « injoignable » quand la dernière synchronisation a échoué. Le calcul des heures creuses et des
jours fériés, lui, se fait en local.

## En cas de problème

- **« Conso API refuse le jeton »** : le jeton a expiré ou a été révoqué. Refaites l'étape 1 et collez le nouveau.
- **« Ce jeton donne accès à un autre PRM »** : le PRM saisi ne correspond pas au consentement donné.
- **« Enedis refuse la courbe de charge »** : activez la collecte horaire dans votre espace Enedis (elle démarre le
  lendemain), ou passez en relevés quotidiens.
- **« Le compteur n'est pas encore créé »** : créez-le dans l'onglet Découverte.
- Pas de prix ni d'heures creuses dans le widget : associez un contrat Enercoop au compteur (étape 4).

Pour plus de détails, regardez les logs de l'intégration dans Gladys. Le jeton n'apparaît jamais dans les logs.
