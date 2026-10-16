# Comptes Orbit : configuration et limites

Le premier déploiement est maintenant installé : voir [l’état vérifié](ORBIT-DEPLOYMENT.md). Les étapes ci-dessous décrivent aussi la reproduction sur un nouveau projet.

## Hébergement gratuit retenu

Le socle utilise un projet **Supabase appartenant au mainteneur d'Orbit** : Auth pour les comptes, PostgreSQL pour les profils/bibliothèques et une Edge Function pour l'API de compatibilité. Aucun serveur Render ni domaine acheté n'est nécessaire pour commencer. Le domaine technique du projet suffit.

Le forfait gratuit convient aux premiers tests, avec quotas et possibilité de pause après une période de faible activité. Ce n'est pas une garantie d'hébergement gratuit illimité pour une application publique importante.

Le fournisseur e-mail intégré de Supabase est réservé aux adresses de l'équipe du projet et limité. Pour ouvrir les inscriptions au public, configurer un SMTP propre. Brevo propose notamment un palier gratuit de 300 e-mails/jour ; vérifier ses conditions, la validation de l'expéditeur et la configuration au moment du lancement. Aucun compte fournisseur n'a été créé ni aucun abonnement souscrit pendant ce changement.

Sources officielles vérifiées le 16 octobre 2026 :

- [Supabase : tarifs](https://supabase.com/pricing)
- [Pause des projets gratuits](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Limites du SMTP intégré et SMTP personnalisé](https://supabase.com/docs/guides/auth/auth-smtp)
- [Brevo : offre gratuite](https://help.brevo.com/hc/fr/articles/208580669-FAQ-Quels-sont-les-limites-de-l-offre-Gratuit)

## Mise en place sur le compte du propriétaire

1. Créer un projet gratuit « Orbit » depuis https://supabase.com/dashboard, dans sa propre organisation. Choisir une région proche des utilisateurs. Le mot de passe de base de données reste privé.
2. Dans SQL Editor, exécuter `supabase/migrations/202610160001_orbit_accounts.sql`. Cette migration crée les tables Orbit, les règles d'accès par utilisateur et le déclencheur de profil. Ne pas utiliser une base qui héberge déjà un autre produit sans relire la migration.
3. Déployer la fonction du dépôt, depuis sa racine : `npx supabase login`, puis `npx supabase functions deploy orbit-api --project-ref <identifiant-du-projet>`. La fonction vérifie le bearer auprès d'Auth avant chaque accès à la base. Les requêtes de base réutilisent le JWT utilisateur et restent soumises à RLS ; la clé service-role n'est pas utilisée.
4. Activer l'authentification e-mail/mot de passe et la confirmation d'adresse. Régler le minimum de mot de passe à 12 caractères. Avec un SMTP personnalisé, les modèles « Confirm signup » et « Reset password » peuvent inclure `{{ .Token }}`. Avec le fournisseur gratuit par défaut, conserver ses modèles et utiliser le lien standard : Orbit accepte désormais le code ou le lien de vérification propre au projet. Conserver les liens de confirmation appropriés dans le modèle de changement d'adresse e-mail.
5. Configurer le SMTP pour tester avec des destinataires hors de l'équipe. Conserver les protections contre l'abus et les limites d'envoi. Le CAPTCHA n'est pas encore intégré au formulaire natif ; ne pas activer un CAPTCHA obligatoire sans ajouter cette prise en charge.
6. Copier uniquement l'URL du projet et sa clé **publishable** publique (ou l'ancienne clé **anon**) dans un fichier `.env` local non commité :

```dotenv
MAIN_VITE_ORBIT_SUPABASE_URL=https://<projet>.supabase.co
MAIN_VITE_ORBIT_SUPABASE_KEY=sb_publishable_...
```

Ne jamais utiliser la clé **secret/service_role**, un mot de passe de base de données ou un jeton personnel Supabase dans l'application. Le code refuse les formats secret/service-role connus. Ajouter les mêmes variables publiques aux variables GitHub Actions d'Orbit pour les builds. Reconstruire l'application après modification.

7. Garder `MAIN_VITE_API_URL` comme adresse du catalogue public existant. Elle n'est plus l'adresse des comptes. Garder `MAIN_VITE_ORBIT_LAUNCHER_SUBDOMAIN` vide pour charger l'interface embarquée ; un éventuel hébergement d'interface distant doit appartenir à Orbit. L'ancienne variable Hydra de renderer distant n'est plus utilisée par Orbit.
8. Tester avec deux vrais comptes : confirmation, connexion, récupération, rotation de session, déconnexion, redémarrage et isolement de leurs données. Vérifier directement avec deux JWT que RLS refuse les lectures/écritures croisées. Ces tests sur le projet hébergé restent à faire après sa création. La migration et les règles RLS ont été exécutées dans PostgreSQL/WASM local avec deux identités simulées.

## Séparation des services

`src/shared/orbit-api-policy.ts` contient la liste explicite des routes de données conservées chez Hydra : catalogue, fiches/assets/statistiques/définitions de succès, ProtonDB, références de téléchargement, utilitaires de sources et disponibilité des hébergeurs, informations publiques Decky. Ces appels ne contiennent pas d'en-tête Authorization, apikey Orbit ni cookie, ne suivent pas les redirections, et ont un délai limité. Certains utilitaires transmettent toujours leurs paramètres nécessaires (recherche, URL d'une source, identifiants de contenus) au service tiers ; « sans compte » ne signifie pas « sans requête réseau ».

Cette liste repose sur les contrats du client et n'a pas été validée contre un serveur Hydra réel dans cette modification. Une route refusant l'accès anonyme échoue sans demander un compte Hydra. Les caches existants sont conservés là où les composants en ont déjà ; aucun cache universel ni fonctionnement intégral hors ligne n'est annoncé.

Les profils, données personnelles, fonctions sociales, mutations, paiements et indicateurs de fonctionnalités vont exclusivement vers Orbit. Même un appel marqué `needsAuth:false` ne peut pas détourner une route privée vers Hydra. Une panne/401 du catalogue public ne déconnecte pas le compte Orbit. Les anciens noms internes `HydraApi`, IPC et clés de jeux sont conservés pour compatibilité ; ils ne déterminent plus le propriétaire du compte.

Les sessions Orbit sont chiffrées avec Electron safeStorage, dans une clé distincte liée au projet. Les anciens jetons Hydra restent intacts mais ne sont jamais chargés. Les jetons Orbit ne sont pas exposés au renderer. Les retours de connexion Hydra et les jetons contenus dans une URI arbitraire sont refusés. La déconnexion ne vide plus les jeux, téléchargements et données de scan locaux. Le traitement existant des imports Epic reste soumis à l'identité de compte, sans transfert automatique d'une identité Hydra vers Orbit.

## Couverture réelle du serveur fourni

| Fonction                                                                                             | Couverture                                                                                                                |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Inscription/connexion, confirmation par code, récupération, changement de mot de passe/adresse       | Client natif + Supabase Auth, déployés ; parcours e-mail réel à tester                                                    |
| Profil personnel                                                                                     | Lecture, pseudo, bio, visibilité                                                                                          |
| Bibliothèque                                                                                         | Création et envoi de lots, récupération paginée, favoris, épingles, temps manuel/incrémental et retrait distant explicite |
| Sessions                                                                                             | Stockage chiffré, renouvellement et rotation du refresh token, séparation par projet                                      |
| Amis/chat/profils publics/notifications                                                              | Interface et commandes existantes conservées ; backend Orbit encore à implémenter                                         |
| Cloud, images de profil/souvenirs, collections, synchronisation complète des sessions/succès/sources | Backend Orbit encore à compléter                                                                                          |
| Liaison Steam/Epic passant auparavant par Hydra                                                      | Contrats conservés ; backend de liaison Orbit encore à implémenter                                                        |
| Paiements/abonnements                                                                                | Backend Orbit et URL de paiement Orbit à fournir ; aucun abonnement Hydra transféré                                       |

Une route non implémentée retourne explicitement `501 orbit-service-pending`, jamais des résultats factices ou un repli authentifié sur Hydra. Les fonctions non migrées ne sont donc pas opérationnelles avec les comptes Orbit à ce stade. Le code et les écrans sont conservés, mais ce socle ne doit pas être publié comme une migration complète de toutes les fonctionnalités.

Validation locale : tests de politique, vrais intercepteurs HTTP avec transport simulé, protections de contexte/concurrence, rotation des refresh tokens, stockage chiffré avec frontière Electron simulée et tests du handler serveur avec transport simulé. Formulaire réel inspecté dans un navigateur isolé (état non configuré et inscription vers confirmation). Le déploiement et la migration hébergés ont ensuite été exécutés et vérifiés (voir ORBIT-DEPLOYMENT.md). Les vraies inscriptions, envois d’e-mails, sessions Electron complètes et installateurs restent à tester.

Le contrôle optionnel `scripts/check-orbit-rls.mjs` a exécuté la migration SQL réelle dans PostgreSQL/WASM (PGlite), avec création de profil, fusion atomique, incrément de temps, refus des accès anonymes et refus des lectures/écritures/suppressions croisées entre deux utilisateurs simulés. Cela ne remplace pas les tests de JWT et RLS sur le projet Supabase hébergé. Pour reproduire : `npm install --prefix .cache/orbit-db-check --no-package-lock --ignore-scripts @electric-sql/pglite`, puis `node scripts/check-orbit-rls.mjs`. Cette dépendance de contrôle n’est pas embarquée dans Orbit.
