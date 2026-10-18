[English](../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [हिन्दी](README.hi.md) · [Français](README.fr.md) · [Español](README.es.md) · [বাংলা](README.bn.md) · [한국어](README.ko.md)

# <img src="icon.png" alt="icône de l’application PDFMathReader" style="height: 1em; width: auto;"> PDFMathReader

[![Electron compile](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml/badge.svg)](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml)
<a href="https://github.com/PDFMathTranslate/PDFMathReader/pulls">
<img src="https://img.shields.io/badge/contributions-welcome-green"></a>
<a href="../LICENSE">
<img src="https://img.shields.io/github/license/PDFMathTranslate/PDFMathReader"></a>

Lisez des documents scientifiques dans votre langue, en temps réel, sur toutes les plateformes.
Propulsé par [PDFMathTranslate](https://github.com/PDFMathTranslate/PDFMathTranslate) et par une intelligence artificielle de pointe.

<img src="demo.gif" alt="Démonstration" width="100%">

## Fonctionnalités

- **Lire des documents traduits en préservant la mise en page** : conservez intactes les formules, les tableaux et les autres éléments essentiels.
- **Commencer à lire sans attendre** : détectez la mise en page et traduisez le contenu au fil de votre lecture.
- **Lire dans la langue de votre choix** : choisissez parmi une large gamme de langues d’interface, de source et de destination, avec des options de personnalisation supplémentaires.
- **Choisir votre service de traduction préféré** :
  - Connectez-vous aux principaux fournisseurs d’IA.
  - Utilisez des services personnalisés via des API compatibles avec OpenAI.
  - Accédez gratuitement à la traduction grâce à nos partenariats, afin de rendre la lecture multilingue plus accessible.
- **Conserver vos notes avec votre lecture** : surlignez des passages et ajoutez des commentaires dans les documents originaux comme dans les documents traduits.
- **Naviguer efficacement** :
  - Explorez les documents grâce aux miniatures, aux liens rapides, à la recherche, aux plans, aux numéros de page et aux vues en galerie.
  - Choisissez parmi plusieurs mises en page de lecture.
  - Organisez votre travail entre plusieurs fenêtres et onglets.
- **Adapter l’expérience de lecture** :
  - Mettez automatiquement en évidence les phrases thématiques, les résultats scientifiques et les liens logiques.
  - Ajustez le comportement de la traduction selon votre flux de travail.
  - Personnalisez les polices, les icônes, les couleurs d’accent et le mode sombre.
  - Trouvez le meilleur équilibre entre vitesse et qualité de détection de la mise en page.
  - Activez le défilement fluide.
- **Faciliter le suivi du texte** :
  - Mettez en évidence les termes distinctifs grâce à la pondération TF-IDF.
  - Activez la lecture bionique avec une mise en évidence de longueur fixe ou des racines des mots.
- **Garder votre flux de travail ouvert** : partagez et modifiez des fichiers entre applications et appareils ; par exemple, utilisez AirDrop pour continuer votre lecture sur un appareil mobile.
- **Profiter d’une interface familière sur toutes les plateformes** : lisez sur macOS, Windows, Linux et iOS.

## Mises à jour récentes

| Date       | Fonctionnalité                                                                                                                                                                          | Contributeur                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 2026-10-17 | [raccourcir les codes d’association avec les appareils compagnons à huit caractères](https://github.com/PDFMathTranslate/PDFMathReader/commit/5bec25f69a04c0a7cb8811f1faed6ada1a84ba52) | [@reycn](https://github.com/reycn) |
| 2026-10-17 | [ajouter une option réservée à la souris pour forcer le défilement fluide](https://github.com/PDFMathTranslate/PDFMathReader/commit/b90ebdd8f2311d1060af6882ea20bc1c90404a8f)           | [@reycn](https://github.com/reycn) |
| 2026-10-17 | [ajouter les icônes des applications Art et Zotero et actualiser l’icône moderne](https://github.com/PDFMathTranslate/PDFMathReader/commit/ea8fc7a0787fe67788e6501d5fffba02f6869e76)    | [@reycn](https://github.com/reycn) |
| 2026-10-17 | [poursuivre les traductions en mode service lorsque les fenêtres sont réduites](https://github.com/PDFMathTranslate/PDFMathReader/commit/b77dccaaefd92cfd145781c1b9164b67f02adf2b)      | [@reycn](https://github.com/reycn) |
| 2026-10-16 | [partager les noyaux avec les appareils distants et afficher les clients connectés](https://github.com/PDFMathTranslate/PDFMathReader/commit/6ecb48f5759d1eda69470c54d6236cbbe43b8204)  | [@reycn](https://github.com/reycn) |
| 2026-10-16 | [copier la sélection ou l’annotation ciblée avec Cmd+C et afficher une notification](https://github.com/PDFMathTranslate/PDFMathReader/commit/b9e5cc82b22dee2ae35160df31db9dadace538ac) | [@reycn](https://github.com/reycn) |
| 2026-10-16 | [ajouter un sélecteur d’icône d’application aux réglages d’apparence](https://github.com/PDFMathTranslate/PDFMathReader/commit/729755524d0e3cf3464d0ebbf0020e8fb9ddf90d)                | [@reycn](https://github.com/reycn) |

## Démarrage rapide

### Bureau

<table width="100%">
  <thead>
    <tr>
      <th width="10%">Plateforme</th>
      <th width="30%">macOS</th>
      <th width="30%">Windows</th>
      <th width="30%">Linux</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Capture d’écran</td>
      <td><img src="preview.png" alt="Lecteur PDFMathReader" width="100%"></td>
      <td><img src="preview-windows.png" alt="Lecteur PDFMathReader" width="100%"></td>
      <td><img src="preview-linux.png" alt="Lecteur PDFMathReader sous Linux" width="100%"></td>
    </tr>
    <tr>
      <td>Lien de téléchargement</td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
    </tr>
    <tr>
      <td>Installation</td>
      <td>Décompressez le ZIP macOS, déplacez <code>PDFMathReader.app</code> vers <code>/Applications</code>, puis ouvrez-le.</td>
      <td>Double-cliquez sur <code>PDFMathReader-win32-x64.exe</code> (ou sur la version <code>ia32</code> pour Windows 32 bits).</td>
      <td>Décompressez le fichier <code>.tar.gz</code> correspondant à votre processeur, puis exécutez <code>./PDFMathReader</code> depuis son dossier.</td>
    </tr>
    <tr>
      <td>Remarques supplémentaires</td>
      <td>Si macOS indique que l’application est « endommagée », vérifiez que le téléchargement est fiable, puis exécutez <code>sudo xattr -dr</code> <code>com.apple.quarantine</code> <code>/Applications/PDFMathReader.app</code> dans le Terminal. Saisissez le mot de passe de connexion de votre Mac lorsqu’il est demandé (il ne s’affiche pas), puis rouvrez l’application.</td>
      <td>L’application portable inclut son environnement d’exécution. Son lancement enregistre le menu PDF <strong>Open with PDFMathReader</strong> ; relancez-la après avoir déplacé l’exécutable.</td>
      <td>Choisissez le paquet correspondant à l’architecture de votre processeur.</td>
    </tr>
  </tbody>
</table>
  *En raison du nombre limité d’appareils disponibles pour les tests, les vérifications de compatibilité sur Windows et Linux sont effectuées périodiquement (contributions bienvenues).*

### Mobile

- **iOS** : [fourni dans ce dépôt](https://github.com/PDFMathTranslate/PDFMathReader-iOS), avec un design familier pour les clients de bureau
- **Android** : (contributions bienvenues)

## Développement

<details>
<summary>Contribution</summary>

- **Outils** : Bun gère les dépendances et les scripts ; Vue/Vite construisent l’interface, tandis qu’Electron et Express s’exécutent sur Node.js. Validez `bun.lock` lorsque vous modifiez les dépendances.
- **Tests** : exécutez `bun run build`, puis `bun run test` ; les scripts CI utilisent `node --test .github/scripts/*.test.*`. Ajoutez une couverture de régression ciblée pour les changements de comportement ; consultez [les priorités des tests](testing.md).
- **CI** : **Style du code** vérifie le formatage et le linting ; **Empaquetage** construit et lance les applications sur macOS, Windows et Linux. **Publication** publie les paquets de la branche par défaut lorsque la version augmente.
- **Style** : exécutez `bun run style:fix` avant de valider. Husky formate et vérifie automatiquement les fichiers indexés, en bloquant les erreurs non résolues. Prettier/ESLint couvrent JS et Vue, Ruff couvre Python et swift-format couvre Swift ; consultez [la configuration et les règles](code-style.md).

</details>

<details>
<summary>Développement local</summary>

Installez [Bun 1.3.14](https://bun.sh/docs/installation) et Node.js 22.22.1 ou une version ultérieure. Pour exécuter l’application de bureau depuis les sources :

```sh
bun install --frozen-lockfile
bun run desktop
```

Construisez sur la plateforme correspondante :

```sh
# macOS (nécessite une identité de signature ; ajoutez --unsigned pour ignorer la signature)
bun run package:mac
# Windows
bun run package:win
```

Les bibliothèques frontend (Vue, MacVue et Fluent UI) sont des dépendances de build : Vite les inclut dans `dist`. Les dépendances Node utilisées par le serveur ou le processus principal d’Electron restent des dépendances d’exécution. Exécutez `bun install --frozen-lockfile` avant la construction ; une installation limitée à la production ne peut pas construire ni empaqueter l’application.

La page À propos inclut l’état des mises à jour des versions GitHub Release, un bouton de vérification manuelle et un commutateur de vérification automatique (activé par défaut). Les applications empaquetées vérifient les mises à jour de manière différée après le démarrage, puis toutes les six heures ; l’absence de version publiée est affichée comme un état normal sans mise à jour. Les balises de version stables doivent utiliser `vX.Y.Z` ou `X.Y.Z`. Les fichiers de version correspondants utilisent `PDFMathReader-<platform>-<arch>.zip` (macOS), `.exe` (Windows) ou `.tar.gz` (Linux). Les mises à jour disponibles ouvrent le téléchargement correspondant, ou la page de publication lorsque ce fichier est absent ; l’installation reste manuelle.

La page À propos affiche l’application ainsi que les versions des noyaux installés et d’UV. Chaque build Vite intègre `dist/build-info.json` avec la version du paquet et les dix derniers commits conventionnels `feat` (y compris les fonctionnalités avec portée et les fonctionnalités rompant la compatibilité) ; la CI de publication récupère tout l’historique Git. L’application installée lit cet instantané sans accès à Git ni au réseau. Les builds réalisés depuis une archive source sans Git affichent une liste de mises à jour vide.

Le paquet Electron par défaut regroupe Express et les utilitaires PDF dans les scripts du backend et du processus principal, tout en conservant leurs licences. Il ne copie que les modules d’exécution externes dans le `node_modules` intermédiaire ; les liaisons natives de PDF Inspector ainsi que la solution de secours PDF.js/DOMMatrix pour les cibles natives non prises en charge restent disponibles. Electron lui-même et les outils d’empaquetage sont fournis par la chaîne d’outils de build.

Pour le développement dans le navigateur, définissez `OPENAI_API_KEY`, exécutez `bun run dev` et ouvrez [127.0.0.1:5173](http://127.0.0.1:5173). Utilisez `OPENAI_MODEL` pour remplacer le modèle par défaut. Les variables d’environnement du bureau peuvent être chargées avec `Launch PDFMathReader.command`.

```sh
bun run test
bun run build
```

La suite de l’application contient 29 tests axés sur les risques. Consultez [les priorités des tests](testing.md) pour connaître la couverture conservée et la politique d’ajout de cas.

</details>

<details>
<summary>Détails</summary>

PDFMathReader utilise Vue 3 et PDF.js pour le lecteur, Electron pour l’application de bureau et Express pour le backend local. Vite prend en charge le développement et les builds frontend ; pdf-lib gère la manipulation des PDF.

Chaque fenêtre de bureau possède son propre renderer et son propre backend exécuté dans un processus utilitaire Electron. Le processus principal gère les fenêtres, les menus, les identifiants, les documents récents et les préférences. Un preload isolé fournit l’IPC de bureau ; les requêtes du backend utilisent HTTP authentifié sur `127.0.0.1`.

Le rendu, l’analyse de la mise en page et la traduction s’exécutent indépendamment. Les pages et les miniatures sont virtualisées, PDF.js et l’analyse de la mise en page sont chargés à la demande et les caches de rendu utilisent une quantité de mémoire limitée. Chaque document est téléversé une fois vers son backend local ; les requêtes suivantes utilisent son identifiant de document. Les travaux de traduction obsolètes sont annulés lorsque le document, la langue ou le noyau change.

Le texte traduit est mis en cache entre les documents et les redémarrages de l’application. Les requêtes identiques vers le même service et le même modèle réutilisent le résultat enregistré, y compris les requêtes provenant des noyaux de traduction mathématique. Les langues, les invites et les autres options de traduction font partie de la clé du cache. Les requêtes identiques concurrentes partagent un seul appel au service ; les réponses échouées ou vides ne sont pas mises en cache.

| Paramètre    | Moteur                | Résultat                                                |
| ------------ | --------------------- | ------------------------------------------------------- |
| Ultra rapide | PDF Inspector         | Superpositions de paragraphes sur le PDF original       |
| Rapide       | PDFMathTranslate      | Pages PDF traduites avec conservation des formules      |
| Précis       | PDFMathTranslate-next | Pages PDF traduites avec une composition plus détaillée |

La détection expérimentale de la continuation des paragraphes par Jev est disponible avec les modes Ultra rapide et Rapide. Le mode Rapide regroupe les fragments adjacents confirmés dans une même colonne avant la traduction et la composition, en conservant les formules à leur place. Les vérifications incertaines ou échouées conservent des fragments séparés. Son activation utilise des caches de pages distincts afin de régénérer les résultats produits avant la fusion.

Expérimental : Settings → Experimental → Generate table of contents ajoute Edit → Generate Table of Contents, qui crée localement une table des matières pour les documents dépourvus de signets, avec une progression affichée dans la barre latérale Contents. Il analyse une page de table des matières imprimée (y compris les points de conduite et les numéros de page alignés à droite) et associe ses numéros de page aux pages physiques ; en l’absence d’une telle page, il déduit les titres à partir des tailles de police, de la numérotation et de l’espacement. Rien n’est envoyé. Les pages numérisées sans couche de texte ne sont pas prises en charge et les tables des matières générées ne sont pas enregistrées avec le document.

Expérimental : le mode Précis peut également traduire via un serveur distant [zotero-pdf2zh](https://github.com/guaguastandup/zotero-pdf2zh) sur HTTP (Settings → Experimental). PDFMathReader implémente le protocole HTTP de ce serveur en tant que client ; le serveur n’est pas inclus et reste facultatif. Le noyau distant est utilisé uniquement lorsque la vérification `/health` du serveur réussit ; sinon, le noyau local Précis est utilisé. Aucune clé d’API n’est envoyée ; le serveur utilise son propre service de traduction. Les pages distantes ne possèdent pas de couche de texte de lecture, et le service de traduction ainsi que les glossaires sélectionnés ne sont pas utilisés pour les pages traduites à distance.

Le rendu PDF et l’analyse de la mise en page restent locaux. La traduction envoie le texte du document à OpenAI et peut entraîner des frais d’API. Les modes Rapide et Précis s’exécutent dans des environnements Python distincts gérés par l’application et installés avec `uv`, et accèdent à OpenAI par l’intermédiaire du proxy backend. Les clés d’API restent en dehors du renderer.

Les clés de bureau enregistrées sont chiffrées avec `safeStorage` d’Electron et protégées par le trousseau macOS. Une clé enregistrée remplace `OPENAI_API_KEY` ; sa suppression rétablit la valeur de repli de l’environnement. L’enregistrement est désactivé lorsque le stockage sécurisé n’est pas disponible.

Les données de bureau sont stockées dans le répertoire de l’application sous `~/Library/Application Support/` : identifiants, documents récents, caches de traduction et de mise en page et environnements des noyaux. Les caches du développement dans le navigateur utilisent `.cache/translations/`. Les caches et les PDF temporaires peuvent contenir le contenu des documents ; **Clear** sur la page de démarrage supprime uniquement l’historique des documents récents.

Dans le développement dans le navigateur, Express et Vite s’exécutent dans un processus Node.js autonome. Les menus natifs, l’IPC de bureau et le stockage sécurisé des clés de bureau ne sont disponibles que dans l’application de bureau.

</details>

<details>
<summary>Limitations</summary>

- **Prise en charge des plateformes** : macOS est la plateforme testée. Windows et Linux disposent de styles propres à chaque plateforme, mais la validation du runtime natif est en attente. Les commandes d’empaquetage ciblent macOS arm64 et Windows x64.
- **Fidélité de la mise en page** : le mode Ultra rapide utilise un regroupement géométrique des paragraphes et des superpositions de texte. Les tableaux complexes, le texte pivoté, les arrière-plans inhabituels et les traductions longues peuvent ne pas conserver la typographie originale. Le résultat des noyaux mathématiques dépend de la gestion de la mise en page en amont.
- **Documents numérisés** : les PDF numérisés nécessitent un OCR, que cette application n’implémente pas.
- **Exigences de traduction** : la traduction nécessite une clé d’API OpenAI et un accès réseau. Les modes Rapide et Précis nécessitent des noyaux mathématiques installés séparément avec `uv`.
- **Périmètre** : il s’agit d’une application locale de lecture et de traduction, et non d’un outil complet d’édition ou d’exportation de PDF.
- **Validation** : les [30 tests de régression principaux](core-tests.md) couvrent la logique de prise en charge du backend et du lecteur. Les vérifications avec un fournisseur simulé n’établissent ni la qualité de la traduction OpenAI en direct ni la validité de la clé d’API.

</details>

## Article

Les travaux à la base de ce projet ont été acceptés par les [_Proceedings of the 2025 Conference on Empirical Methods in Natural Language Processing: System Demonstrations_](https://aclanthology.org/2025.emnlp-demos.71/) (EMNLP 2025).

Citation :

```
@inproceedings{ouyang-etal-2025-pdfmathtranslate,
	    title = "{PDFM}ath{T}ranslate: Scientific Document Translation Preserving Layouts",
	    author = "Ouyang, Rongxin  and
	      Chu, Chang  and
	      Xin, Zhikuang  and
	      Ma, Xiangyao",
	    editor = {Habernal, Ivan  and
	      Schulam, Peter  and
	      Tiedemann, J{\"o}rg},
	    booktitle = "Proceedings of the 2025 Conference on Empirical Methods in Natural Language Processing: System Demonstrations",
	    month = nov,
	    year = "2025",
	    address = "Suzhou, China",
	    publisher = "Association for Computational Linguistics",
	    url = "https://aclanthology.org/2025.emnlp-demos.71/",
	    pages = "918--924",
	    ISBN = "979-8-89176-334-0",
	    abstract = "Language barriers in scientific documents hinder the diffusion and development of science and technologies. However, prior efforts in translating such documents largely overlooked the information in layouts. To bridge the gap, we introduce PDFMathTranslate, the world{'}s first open-source software for translating scientific documents while preserving layouts. Leveraging the most recent advances in large language models and precise layout detection, we contribute to the community with key improvements in precision, flexibility, and efficiency. The work is open-sourced at https://github.com/byaidu/pdfmathtranslate with more than 222k downloads."
	}
```

## Licence

PDFMathReader est distribué sous la licence GNU Affero General Public License, version 3. Consultez [LICENSE](../LICENSE) pour le texte intégral. Les dépendances conservent leurs licences respectives, notamment [PDFMathTranslate](https://github.com/PDFMathTranslate/PDFMathTranslate), [PDFMathTranslate-next](https://github.com/PDFMathTranslate-next/PDFMathTranslate-next) et [zotero-pdf2zh](https://github.com/guaguastandup/zotero-pdf2zh) (AGPL-3.0, protocole de noyau distant facultatif).

## Remerciements

Un grand merci à [OpenAI](https://openai.com/), [Anthropic](https://www.anthropic.com/), [Warp](https://www.warp.dev/), [Immersive Translate](https://immersivetranslate.com/) et [SiliconFlow](https://siliconflow.cn/) pour leur soutien.
