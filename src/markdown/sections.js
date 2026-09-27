export function parseSections(markdown) {
  const lines = markdown.split("\n");
  const sections = [];
  let chunk = [];
  let fence = null;
  for (const line of lines) {
    const match = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (match) {
      if (!fence) fence = match[1];
      else if (match[1][0] === fence[0] && match[1].length >= fence.length)
        fence = null;
    }
    if (!fence && /^#{1,2}\s/.test(line) && chunk.length) {
      sections.push(chunk.join("\n"));
      chunk = [];
    }
    chunk.push(line);
  }
  if (chunk.length) sections.push(chunk.join("\n"));
  return sections;
}
