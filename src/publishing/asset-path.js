export function assetPath(path) {
  if (
    typeof path !== "string" ||
    path.length > 240 ||
    !/^(?:[A-Za-z0-9_-][A-Za-z0-9_-]*\/)+[A-Za-z0-9_-][A-Za-z0-9_.-]*\.svg$/.test(
      path,
    ) ||
    path.includes("..")
  )
    throw new Error(
      "Use a relative SVG path in a visible asset folder, without traversal, hidden files or workflow paths.",
    );
  return path;
}
