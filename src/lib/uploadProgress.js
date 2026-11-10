export function uploadPercent(shoot) {
  if (shoot.uploadStatus === "ready") return 100;
  const totalBytes = Number(shoot.uploadTotalBytes) || 0;
  const uploadedBytes = Number(shoot.uploadedBytes) || 0;
  if (totalBytes > 0)
    return Math.min(
      99,
      Math.max(0, Math.floor((uploadedBytes / totalBytes) * 100)),
    );
  const photos = Number(shoot.photos) || 0;
  if (photos > 0)
    return Math.min(
      99,
      Math.max(0, Math.floor(((shoot.uploadedPhotos || 0) / photos) * 100)),
    );
  return 0;
}
