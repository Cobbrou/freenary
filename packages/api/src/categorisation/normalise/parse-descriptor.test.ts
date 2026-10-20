import { describe, expect, it } from "bun:test";

import { parseDescriptor } from "./parse-descriptor";
import type { DescriptorParseInput } from "./types";

const input = (
  overrides: Partial<DescriptorParseInput> & {
    remittanceLines: readonly string[];
  }
): DescriptorParseInput => ({
  amountMinor: overrides.amountMinor ?? -1500,
  institutionName: overrides.institutionName ?? "Unknown Bank",
  ...overrides,
});

describe("FR", () => {
  describe("boursorama", () => {
    it("parses CARTE with date and card suffix", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "Boursorama",
          remittanceLines: ["CARTE 01/03/25 CARREFOUR MARKET 4587 CB*4567"],
        })
      );

      expect(parsed.payeeText).toBe("CARREFOUR MARKET");
      expect(parsed.normalisedDescriptor).toBe("carrefour market");
      expect(parsed.channel).toBe("card");
      expect(parsed.cardLast4).toBe("4567");
      expect(parsed.labelDate).toBe("2025-03-01");
      expect(parsed.parserId).toBe("boursorama");
    });

    it("parses RETRAIT DAB as atm channel", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "BoursoBank",
          remittanceLines: ["RETRAIT DAB 15/04/25 DISTRIBUTEUR BNP CB*1234"],
        })
      );

      expect(parsed.channel).toBe("atm");
      expect(parsed.cardLast4).toBe("1234");
      expect(parsed.parserId).toBe("boursorama");
    });

    it("parses PRLV SEPA as direct-debit", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "Boursorama",
          remittanceLines: ["PRLV SEPA EDF CLIENTS PARTICULIERS"],
        })
      );

      expect(parsed.payeeText).toBe("EDF CLIENTS PARTICULIERS");
      expect(parsed.normalisedDescriptor).toBe("edf clients particuliers");
      expect(parsed.channel).toBe("direct-debit");
    });

    it("strips backslash-delimited localisation", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "Boursorama",
          remittanceLines: ["CARTE 10/05/25 MONOPRIX\\PARIS 15\\ FR CB*9999"],
        })
      );

      expect(parsed.payeeText).toBe("MONOPRIX");
      expect(parsed.channel).toBe("card");
    });

    it("drops Réf lines as noise", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "Boursorama",
          remittanceLines: [
            "Réf : 12345678",
            "CARTE 01/03/25 BOULANGERIE PAUL CB*4567",
          ],
        })
      );

      expect(parsed.payeeText).toBe("BOULANGERIE PAUL");
      expect(parsed.droppedLines).toContain("Réf : 12345678");
    });

    it("matches on BIC prefix", () => {
      const parsed = parseDescriptor(
        input({
          institutionBic: "BOUSFRPPXXX",
          institutionName: "Some Random Name",
          remittanceLines: ["CARTE 01/03/25 FNAC CB*1111"],
        })
      );

      expect(parsed.parserId).toBe("boursorama");
    });

    it("parses VIR SEPA as transfer", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "Boursorama",
          remittanceLines: ["VIR SEPA JEAN DUPONT"],
        })
      );

      expect(parsed.channel).toBe("transfer");
      expect(parsed.payeeText).toBe("JEAN DUPONT");
    });

    it("parses ECH PRET as loan", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "Boursorama",
          remittanceLines: ["ECH PRET: CREDIT IMMOBILIER"],
        })
      );

      expect(parsed.channel).toBe("loan");
    });

    it("handles CARTE with DDMMYY format (no slashes)", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "Boursorama",
          remittanceLines: ["CARTE 010325 CARREFOUR CB*4567"],
        })
      );

      expect(parsed.payeeText).toBe("CARREFOUR");
      expect(parsed.labelDate).toBe("2025-03-01");
      expect(parsed.channel).toBe("card");
    });
  });

  describe("bnp-paribas", () => {
    it("parses FACTURE CARTE DU with date and card", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "BNP Paribas",
          remittanceLines: [
            "FACTURE CARTE DU 150325 PHARMACIE LAFAYETTE CARTE 7890",
          ],
        })
      );

      expect(parsed.payeeText).toBe("PHARMACIE LAFAYETTE");
      expect(parsed.normalisedDescriptor).toBe("pharmacie lafayette");
      expect(parsed.channel).toBe("card");
      expect(parsed.cardLast4).toBe("7890");
      expect(parsed.labelDate).toBe("2025-03-15");
      expect(parsed.parserId).toBe("bnp-paribas");
    });

    it("parses PRLV EUROPEEN SEPA with metadata suffixes", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "BNP Paribas",
          remittanceLines: [
            "PRLV EUROPEEN SEPA FREE MOBILE MDT/123 ECH/456 ID ABC",
          ],
        })
      );

      expect(parsed.payeeText).toBe("FREE MOBILE");
      expect(parsed.channel).toBe("direct-debit");
    });

    it("matches on BIC", () => {
      const parsed = parseDescriptor(
        input({
          institutionBic: "BNPAFRPPXXX",
          institutionName: "Unknown",
          remittanceLines: ["FACTURE CARTE DU 010125 SEPHORA CARTE 5555"],
        })
      );

      expect(parsed.parserId).toBe("bnp-paribas");
    });
  });

  describe("credit-agricole", () => {
    it("parses PAIEMENT PAR CARTE with date suffix (DD/MM, no year)", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "Crédit Agricole",
          remittanceLines: ["PAIEMENT PAR CARTE MONOPRIX PARIS 15 12/03"],
        })
      );

      expect(parsed.payeeText).toBe("MONOPRIX PARIS 15");
      expect(parsed.normalisedDescriptor).toBe("monoprix paris");
      expect(parsed.channel).toBe("card");
      expect(parsed.labelDate).toBeUndefined();
      expect(parsed.parserId).toBe("credit-agricole");
    });

    it("parses PRELEVEMENT with DD/MM/YYYY date", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "Crédit Agricole",
          remittanceLines: ["PRELEVEMENT EDF CLIENTS 15/03/2025"],
        })
      );

      expect(parsed.payeeText).toBe("EDF CLIENTS");
      expect(parsed.channel).toBe("direct-debit");
      expect(parsed.labelDate).toBe("2025-03-15");
    });

    it("parses PRELEVEMENT with DD-MM date (no year)", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "Crédit Agricole",
          remittanceLines: ["PRELEVEMENT NETFLIX 15-03"],
        })
      );

      expect(parsed.payeeText).toBe("NETFLIX");
      expect(parsed.channel).toBe("direct-debit");
      expect(parsed.labelDate).toBeUndefined();
    });
  });

  describe("societe-generale", () => {
    it("parses CARTE with card token before date", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "Société Générale",
          remittanceLines: ["CARTE X1234 15/03 BOULANGERIE DUPONT"],
        })
      );

      expect(parsed.payeeText).toBe("BOULANGERIE DUPONT");
      expect(parsed.channel).toBe("card");
      expect(parsed.cardLast4).toBe("X1234");
      expect(parsed.parserId).toBe("societe-generale");
    });

    it("parses VIR POUR with REF and MOTIF", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "Société Générale",
          remittanceLines: [
            "VIR POUR: JEAN DUPONT REF: ABC123 MOTIF: LOYER MARS",
          ],
        })
      );

      expect(parsed.payeeText).toBe("LOYER MARS");
      expect(parsed.channel).toBe("transfer");
    });

    it("parses bare date/payee format", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "Société Générale",
          remittanceLines: ["0315/MONOPRIX PARIS"],
        })
      );

      expect(parsed.payeeText).toBe("MONOPRIX PARIS");
    });
  });

  describe("credit-mutuel", () => {
    it("parses PAIEMENT CB with card after merchant", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "Crédit Mutuel",
          remittanceLines: ["PAIEMENT CB 1503 INTERMARCHE CARTE 4567"],
        })
      );

      expect(parsed.payeeText).toBe("INTERMARCHE");
      expect(parsed.channel).toBe("card");
      expect(parsed.cardLast4).toBe("4567");
      expect(parsed.parserId).toBe("credit-mutuel");
    });

    it("matches CIC by name", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "CIC",
          remittanceLines: ["PAIEMENT PSC 0115 SNCF PAYWEB9876"],
        })
      );

      expect(parsed.parserId).toBe("credit-mutuel");
      expect(parsed.payeeText).toBe("SNCF");
      expect(parsed.cardLast4).toBe("9876");
    });

    it("no year from 4-digit date — labelDate undefined", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "Crédit Mutuel",
          remittanceLines: ["PAIEMENT CB 1503 AUCHAN CARTE 1111"],
        })
      );

      expect(parsed.labelDate).toBeUndefined();
    });
  });

  describe("lcl", () => {
    it("parses CB payee DD/MM/YY (date as suffix)", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "LCL",
          remittanceLines: ["CB BOULANGER 15/03/25"],
        })
      );

      expect(parsed.payeeText).toBe("BOULANGER");
      expect(parsed.channel).toBe("card");
      expect(parsed.labelDate).toBe("2025-03-15");
      expect(parsed.parserId).toBe("lcl");
    });
  });

  describe("la-banque-postale", () => {
    it("parses ACHAT CB payee DD.MM.YY (dot dates)", () => {
      const parsed = parseDescriptor(
        input({
          institutionName: "La Banque Postale",
          remittanceLines: ["ACHAT CB PHARMACIE DE LA GARE 03.04.25"],
        })
      );

      expect(parsed.payeeText).toBe("PHARMACIE DE LA GARE");
      expect(parsed.normalisedDescriptor).toBe("pharmacie gare");
      expect(parsed.channel).toBe("card");
      expect(parsed.labelDate).toBe("2025-04-03");
      expect(parsed.parserId).toBe("la-banque-postale");
    });
  });
});

describe("generic", () => {
  it("falls back to generic for unknown institutions", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Sparkasse",
        remittanceLines: ["PRLV SEPA NETFLIX"],
      })
    );

    expect(parsed.parserId).toBe("generic");
    expect(parsed.payeeText).toBe("NETFLIX");
    expect(parsed.channel).toBe("direct-debit");
  });

  it("uses creditorName when no label yields payee", () => {
    const parsed = parseDescriptor(
      input({
        creditorName: "AMAZON EU SARL",
        institutionName: "Unknown Bank",
        remittanceLines: ["CARTE"],
      })
    );

    expect(parsed.payeeText).toBe("AMAZON EU SARL");
  });

  it("uses debtorName when creditorName is absent", () => {
    const parsed = parseDescriptor(
      input({
        debtorName: "JEAN DUPONT",
        institutionName: "Unknown Bank",
        remittanceLines: ["VIR"],
      })
    );

    expect(parsed.payeeText).toBe("JEAN DUPONT");
  });

  it("uses the debtor for incoming transactions", () => {
    const parsed = parseDescriptor(
      input({
        amountMinor: 1500,
        creditorName: "ACCOUNT OWNER",
        debtorName: "SALARY PAYER",
        remittanceLines: [],
      })
    );

    expect(parsed.payeeText).toBe("SALARY PAYER");
  });

  it("uses the creditor for outgoing transactions", () => {
    const parsed = parseDescriptor(
      input({
        amountMinor: -1500,
        creditorName: "ENERGY COMPANY",
        debtorName: "ACCOUNT OWNER",
        remittanceLines: [],
      })
    );

    expect(parsed.payeeText).toBe("ENERGY COMPANY");
  });

  it("keeps descriptor text ahead of structured counterparties", () => {
    const parsed = parseDescriptor(
      input({
        amountMinor: 1500,
        creditorName: "RECIPIENT",
        debtorName: "SENDER",
        remittanceLines: ["VIR SEPA DESCRIPTOR NAME"],
      })
    );

    expect(parsed.payeeText).toBe("DESCRIPTOR NAME");
  });

  it("selects the same descriptor when remittance lines are reversed", () => {
    const remittanceLines = [
      "PRLV SEPA NETFLIX",
      "PRLV SEPA ELECTRICITY COMPANY",
    ];

    const forward = parseDescriptor(input({ remittanceLines }));
    const reversed = parseDescriptor(
      input({ remittanceLines: remittanceLines.toReversed() })
    );

    expect(reversed.normalisedDescriptor).toBe(forward.normalisedDescriptor);
  });
});

describe("cross-cutting", () => {
  it("expands upper- and lowercase Latin ligatures", () => {
    const parsed = parseDescriptor(
      input({
        remittanceLines: ["ŒUVRE BœUF ÆSOP CæSAR"],
      })
    );

    expect(parsed.normalisedDescriptor).toBe("oeuvre boeuf aesop caesar");
  });

  it("AMZN Mktp FR*308J preserves merchant left of *", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["AMZN Mktp FR*308J"],
      })
    );

    expect(parsed.normalisedDescriptor).toBe("amzn mktp fr");
    expect(parsed.payeeText).toBe("AMZN Mktp FR*308J");
  });

  it("handles unordered remittanceLines — label in position 2", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Boursorama",
        remittanceLines: [
          "Réf : 999999",
          "Identifiant compte: FR76123",
          "CARTE 01/03/25 CARREFOUR MARKET CB*4567",
        ],
      })
    );

    expect(parsed.payeeText).toBe("CARREFOUR MARKET");
    expect(parsed.channel).toBe("card");
    expect(parsed.droppedLines).toContain("Réf : 999999");
  });

  it("produces the same key for either remittance-line order", () => {
    const first = parseDescriptor(
      input({
        institutionName: "Boursorama",
        remittanceLines: [
          "CARTE 01/03/25 CARREFOUR MARKET CB*4567",
          "Réf : 999999",
        ],
      })
    );

    const reversed = parseDescriptor(
      input({
        institutionName: "Boursorama",
        remittanceLines: [
          "Réf : 999999",
          "CARTE 01/03/25 CARREFOUR MARKET CB*4567",
        ],
      })
    );

    expect(first.normalisedDescriptor).toBe(reversed.normalisedDescriptor);
  });

  it("normalises Latin ligatures to their expanded spelling", () => {
    const ligatures = parseDescriptor(
      input({ remittanceLines: ["CŒUR LÆTITIA"] })
    );

    const expanded = parseDescriptor(
      input({ remittanceLines: ["COEUR LAETITIA"] })
    );

    expect(ligatures.normalisedDescriptor).toBe("coeur laetitia");
    expect(ligatures.normalisedDescriptor).toBe(expanded.normalisedDescriptor);
  });

  it("RETRAIT DAB yields channel atm", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Boursorama",
        remittanceLines: ["RETRAIT DAB 15/04/25 BNP PARIS CB*1234"],
      })
    );

    expect(parsed.channel).toBe("atm");
  });

  it("PRLV SEPA yields channel direct-debit", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["PRLV SEPA SFR"],
      })
    );

    expect(parsed.channel).toBe("direct-debit");
  });

  it("all-noise input yields payeeText null and does not throw", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["", "  "],
      })
    );

    expect(parsed.payeeText).toBeNull();
    expect(parsed.channel).toBe("unknown");
    expect(parsed.normalisedDescriptor).toBe("");
  });

  it("bare CARTE with no payee yields card channel", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["CARTE"],
      })
    );

    expect(parsed.channel).toBe("card");
    expect(parsed.payeeText).toBeNull();
  });

  it("empty remittanceLines does not throw", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: [],
      })
    );

    expect(parsed.payeeText).toBeNull();
    expect(parsed.normalisedDescriptor).toBe("");
  });

  it("every parser sets parserId to its own id", () => {
    const banks: [string, string, string | undefined][] = [
      ["Boursorama", "boursorama", undefined],
      ["BNP Paribas", "bnp-paribas", undefined],
      ["Crédit Agricole", "credit-agricole", undefined],
      ["Société Générale", "societe-generale", undefined],
      ["Crédit Mutuel", "credit-mutuel", undefined],
      ["LCL", "lcl", undefined],
      ["La Banque Postale", "la-banque-postale", undefined],
      ["Sparkasse", "generic", undefined],
    ];

    for (const [name, expectedId, bic] of banks) {
      const parsed = parseDescriptor(
        input({
          institutionBic: bic,
          institutionName: name,
          remittanceLines: ["SOME LABEL"],
        })
      );

      expect(parsed.parserId).toBe(expectedId);
    }
  });
});

describe("channel verb detection", () => {
  it("RETRAIT DAB without date → atm (Boursorama regression)", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Boursorama",
        remittanceLines: ["RETRAIT DAB BNP PARIBAS PARIS CB*9876"],
      })
    );

    expect(parsed.channel).toBe("atm");
    expect(parsed.parserId).toBe("boursorama");
  });

  it("RETRAIT DAB without date → atm and extracts payee", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Boursorama",
        remittanceLines: ["RETRAIT DAB DISTRIBUTEUR BNP CB*1234"],
      })
    );

    expect(parsed.channel).toBe("atm");
    expect(parsed.payeeText).toBe("DISTRIBUTEUR BNP");
  });

  it("RETRAIT DAB with date → atm", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Boursorama",
        remittanceLines: ["RETRAIT DAB 01/03/25 DISTRIBUTEUR BNP CB*1234"],
      })
    );

    expect(parsed.channel).toBe("atm");
  });

  it("bare RETRAIT → atm", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["RETRAIT ESPECES GUICHET"],
      })
    );

    expect(parsed.channel).toBe("atm");
  });

  it("PRLV SEPA → direct-debit", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["PRLV SEPA FREE MOBILE"],
      })
    );

    expect(parsed.channel).toBe("direct-debit");
  });

  it("PRELEVEMENT → direct-debit", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["PRELEVEMENT EDF"],
      })
    );

    expect(parsed.channel).toBe("direct-debit");
  });

  it("VIR SEPA → transfer", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["VIR SEPA JEAN DUPONT"],
      })
    );

    expect(parsed.channel).toBe("transfer");
  });

  it("VIR INST → transfer", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["VIR INST JEAN DUPONT"],
      })
    );

    expect(parsed.channel).toBe("transfer");
  });

  it("VIR → transfer", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["VIR JEAN DUPONT"],
      })
    );

    expect(parsed.channel).toBe("transfer");
  });

  it("VIREMENT → transfer", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["VIREMENT JEAN DUPONT"],
      })
    );

    expect(parsed.channel).toBe("transfer");
  });

  it("CARTE → card", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["CARTE MONOPRIX PARIS"],
      })
    );

    expect(parsed.channel).toBe("card");
  });

  it("CB → card", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["CB MONOPRIX"],
      })
    );

    expect(parsed.channel).toBe("card");
  });

  it("ACHAT CB → card", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["ACHAT CB MONOPRIX"],
      })
    );

    expect(parsed.channel).toBe("card");
  });

  it("PAIEMENT PAR CARTE → card", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["PAIEMENT PAR CARTE MONOPRIX"],
      })
    );

    expect(parsed.channel).toBe("card");
  });

  it("PAIEMENT CB → card", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["PAIEMENT CB MONOPRIX"],
      })
    );

    expect(parsed.channel).toBe("card");
  });

  it("FACTURE CARTE → card", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["FACTURE CARTE MONOPRIX"],
      })
    );

    expect(parsed.channel).toBe("card");
  });

  it("ECH PRET: → loan", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["ECH PRET: CREDIT IMMOBILIER"],
      })
    );

    expect(parsed.channel).toBe("loan");
  });

  it("CHEQUE → cheque", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["CHEQUE 1234567"],
      })
    );

    expect(parsed.channel).toBe("cheque");
  });

  it("CHQ → cheque", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["CHQ 1234567"],
      })
    );

    expect(parsed.channel).toBe("cheque");
  });

  it("COTISATION → fee", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["COTISATION CARTE VISA"],
      })
    );

    expect(parsed.channel).toBe("fee");
  });

  it("FRAIS → fee", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["FRAIS TENUE DE COMPTE"],
      })
    );

    expect(parsed.channel).toBe("fee");
  });

  it("COMMISSION → fee", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Unknown Bank",
        remittanceLines: ["COMMISSION INTERVENTION"],
      })
    );

    expect(parsed.channel).toBe("fee");
  });

  it("verb detection works for Boursorama even when detail patterns fail", () => {
    const parsed = parseDescriptor(
      input({
        institutionName: "Boursorama",
        remittanceLines: ["PRLV SEPA SOME PROVIDER"],
      })
    );

    expect(parsed.channel).toBe("direct-debit");
    expect(parsed.parserId).toBe("boursorama");
  });

  it("verb detection works across institution parsers", () => {
    const banks = [
      "BNP Paribas",
      "Crédit Agricole",
      "Société Générale",
      "Crédit Mutuel",
      "LCL",
      "La Banque Postale",
    ];

    for (const bank of banks) {
      const parsed = parseDescriptor(
        input({
          institutionName: bank,
          remittanceLines: ["RETRAIT DAB SOME ATM"],
        })
      );

      expect(parsed.channel).toBe("atm");
    }
  });
});

describe("iso 20022 family code", () => {
  it("RCDT → transfer overrides verb detection", () => {
    const parsed = parseDescriptor(
      input({
        bankTransactionFamilyCode: "RCDT",
        institutionName: "Unknown Bank",
        remittanceLines: ["CARTE MONOPRIX"],
      })
    );

    expect(parsed.channel).toBe("transfer");
  });

  it("RDDT → direct-debit for any institution", () => {
    const parsed = parseDescriptor(
      input({
        bankTransactionFamilyCode: "RDDT",
        institutionName: "Boursorama",
        remittanceLines: ["SOME RANDOM TEXT"],
      })
    );

    expect(parsed.channel).toBe("direct-debit");
  });

  it("CCRD → card", () => {
    const parsed = parseDescriptor(
      input({
        bankTransactionFamilyCode: "CCRD",
        institutionName: "Unknown Bank",
        remittanceLines: ["MONOPRIX PARIS"],
      })
    );

    expect(parsed.channel).toBe("card");
  });

  it("CHRG → fee", () => {
    const parsed = parseDescriptor(
      input({
        bankTransactionFamilyCode: "CHRG",
        institutionName: "Unknown Bank",
        remittanceLines: ["TENUE DE COMPTE"],
      })
    );

    expect(parsed.channel).toBe("fee");
  });

  it("CNTR → atm", () => {
    const parsed = parseDescriptor(
      input({
        bankTransactionFamilyCode: "CNTR",
        institutionName: "Unknown Bank",
        remittanceLines: ["RETRAIT"],
      })
    );

    expect(parsed.channel).toBe("atm");
  });

  it("LDAS → loan", () => {
    const parsed = parseDescriptor(
      input({
        bankTransactionFamilyCode: "LDAS",
        institutionName: "Unknown Bank",
        remittanceLines: ["ECHEANCE PRET"],
      })
    );

    expect(parsed.channel).toBe("loan");
  });

  it("null/undefined falls back to verb detection", () => {
    const parsed = parseDescriptor(
      input({
        bankTransactionFamilyCode: null,
        institutionName: "Unknown Bank",
        remittanceLines: ["VIR SEPA JEAN DUPONT"],
      })
    );

    expect(parsed.channel).toBe("transfer");
  });

  it("unknown code falls back to verb detection", () => {
    const parsed = parseDescriptor(
      input({
        bankTransactionFamilyCode: "ZZZZ",
        institutionName: "Unknown Bank",
        remittanceLines: ["PRLV SEPA NETFLIX"],
      })
    );

    expect(parsed.channel).toBe("direct-debit");
  });

  it("family code is case-insensitive", () => {
    const parsed = parseDescriptor(
      input({
        bankTransactionFamilyCode: "rcdt",
        institutionName: "Unknown Bank",
        remittanceLines: ["SOME TEXT"],
      })
    );

    expect(parsed.channel).toBe("transfer");
  });

  it("family code takes priority but regex still extracts payee details", () => {
    const parsed = parseDescriptor(
      input({
        bankTransactionFamilyCode: "MCRD",
        institutionName: "Boursorama",
        remittanceLines: ["CARTE 01/03/25 CARREFOUR MARKET CB*4567"],
      })
    );

    expect(parsed.channel).toBe("card");
    expect(parsed.payeeText).toBe("CARREFOUR MARKET");
    expect(parsed.cardLast4).toBe("4567");
    expect(parsed.labelDate).toBe("2025-03-01");
  });
});
