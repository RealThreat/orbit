# État du déploiement Orbit — 16 octobre 2026

Le propriétaire a créé le projet Supabase `hbqpoaysrtdtuvwvycde`. Sa configuration publique est enregistrée dans `.env` local (ignoré par Git) et dans les variables GitHub Actions du dépôt. Aucune clé d'administration n'est embarquée dans Orbit.

## Installé et vérifié

- Migration `202610160001` exécutée et inscrite dans l'historique distant.
- Tables `orbit_profiles` et `orbit_games`, avec Row Level Security activée.
- Déclencheur de création de profil et fonctions de fusion/incrément du temps de jeu.
- Edge Function `orbit-api` déployée. Le routage accepte le chemin abrégé réellement transmis par la passerelle Supabase, ainsi que le chemin complet utilisé en local.
- Authentification e-mail activée, confirmation d'adresse conservée, minimum de mot de passe de 12 caractères.
- URL de retour des e-mails : `https://hbqpoaysrtdtuvwvycde.supabase.co/functions/v1/orbit-api/auth-complete`. Cette page n'utilise aucun service externe, supprime le fragment de session de l'adresse et interdit l'envoi de referrer. Aucun jeton n'est envoyé à GitHub ou Hydra.

Vérifications HTTP réelles : `/health` répond 200, le profil sans session répond 401 et un bearer invalide est refusé (401, normalisé depuis la réponse Auth). Les règles RLS ont été exercées sur la base hébergée avec deux identités SQL simulées : lectures/écritures/suppressions croisées et accès anonymes refusés, fusion et incrément de temps validés. Tous les enregistrements de test étaient dans une transaction annulée ; aucun compte de test permanent n'a été laissé.

## E-mails gratuits

Le fournisseur d'e-mail intégré de Supabase a refusé les modèles personnalisés : il exige un SMTP externe ou une offre adaptée. Aucun changement de forfait ni SMTP payant n'a été demandé. La tentative a été remplacée par une mise à jour limitée à la politique de mot de passe et à l'URL de retour ; les confirmations d'adresse, paramètres MFA et autres réglages existants ont été conservés.

Orbit accepte désormais un **code numérique ou le lien standard de vérification**. Pour récupérer le compte, copier le lien reçu sans l'ouvrir, puis le coller dans Orbit avec le nouveau mot de passe. Le lien est accepté uniquement s'il appartient au projet configuré, à la route Auth attendue et au bon type d'opération. Orbit transmet le hash au serveur Auth et ne suit jamais l'adresse de redirection du lien. L'adresse du compte vérifié doit correspondre à celle saisie.

Pour une inscription, l'utilisateur peut également ouvrir normalement le lien de confirmation puis revenir se connecter. Les modèles facultatifs à code restent disponibles dans `supabase/templates/` pour une future configuration SMTP.

Le SMTP intégré reste limité aux destinataires autorisés par Supabase, notamment l'équipe du projet. Il faut un SMTP externe avant d'ouvrir les inscriptions au grand public. Sources : [SMTP Supabase](https://supabase.com/docs/guides/auth/auth-smtp), [modèles d'e-mails](https://supabase.com/docs/guides/auth/auth-email-templates).

## Reste à tester ou migrer

Aucune inscription avec envoi d'e-mail réel, récupération de compte utilisateur, session Electron native complète ou installation sur machine propre n'a été exécutée. Les tests de liens utilisent un transport simulé ; les tests SQL hébergés ne remplacent pas un parcours avec deux véritables sessions Auth.

La couverture métier demeure celle de `docs/ORBIT-ACCOUNTS.md` : profil et bibliothèque de base, avec backend social, cloud complet, liaisons Steam/Epic et paiements encore à compléter. Ce déploiement ne constitue pas une publication générale d'Orbit.
