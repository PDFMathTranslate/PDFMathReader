import { ref, shallowRef } from 'vue';

export function createDocumentSessionState() {
  const pages = shallowRef([]);
  const title = ref('PDFMathReader');
  const loading = ref(false);
  const documentOpening = ref(false);
  const documentClosing = ref(false);
  const restoringView = ref(false);
  const getDocument = undefined;
  const pdfWorker = undefined;
  const pdf = undefined;
  const pendingPDFTask = undefined;
  const bytes = undefined;
  const documentId = undefined;
  const epoch = 0;
  const receivingDocuments = false;
  const closingDocument = false;
  const documentMotionController = undefined;
  const currentRecentId = null;
  const readingSaveTimer = undefined;
  const sessionTimer = undefined;
  return {
    pages,
    title,
    loading,
    documentOpening,
    documentClosing,
    restoringView,
    getDocument,
    pdfWorker,
    pdf,
    pendingPDFTask,
    bytes,
    documentId,
    epoch,
    receivingDocuments,
    closingDocument,
    documentMotionController,
    currentRecentId,
    readingSaveTimer,
    sessionTimer,
  };
}
