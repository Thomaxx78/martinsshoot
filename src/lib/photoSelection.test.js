import assert from "node:assert/strict";
import { test } from "node:test";
import {
  matchesShootPhotos,
  photoKey,
  previouslyUploadedIndexes,
} from "./photoSelection.js";

test("reselecting the same photos in a different order avoids duplicates", () => {
  const first = new File(["first"], "IMG_1.jpg", { lastModified: 100 });
  const second = new File(["second"], "IMG_2.jpg", { lastModified: 200 });
  const shoot = {
    selectedFileKeys: [photoKey(first), photoKey(second)],
    uploadedFileKeys: [photoKey(first)],
  };
  assert.equal(matchesShootPhotos(shoot, [second, first]), true);
  assert.deepEqual([...previouslyUploadedIndexes(shoot, [second, first])], [1]);
  assert.equal(matchesShootPhotos(shoot, [first]), false);
  assert.equal(
    matchesShootPhotos(shoot, [first, new File(["other"], "IMG_2.jpg")]),
    false,
  );
});
