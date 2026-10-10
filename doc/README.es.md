[English](../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [हिन्दी](README.hi.md) · [Français](README.fr.md) · [Español](README.es.md) · [বাংলা](README.bn.md)

# <img src="icon.png" alt="icono de la aplicación PDFMathReader" style="height: 1em; width: auto;"> PDFMathReader

[![Electron compile](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml/badge.svg)](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml)
<a href="https://github.com/PDFMathTranslate/PDFMathReader/pulls">
<img src="https://img.shields.io/badge/contributions-welcome-green"></a>
<a href="../LICENSE">
<img src="https://img.shields.io/github/license/PDFMathTranslate/PDFMathReader"></a>

Lee documentos científicos en cualquier idioma, con traducción en tiempo real y en cualquier plataforma. Impulsado por [PDFMathTranslate](https://github.com/PDFMathTranslate/PDFMathTranslate).

<img src="demo.gif" alt="Demostración" width="100%">

## Funcionalidades

- **Conservación del diseño**: conserva las fórmulas, tablas e información clave, manteniendo las páginas traducidas lo más cerca posible del diseño original.
- **Traducción en tiempo real**: detecta los diseños y traduce mientras lees, sin esperar a que termine todo el documento.
- **Idiomas de la interfaz**: 16 idiomas, ordenados por el nombre del país en inglés, con el inglés como opción predeterminada. Incluye árabe, árabe egipcio, hindi, bengalí, ruso, portugués, urdu, alemán y pidgin nigeriano.
- **Opciones de traducción**: elige motores, servicios e idiomas de traducción, y traducción del documento completo o de páginas cercanas.
- **Lectura bilingüe**: haz clic en los párrafos detectados para alternar entre el texto original y la traducción.
- **Navegación flexible**: lee con miniaturas, zoom, desplazamiento vertical u horizontal y diseños de una, dos o cuatro páginas.
- **Varios documentos**: abre PDF en ventanas independientes y restaura las posiciones de lectura y la configuración de visualización al volver a abrirlos.
- **Enlaces de lectura**: guarda enlaces bidireccionales entre los resultados de búsqueda y sus orígenes en la lectura para consultarlos fácilmente.
- **Resaltados y comentarios**: resalta pasajes clave y añade comentarios para registrar tus notas de lectura.
- **Acciones de archivo**: muestra los PDF originales o completamente traducidos en Finder y envíalos con AirDrop en macOS; muéstralos en el Explorador de archivos y abre el panel nativo para compartir de Windows en Windows.

## Actualizaciones recientes

| Fecha      | Funcionalidad                                                                                                                                                              | Colaborador                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 2026-10-10 | [añadir nueve idiomas de interfaz](https://github.com/PDFMathTranslate/PDFMathReader/commit/041a09d7d9bb1035715bcc2adbb74e6fae8b391e)                                      | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [añadir acciones de archivos de Finder y AirDrop en macOS](https://github.com/PDFMathTranslate/PDFMathReader/commit/218541d7ad70ba7fb42ed4321b8d470492391073)              | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [añadir una comprobación experimental del idioma del documento con Jev](https://github.com/PDFMathTranslate/PDFMathReader/commit/00d5afbfe58b4ef689c6619c8b6c6f0faf671031) | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [restaurar las páginas traducidas antes del inicio del kernel](https://github.com/PDFMathTranslate/PDFMathReader/commit/e902a304fcd62e333e44e1a9100e19bd5b8ba386)          | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [mejorar el diseño de lectura y el comportamiento de la traducción](https://github.com/PDFMathTranslate/PDFMathReader/commit/5729cd091d34b2134ba4202392074efc3205bdbe)     | [@reycn](https://github.com/reycn) |
| 2026-10-08 | [añadir Liquid Glass y reenfoque de la traducción](https://github.com/PDFMathTranslate/PDFMathReader/commit/d68b7614328512be5cbb879dbaef48895adf8c91)                      | [@reycn](https://github.com/reycn) |
| 2026-10-08 | [personalizar los atajos y perfeccionar las interacciones del lector](https://github.com/PDFMathTranslate/PDFMathReader/commit/4b3deefab7eb854fbae0fac33cc62664469f96f1)   | [@reycn](https://github.com/reycn) |

## Inicio rápido

<table width="100%">
  <thead>
    <tr>
      <th width="10%">Plataforma</th>
      <th width="30%">macOS</th>
      <th width="30%">Windows</th>
      <th width="30%">Linux</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Captura de pantalla</td>
      <td><img src="preview.png" alt="Lector PDFMathReader" width="100%"></td>
      <td><img src="preview-windows.png" alt="Lector PDFMathReader" width="100%"></td>
      <td><img src="preview-linux.png" alt="Lector PDFMathReader en Linux" width="100%"></td>
    </tr>
    <tr>
      <td>Enlace de descarga</td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
    </tr>
    <tr>
      <td>Instalación</td>
      <td>Extrae el ZIP de macOS, mueve <code>PDFMathReader.app</code> a <code>/Applications</code> y ábrelo.</td>
      <td>Haz doble clic en <code>PDFMathReader-win32-x64.exe</code> (o en la versión <code>ia32</code> para Windows de 32 bits).</td>
      <td>Extrae el <code>.tar.gz</code> correspondiente a tu CPU y ejecuta <code>./PDFMathReader</code> desde su carpeta.</td>
    </tr>
    <tr>
      <td>Notas adicionales</td>
      <td>Si macOS indica que la aplicación está «dañada», confirma que la descarga es de confianza y ejecuta <code>sudo xattr -dr</code> <code>com.apple.quarantine</code> <code>/Applications/PDFMathReader.app</code> en Terminal. Introduce la contraseña de inicio de sesión de tu Mac cuando se solicite (no se muestra) y vuelve a abrir la aplicación.</td>
      <td>La aplicación portátil incluye su entorno de ejecución. Al iniciarla se registra el menú PDF <strong>Open with PDFMathReader</strong>; vuelve a iniciarla después de mover el ejecutable.</td>
      <td>Elige el paquete que corresponda a la arquitectura de tu CPU.</td>
    </tr>
  </tbody>
</table>
  *Debido a la disponibilidad limitada de dispositivos para las pruebas, las comprobaciones de compatibilidad en Windows y Linux se realizan periódicamente.*

## Desarrollo

<details>
<summary>Contribución</summary>

- **Herramientas**: Bun gestiona las dependencias y los scripts; Vue/Vite compilan la interfaz, mientras que Electron y Express se ejecutan en Node.js. Confirma `bun.lock` al cambiar las dependencias.
- **Pruebas**: ejecuta `bun run build` y después `bun run test`; los scripts de CI usan `node --test .github/scripts/*.test.*`. Añade cobertura de regresión específica para los cambios de comportamiento; consulta [las prioridades de las pruebas](testing.md).
- **CI**: **Estilo del código** comprueba el formato y el lint; **Empaquetado** compila y ejecuta las aplicaciones en macOS, Windows y Linux. **Publicación** publica los paquetes de la rama predeterminada cuando aumenta la versión.
- **Estilo**: ejecuta `bun run style:fix` antes de hacer commit. Husky formatea y comprueba automáticamente los archivos preparados, y bloquea los errores no resueltos. Prettier/ESLint cubren JS y Vue, Ruff cubre Python y swift-format cubre Swift; consulta [la configuración y las reglas](code-style.md).

</details>

<details>
<summary>Desarrollo local</summary>

Instala [Bun 1.3.14](https://bun.sh/docs/installation) y Node.js 22.22.1 o posterior. Para ejecutar la aplicación de escritorio desde el código fuente:

```sh
bun install --frozen-lockfile
bun run desktop
```

Compila en la plataforma correspondiente:

```sh
# macOS (requires a signing identity; add --unsigned to skip signing)
bun run package:mac
# Windows
bun run package:win
```

Las bibliotecas del frontend (Vue, MacVue y Fluent UI) son dependencias de compilación: Vite las incluye en `dist`. Las dependencias de Node utilizadas por el servidor o el proceso principal de Electron siguen siendo dependencias de ejecución. Ejecuta `bun install --frozen-lockfile` antes de compilar; una instalación solo de producción no puede compilar ni empaquetar la aplicación.

La página Acerca de incluye el estado de las actualizaciones de GitHub Release, un botón para comprobarlas manualmente y un interruptor de comprobación automática (activado de forma predeterminada). Las aplicaciones empaquetadas comprueban las actualizaciones de forma diferida después del inicio y cada seis horas; la ausencia de una versión publicada se muestra como un estado vacío normal. Las etiquetas de versión estables deben usar `vX.Y.Z` o `X.Y.Z`. Los activos de versión correspondientes usan `PDFMathReader-<platform>-<arch>.zip` (macOS), `.exe` (Windows) o `.tar.gz` (Linux). Las actualizaciones disponibles abren la descarga correspondiente, o la página de la versión cuando falta ese activo; la instalación sigue siendo manual.

La página Acerca de muestra la aplicación y las versiones de los kernels instalados y de UV. Cada compilación de Vite integra `dist/build-info.json` con la versión del paquete y los diez últimos commits convencionales `feat` (incluidas las funcionalidades con ámbito y las que introducen cambios incompatibles); la CI de publicación obtiene todo el historial de Git. La aplicación instalada lee esta instantánea sin acceso a Git ni a la red. Las compilaciones realizadas desde un archivo fuente sin Git muestran una lista de actualizaciones vacía.

El paquete predeterminado de Electron agrupa Express y las utilidades PDF en los scripts del backend y del proceso principal, conservando sus licencias. Solo copia los módulos de ejecución externos en el `node_modules` preparado; los enlaces nativos de PDF Inspector y la alternativa de PDF.js/DOMMatrix para destinos nativos no compatibles siguen disponibles. Electron y las herramientas de empaquetado las proporciona la cadena de herramientas de compilación.

Para el desarrollo en el navegador, define `OPENAI_API_KEY`, ejecuta `bun run dev` y abre [127.0.0.1:5173](http://127.0.0.1:5173). Usa `OPENAI_MODEL` para sustituir el modelo predeterminado. Las variables de entorno del escritorio se pueden cargar con `Launch PDFMathReader.command`.

```sh
bun run test
bun run build
```

La suite de la aplicación contiene 29 pruebas centradas en riesgos. Consulta [las prioridades de las pruebas](testing.md) para conocer la cobertura conservada y la política para añadir casos.

</details>

<details>
<summary>Detalles</summary>

PDFMathReader usa Vue 3 y PDF.js para el lector, Electron para la aplicación de escritorio y Express para el backend local. Vite permite el desarrollo y las compilaciones del frontend; pdf-lib gestiona la manipulación de PDF.

Cada ventana de escritorio tiene su propio renderer y backend ejecutándose en un proceso de utilidad de Electron. El proceso principal gestiona las ventanas, los menús, las credenciales, los documentos recientes y las preferencias. Un preload aislado proporciona la IPC de escritorio; las solicitudes al backend usan HTTP autenticado en `127.0.0.1`.

El renderizado, el análisis del diseño y la traducción se ejecutan de forma independiente. Las páginas y las miniaturas están virtualizadas, PDF.js y el análisis del diseño se cargan bajo demanda y las cachés de renderizado tienen un uso de memoria limitado. Cada documento se carga una vez en su backend local; las solicitudes posteriores utilizan su ID de documento. Los trabajos de traducción obsoletos se cancelan cuando cambia el documento, el idioma o el kernel.

El texto traducido se almacena en caché entre documentos y reinicios de la aplicación. Las solicitudes idénticas al mismo servicio y modelo reutilizan el resultado guardado, incluidas las solicitudes procedentes de los kernels de traducción matemática. Los idiomas, prompts y demás opciones de traducción forman parte de la clave de caché. Las solicitudes idénticas simultáneas comparten una sola llamada al servicio; las respuestas fallidas o vacías no se almacenan en caché.

| Configuración | Motor                 | Resultado                                            |
| ------------- | --------------------- | ---------------------------------------------------- |
| Ultrarrápido  | PDF Inspector         | Superposiciones de párrafos sobre el PDF original    |
| Rápido        | PDFMathTranslate      | Páginas PDF traducidas con conservación de fórmulas  |
| Preciso       | PDFMathTranslate-next | Páginas PDF traducidas con composición más detallada |

El renderizado de PDF y el análisis del diseño permanecen locales. La traducción envía el texto del documento a OpenAI y puede generar cargos de API. Rápido y Preciso se ejecutan en entornos Python independientes gestionados por la aplicación e instalados con `uv`, y acceden a OpenAI mediante el proxy del backend. Las claves de API permanecen fuera del renderer.

Las claves de escritorio guardadas se cifran con `safeStorage` de Electron y la protección del Llavero de macOS. Una clave guardada sustituye a `OPENAI_API_KEY`; al borrarla se restaura el valor alternativo del entorno. Guardar está desactivado cuando el almacenamiento seguro no está disponible.

Los datos del escritorio se almacenan en el directorio de la aplicación, bajo `~/Library/Application Support/`: credenciales, documentos recientes, cachés de traducción y diseño y entornos de los kernels. Las cachés del desarrollo en el navegador usan `.cache/translations/`. Las cachés y los PDF temporales pueden contener contenido de los documentos; **Clear** en la página de inicio elimina únicamente el historial de documentos recientes.

En el desarrollo en el navegador, Express y Vite se ejecutan en un proceso independiente de Node.js. Los menús nativos, la IPC de escritorio y el almacenamiento seguro de claves de escritorio solo están disponibles en la aplicación de escritorio.

</details>

<details>
<summary>Limitaciones</summary>

- **Compatibilidad de plataformas**: macOS es la plataforma probada. Windows y Linux tienen estilos específicos de cada plataforma, pero la validación del runtime nativo está pendiente. Los comandos de empaquetado apuntan a macOS arm64 y Windows x64.
- **Fidelidad del diseño**: Ultrarrápido usa agrupación geométrica de párrafos y superposiciones de texto. Las tablas complejas, el texto girado, los fondos inusuales y las traducciones largas pueden no conservar la tipografía original. El resultado de los kernels matemáticos depende de la gestión del diseño en el proyecto ascendente.
- **Documentos escaneados**: los PDF escaneados requieren OCR, que esta aplicación no implementa.
- **Requisitos de traducción**: la traducción necesita una clave de API de OpenAI y acceso a la red. Rápido y Preciso requieren kernels matemáticos instalados por separado mediante `uv`.
- **Alcance**: es una aplicación local de lectura y traducción, no una herramienta completa de edición o exportación de PDF.
- **Validación**: las [30 pruebas de regresión principales](core-tests.md) cubren la lógica de compatibilidad del backend y del lector. Las comprobaciones con proveedores simulados no demuestran la calidad de la traducción de OpenAI en vivo ni la validez de la clave de API.

</details>

## Artículo

El trabajo en el que se basa este proyecto ha sido aceptado por los [_Proceedings of the 2025 Conference on Empirical Methods in Natural Language Processing: System Demonstrations_](https://aclanthology.org/2025.emnlp-demos.71/) (EMNLP 2025).

Cita:

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

## Licencia

PDFMathReader está sujeto a la licencia GNU Affero General Public License, versión 3. Consulta [LICENSE](../LICENSE) para ver el texto completo. Las dependencias conservan sus respectivas licencias.

## Agradecimientos

Muchas gracias a [OpenAI](https://openai.com/), [Anthropic](https://www.anthropic.com/), [Warp](https://www.warp.dev/), [Immersive Translate](https://immersivetranslate.com/) y [SiliconFlow](https://siliconflow.cn/) por su apoyo.
