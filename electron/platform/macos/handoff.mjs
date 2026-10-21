// Shared with the iOS companion; userInfo contains no pairing secrets or file paths.
export const READING_ACTIVITY = 'org.pdfmathreader.reading';

const revisionPattern = /^[a-f0-9]{64}$/i;

export function readingActivity(value) {
  if (
    value?.version !== 1 ||
    typeof value.documentID !== 'string' ||
    !/^[a-zA-Z0-9-]{1,128}$/.test(value.documentID) ||
    !Number.isSafeInteger(value.page) ||
    value.page < 1 ||
    value.page > 1_000_000
  )
    return null;
  if (value.revision !== undefined && !revisionPattern.test(value.revision)) return null;
  return {
    version: 1,
    documentID: value.documentID,
    page: value.page,
    ...(value.revision !== undefined ? { revision: value.revision.toLowerCase() } : {}),
  };
}

export function createHandoff({
  app,
  platform = process.platform,
  current,
  resume,
  onError,
  onActivityWasContinued,
}) {
  if (platform !== 'darwin') return { refresh() {}, ready() {}, close() {} };
  let available = false;
  let pending;
  let published;
  const refresh = () => {
    const activity = available ? current() : null;
    const state = activity && readingActivity(activity);
    const serialized = state && JSON.stringify({ ...state, serverURL: activity.serverURL });
    if (serialized === published) return;
    published = serialized;
    if (state) app.setUserActivity(READING_ACTIVITY, { ...state, serverURL: activity.serverURL });
    else app.invalidateCurrentActivity();
  };
  const deliver = (activity) => {
    // Resolve only known local document IDs. Never fetch a URL supplied by Handoff.
    void Promise.resolve()
      .then(() => resume(activity))
      .catch(onError);
  };
  const willContinue = (event, type) => {
    if (type === READING_ACTIVITY) event.preventDefault();
  };
  const continueActivity = (event, type, value) => {
    if (type !== READING_ACTIVITY) return;
    event.preventDefault();
    const activity = readingActivity(value);
    if (!activity) return onError(Error('Invalid PDFMathReader Handoff activity.'));
    if (available) deliver(activity);
    else pending = activity;
  };
  const activityWasContinued = (_event, type, value) => {
    if (type !== READING_ACTIVITY) return;
    const activity = readingActivity(value);
    if (!activity) return onError(Error('Invalid PDFMathReader Handoff activity.'));
    if (typeof onActivityWasContinued !== 'function') return;
    void Promise.resolve()
      .then(() => onActivityWasContinued(activity))
      .catch(onError);
  };
  app.on('continue-activity-error', (_event, type, error) => {
    if (type === READING_ACTIVITY) onError(Error(error));
  });
  app.on('will-continue-activity', willContinue);
  app.on('continue-activity', continueActivity);
  app.on('activity-was-continued', activityWasContinued);
  app.on('browser-window-focus', refresh);
  app.on('browser-window-created', refresh);
  // Dock/app switching must not invalidate an activity while the peer resumes it.
  return {
    refresh,
    ready() {
      available = true;
      refresh();
      if (pending) deliver(pending);
      pending = null;
    },
    close() {
      available = false;
      pending = null;
      app.invalidateCurrentActivity();
      published = null;
    },
  };
}
