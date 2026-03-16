const DEFAULT_IGNORED_TOKENS = new Set(["/", "[", "]", "(", ")", ".", " "]);

export function tokenizeIpaSymbols(ipa: string, knownSymbols: string[]): string[] {
  const orderedSymbols = [...knownSymbols].sort((left, right) => right.length - left.length);
  const tokens: string[] = [];
  let index = 0;

  while (index < ipa.length) {
    const slice = ipa.slice(index);
    const matched = orderedSymbols.find((symbol) => slice.startsWith(symbol));

    if (matched) {
      tokens.push(matched);
      index += matched.length;
      continue;
    }

    const character = ipa[index];
    if (DEFAULT_IGNORED_TOKENS.has(character)) {
      index += 1;
      continue;
    }

    if (/\s/u.test(character)) {
      index += 1;
      continue;
    }

    tokens.push(character);
    index += 1;
  }

  return tokens;
}

export function uniqueIpaSymbols(ipaValues: Array<string | null | undefined>, knownSymbols: string[]): string[] {
  const tokens = new Set<string>();

  for (const ipa of ipaValues) {
    if (!ipa) {
      continue;
    }

    for (const token of tokenizeIpaSymbols(ipa, knownSymbols)) {
      tokens.add(token);
    }
  }

  return [...tokens];
}
