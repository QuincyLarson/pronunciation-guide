import path from "node:path";

const extensionToMime = new Map<string, string>([
  [".json", "application/json; charset=utf-8"],
  [".wav", "audio/wav"],
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
  [".html", "text/html; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"]
]);

export function mimeTypeForPath(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  return extensionToMime.get(extension) ?? "application/octet-stream";
}
