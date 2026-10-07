// The immutable build snapshot is shared across About page mounts.
let pending;
export function loadBuildInfo() {
  return (pending ??= fetch('/build-info.json')
    .then((response) => {
      if (!response.ok) throw Error('Build information unavailable');
      return response.json();
    })
    .catch((error) => {
      pending = undefined;
      throw error;
    }));
}
