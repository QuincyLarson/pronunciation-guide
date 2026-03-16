import { getLearnIpaAppPath } from "./routes";
import { uniqueIpaSymbols } from "./tokenize";
import type { Entry } from "../../types/content";
import type { LearnCurriculum } from "../../types/learn-ipa";

export interface LearnIpaLookupSymbol {
  id: string;
  symbol: string;
  name: string;
}

export interface LearnIpaLookup {
  version: number;
  symbolToStep: Record<string, string>;
  symbols: LearnIpaLookupSymbol[];
}

export interface LearnIpaWordLink {
  symbolId: string;
  symbol: string;
  name: string;
  stepId: string;
  href: string;
}

export function buildLearnIpaLookup(curriculum: LearnCurriculum): LearnIpaLookup {
  return {
    version: curriculum.version,
    symbolToStep: curriculum.symbolToStep,
    symbols: curriculum.symbols.map((symbol) => ({
      id: symbol.id,
      symbol: symbol.symbol,
      name: symbol.name
    }))
  };
}

export function getLearnIpaLinks(entry: Entry, lookup: LearnIpaLookup): LearnIpaWordLink[] {
  const symbolsByToken = new Map(lookup.symbols.map((symbol) => [symbol.symbol, symbol]));
  const tokens = uniqueIpaSymbols(
    entry.variants.map((variant) => variant.ipa),
    lookup.symbols.map((symbol) => symbol.symbol)
  );

  return tokens
    .map((token) => {
      const symbol = symbolsByToken.get(token);
      const stepId = lookup.symbolToStep[token];

      if (!symbol || !stepId) {
        return null;
      }

      return {
        symbolId: symbol.id,
        symbol: symbol.symbol,
        name: symbol.name,
        stepId,
        href: getLearnIpaAppPath({ stepId })
      };
    })
    .filter((link): link is LearnIpaWordLink => !!link)
    .slice(0, 8);
}
