export function photoKey(file) {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
}

export function matchesShootPhotos(shoot, files) {
  const original = shoot.selectedFileKeys || [];
  const selected = files.map(photoKey).sort();
  return (
    original.length === files.length &&
    [...original].sort().every((key, index) => key === selected[index])
  );
}

export function previouslyUploadedIndexes(shoot, files) {
  const counts = new Map();
  for (const key of shoot.uploadedFileKeys || [])
    counts.set(key, (counts.get(key) || 0) + 1);
  const uploaded = new Set();
  files.forEach((file, index) => {
    const key = photoKey(file);
    const remaining = counts.get(key) || 0;
    if (remaining > 0) {
      uploaded.add(index);
      counts.set(key, remaining - 1);
    }
  });
  return uploaded;
}
