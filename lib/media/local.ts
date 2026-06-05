import path from "node:path";

export const localMediaTypes: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".vtt": "text/vtt"
};

export function getLocalMediaRoot() {
  return process.env.LOCAL_MEDIA_ROOT?.trim() || "/data/echoline/media";
}

export function resolveLocalMediaPath(parts: string[]) {
  const root = path.resolve(/*turbopackIgnore: true*/ getLocalMediaRoot());
  const filePath = path.resolve(/*turbopackIgnore: true*/ root, ...parts);
  const isInsideRoot = filePath === root || filePath.startsWith(`${root}${path.sep}`);

  return isInsideRoot ? { root, filePath } : null;
}
