export interface TokenPack {
  id: string;
  tokens: number;
  amountKes: number;
}

/** Placeholder pricing — tune once real usage/acquisition economics are known. */
export const TOKEN_PACKS: TokenPack[] = [
  { id: "pack_1", tokens: 1, amountKes: 50 },
  { id: "pack_5", tokens: 5, amountKes: 200 },
  { id: "pack_10", tokens: 10, amountKes: 350 },
];
