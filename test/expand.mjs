// Snippet bodies as accepting them with Tab writes them: every placeholder its
// default, a mirror ($1, ${1}) the default of its number, a choice its option.

// placeholders lists every ${N:default} and ${N|a,b|} in text, innermost first,
// with the text of its default as written (escapes and nested placeholders kept).
export function placeholders(text) {
  const found = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\") {
      i++;
      continue;
    }
    const m = /^\$\{(\d+)([:|])/.exec(text.slice(i, i + 8));
    if (!m) continue;
    // Find the matching close brace, skipping escapes and nested placeholders.
    let depth = 0;
    for (let j = i; j < text.length; j++) {
      if (text[j] === "\\") {
        j++;
        continue;
      }
      if (text[j] === "{") depth++;
      if (text[j] === "}" && --depth === 0) {
        const inner = text.slice(i + m[0].length, j);
        found.push({ n: Number(m[1]), choice: m[2] === "|", raw: m[2] === "|" ? inner.replace(/\|$/, "") : inner });
        break;
      }
    }
  }
  return found;
}

// expand fills body (an array of lines) as Tab does. choice picks each choice
// placeholder's option: the choice-th, or its last when it has fewer.
export function expand(body, choice = 0) {
  let text = body.join("\n");
  const defaults = new Map();
  for (let prev = ""; prev !== text; ) {
    prev = text;
    text = text
      .replace(/\$\{(\d+)\|((?:[^|\\]|\\.)*)\|\}/g, (_, n, opts) => {
        const list = opts.split(",");
        const v = list[Math.min(choice, list.length - 1)];
        if (!defaults.has(n)) defaults.set(n, v);
        return v;
      })
      .replace(/\$\{(\d+):((?:[^{}\\]|\\.)*)\}/g, (_, n, v) => {
        if (!defaults.has(n)) defaults.set(n, v);
        return v;
      });
  }
  text = text.replace(/\$\{(\d+)\}|\$(\d+)/g, (_, a, b) => defaults.get(a ?? b) ?? "");
  return text.replace(/\\([}$\\])/g, "$1");
}

// choices is how many options the snippet's widest choice placeholder has.
export function choices(body) {
  return Math.max(1, ...placeholders(body.join("\n")).filter((p) => p.choice).map((p) => p.raw.split(",").length));
}
