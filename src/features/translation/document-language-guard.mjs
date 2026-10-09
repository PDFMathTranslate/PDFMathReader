// A document-scoped check shared by concurrent automatic translation requests.
export function createDocumentLanguageGuard({ session, preferences, api }) {
  let current;
  return async function allowAutomaticTranslation() {
    if (!preferences.documentLanguageDetection?.value) return true;
    const pdf = session.pdf;
    if (!pdf) return true;
    const epoch = session.epoch;
    const sourceLanguage = preferences.sourceLanguage.value;
    const token = preferences.jevApiToken.value;
    if (
      current?.pdf === pdf &&
      current.epoch === epoch &&
      current.sourceLanguage === sourceLanguage &&
      current.token === token
    )
      return current.promise;
    const entry = { pdf, epoch, sourceLanguage, token };
    current = entry;
    entry.promise = (async () => {
      let timer;
      let expired = false;
      const fresh = () =>
        !expired &&
        current === entry &&
        session.pdf === pdf &&
        session.epoch === epoch &&
        preferences.documentLanguageDetection.value &&
        preferences.sourceLanguage.value === sourceLanguage &&
        preferences.jevApiToken.value === token;
      try {
        const result = await Promise.race([
          (async () => {
            const samples = [];
            for (let number = 1; number <= Math.min(3, pdf.numPages); number++) {
              if (!fresh()) return null;
              const page = await pdf.getPage(number);
              const content = await page.getTextContent();
              let sample = '';
              for (const item of content.items) {
                if (typeof item.str !== 'string') continue;
                sample = Array.from(sample + (sample ? ' ' : '') + item.str)
                  .slice(0, 100)
                  .join('');
                if (Array.from(sample).length >= 100) break;
              }
              samples.push(sample);
            }
            // Recheck freshness before sending any document content.
            if (!fresh()) return null;
            return api('/api/document-language', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ samples, sourceLanguage, token }),
            });
          })(),
          new Promise((resolve) => {
            timer = setTimeout(() => {
              expired = true;
              resolve(null);
            }, 6000);
          }),
        ]);
        return !fresh() || result?.skipAutomaticTranslation !== true;
      } catch {
        return true;
      } finally {
        clearTimeout(timer);
      }
    })();
    return entry.promise;
  };
}
