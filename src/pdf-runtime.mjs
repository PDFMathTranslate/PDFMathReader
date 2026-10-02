import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
let runtime;
export function loadPDFRuntime(){return runtime??=import('pdfjs-dist').then(pdf=>{pdf.GlobalWorkerOptions.workerSrc=workerUrl;return pdf;}).catch(error=>{runtime=undefined;throw error;});}
