[English](../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [हिन्दी](README.hi.md) · [Français](README.fr.md) · [Español](README.es.md) · [বাংলা](README.bn.md)

# <img src="icon.png" alt="icône de l’application PDFMathReader" style="height: 1em; width: auto;"> PDFMathReader

[![Electron compile](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml/badge.svg)](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml)
<a href="https://github.com/PDFMathTranslate/PDFMathReader/pulls">
<img src="https://img.shields.io/badge/contributions-welcome-green"></a>
<a href="../LICENSE">
<img src="https://img.shields.io/github/license/PDFMathTranslate/PDFMathReader"></a>

Lisez des documents scientifiques dans n’importe quelle langue, avec une traduction en temps réel, sur toutes les plateformes. Propulsé par [PDFMathTranslate](https://github.com/PDFMathTranslate/PDFMathTranslate).

<img src="demo.gif" alt="Démonstration" width="100%">

## Fonctionnalités

- **Préservation de la mise en page** : préservez les formules, les tableaux et les informations importantes tout en conservant aux pages traduites une mise en page proche de l’original.
- **Traduction en temps réel** : détectez la mise en page et traduisez au fil de la lecture, sans attendre que le document entier soit traité.
- **Langues de l’interface** : 16 langues, classées selon le nom anglais des pays, avec l’anglais comme langue par défaut. Sont inclus l’arabe, l’arabe égyptien, l’hindi, le bengali, le russe, le portugais, l’ourdou, l’allemand et le pidgin nigérian.
- **Options de traduction** : choisissez les moteurs, les services et les langues de traduction, ainsi qu’une traduction du document entier ou des pages voisines.
- **Lecture bilingue** : cliquez sur les paragraphes détectés pour basculer entre le texte original et la traduction.
- **Navigation flexible** : lisez avec des miniatures, un zoom, un défilement vertical ou horizontal et des mises en page à une, deux ou quatre pages.
- **Documents multiples** : ouvrez des PDF dans des fenêtres indépendantes et restaurez les positions de lecture et les paramètres d’affichage lors de leur réouverture.
- **Liens de lecture** : enregistrez des liens bidirectionnels entre les résultats de recherche et leurs emplacements d’origine dans la lecture pour les retrouver facilement.
- **Surlignages et commentaires** : surlignez les passages importants et ajoutez des commentaires pour consigner vos notes de lecture.
- **Actions sur les fichiers** : affichez les PDF originaux ou entièrement traduits dans le Finder et envoyez-les avec AirDrop sur macOS ; affichez-les dans l’Explorateur de fichiers et ouvrez le panneau de partage natif de Windows sur Windows.

## Mises à jour récentes

| Date       | Fonctionnalité                                                                                                                                                                | Contributeur                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 2026-10-10 | [ajouter neuf langues d’interface](https://github.com/PDFMathTranslate/PDFMathReader/commit/041a09d7d9bb1035715bcc2adbb74e6fae8b391e)                                         | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [ajouter les actions de fichiers Finder et AirDrop sur macOS](https://github.com/PDFMathTranslate/PDFMathReader/commit/218541d7ad70ba7fb42ed4321b8d470492391073)              | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [ajouter une vérification expérimentale de la langue du document avec Jev](https://github.com/PDFMathTranslate/PDFMathReader/commit/00d5afbfe58b4ef689c6619c8b6c6f0faf671031) | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [restaurer les pages traduites avant le démarrage du noyau](https://github.com/PDFMathTranslate/PDFMathReader/commit/e902a304fcd62e333e44e1a9100e19bd5b8ba386)                | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [améliorer la mise en page de lecture et le comportement de la traduction](https://github.com/PDFMathTranslate/PDFMathReader/commit/5729cd091d34b2134ba4202392074efc3205bdbe) | [@reycn](https://github.com/reycn) |
| 2026-10-08 | [ajouter le verre liquide et le recentrage de la traduction](https://github.com/PDFMathTranslate/PDFMathReader/commit/d68b7614328512be5cbb879dbaef48895adf8c91)               | [@reycn](https://github.com/reycn) |
| 2026-10-08 | [personnaliser les raccourcis et affiner les interactions du lecteur](https://github.com/PDFMathTranslate/PDFMathReader/commit/4b3deefab7eb854fbae0fac33cc62664469f96f1)      | [@reycn](https://github.com/reycn) |

## Démarrage rapide

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
  *En raison du nombre limité d’appareils disponibles pour les tests, les vérifications de compatibilité sur Windows et Linux sont effectuées périodiquement.*

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
# macOS (requires a signing identity; add --unsigned to skip signing)
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

Le rendu PDF et l’analyse de la mise en page restent locaux. La traduction envoie le texte du document à OpenAI et peut entraîner des frais d’API. Les modes Rapide et Précis s’exécutent dans des environnements Python distincts gérés par l’application et installés avec `uv`, et accèdent à OpenAI par l’intermédiaire du proxy backend. Les clés d’API restent en dehors du renderer.

Les clés de bureau enregistrées sont chiffrées avec `safeStorage` d’Electron et protégées par le trousseau macOS. Une clé enregistrée remplace `OPENAI_API_KEY` ; sa suppression rétablit la valeur de repli de l’environnement. L’enregistrement est désactivé lorsque le stockage sécurisé n’est pas disponible.

Les données de bureau sont stockées dans le répertoire de l’application sous `~/Library/Application Support/` : identifiants, documents récents, caches de traduction et de mise en page et environnements des noyaux. Les caches du développement dans le navigateur utilisent `.cache/translations/`. Les caches et les PDF temporaires peuvent contenir le contenu des documents ; **Clear** sur la page de démarrage supprime uniquement l’historique des documents récents.

Dans le développement dans le navigateur, Express et Vite s’exécutent dans un processus Node.js autonome. Les menus natifs, l’IPC de bureau et le stockage sécurisé des clés de bureau ne sont disponibles que dans l’application de bureau.

</details>

<details>
<summary>Limitations</summary>

- **Prise en charge des plateformes** : macOS est la plateforme testée. Windows et Linux disposent de styles propres à chaque plateforme, mais la validation du runtime natif est en attente. Les commandes d’empaquetage ciblent macOS arm64 et Windows x64.
- **Fidélité de la mise en page** : Ultra rapide utilise un regroupement géométrique des paragraphes et des superpositions de texte. Les tableaux complexes, le texte pivoté, les arrière-plans inhabituels et les traductions longues peuvent ne pas conserver la typographie originale. Le résultat des noyaux mathématiques dépend de la gestion de la mise en page en amont.
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

PDFMathReader est distribué sous la licence GNU Affero General Public License, version 3. Consultez [LICENSE](../LICENSE) pour le texte intégral. Les dépendances conservent leurs licences respectives.

## Remerciements

Un grand merci à [OpenAI](https://openai.com/), [Anthropic](https://www.anthropic.com/), [Warp](https://www.warp.dev/), [Immersive Translate](https://immersivetranslate.com/) et [SiliconFlow](https://siliconflow.cn/) pour leur soutien.
