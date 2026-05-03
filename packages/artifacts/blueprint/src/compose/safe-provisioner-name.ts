export function safeProvisionerName(manifestName: string): string {
  if (manifestName.length === 0) {
    throw new Error('manifest name is empty');
  }
  const dropAt = manifestName.startsWith('@') ? manifestName.slice(1) : manifestName;
  return dropAt.replace(/\//g, '__');
}
