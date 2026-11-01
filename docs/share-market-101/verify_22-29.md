# Verification: Chapters 22–29

Checked 1–2 Nov 2026. Build and `sm_lint.py` for 2201–2902 pass (OK).

## Changes

| chapter | old | new | source URL |
|---|---|---|---|
| 22 | "Buffett did it again in 1988, buying about $1.3B of Coca-Cola" | "in 1988 and 1989, buying about $1.3B" (sign sub: "(1988–89)") | Berkshire 1989 letter (KO cost $1,299M across 1988–89): https://www.berkshirehathaway.com/letters/1989.html |
| 23 | S&P 500 "about seven thousand, seven hundred and forty-four" (late Oct) | "about seven thousand, five hundred and eighty" (end of Oct 2026). The +60% since end-2023 claim still holds (+59%). | AP, 30 Oct 2026 close of 7,580.07: https://krmg.com/2026/10/30/how-major-us-stock-indexes-fared-friday-10-30-2026/ |
| 25 | Buffett letters "Sixty years of them, from 1965 to 2024" at berkshirehathaway.com | "Every one from 1977 to 2024 is free there, and a book collects all sixty, from 1965" (sign sub updated) | https://www.berkshirehathaway.com/letters/letters.html |
| 25 | "he still writes a Thanksgiving letter each November" | "he has said he'll keep writing a Thanksgiving letter each November" (2026's isn't out yet) | Berkshire Nov 2025 Thanksgiving letter (berkshirehathaway.com news) |
| 25 | Margin Call "rated M in Australia" (narration and board) | "rated MA15+ in Australia" | https://www.classification.gov.au/titles/margin-call (MA 15+, strong coarse language) |
| 25 | Oppenheimer "rated M in Australia too" (narration and board) | "rated MA15+ in Australia" | https://www.classification.gov.au/titles/oppenheimer (MA 15+, strong sex and a suicide scene) |
| 27 | "Warren Buffett said it in eight words: price is what you pay, value is what you get" | "in ten words" (the quote has 10 words) | Berkshire 2008 letter: https://www.berkshirehathaway.com/letters/2008ltr.pdf |
| 27 | Chart point [2026.82, 7744]; "Around seven thousand seven hundred. A new high." | [2026.83, 7580]; "Around seven thousand six hundred, just below its record high from early October." | AP 30 Oct close of 7,580.07, record 7,818.93 on 6 Oct 2026 (link above); FRED SP500 |
| 28 | 50% CGT discount presented with no end date (kinetic beat, Claude answer, narrator line) | Adds: "A new law replaces it with inflation indexing for gains made from July 2027" (plus a kinetic line, cue `replaces`). Claude answer and narrator now say "at least 12 months" and "on gains made before July 2027". | ATO "Capital gains tax reform" (published 13 Oct 2026; Treasury Laws Amendment (Tax Reform No. 1) Act 2026 is law): https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/capital-gains-tax-reform |
| 28 (follow-up, at the coordinator's request) | One-line CGT note | The one-line note is replaced by a new 5-beat section, "New CGT rules 2027", placed before franking. It covers: (1) Treasury Laws Amendment (Tax Reform No. 1) Act 2026, assented 26 June 2026: from 1 July 2027 the ½ discount ends for individuals and trusts and is replaced by cost-base indexation, plus a 30% minimum tax on many gains. (2) What indexation means: only the real gain is taxed, all of it, and the 12-month hold still applies. (3) Sheet: the same $10k → $40k gain under the old and new rules at 47% with 10% assumed inflation ($7,050 vs $13,630 tax). (4) Bars: gains on assets you already own are split; the gain built up to 30 Jun 2027 keeps the ½ discount and the rest uses the new rules. (5) Exceptions and disclaimer: new homes can elect the old discount, super keeps its ⅓ discount, the main residence is unchanged, check the ATO and a tax agent. The original $30,000 sheet, its narration and the "saving" beat now say they use today's rules (gains before July 2027). The bucket table notes "indexed from Jul 2027" and super's "⅓ discount". | Act No. 49 of 2026: https://www.legislation.gov.au/C2026A00049 ; ATO: https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/capital-gains-tax-reform ; super ⅓ discount retained: https://www.findex.com.au/insights/article/cgt-discount-changes-from-1-july-2027-should-you-sell-or-hold- |
| 29 | "South Korea's market roughly doubled, in US dollars!" | "South Korea's market jumped about seventy-five percent, its best year since 1999!" (KOSPI +75.6% in won; about +80% in USD, not double) | KOSPI 2,399→4,214; FRED DEXKOUS 1,477.86→1,444.55: https://fred.stlouisfed.org/series/DEXKOUS ; https://tradingeconomics.com/south-korea/stock-market/news/513103 |
| 29 | Nifty 50 "returned about twelve percent a year over twenty years, in rupees"; sign "~12% a year"; sheet "~12% / ~8% in US$"; narrator "twelve … eight" | "grown about nine and a half percent a year … in rupees, before dividends"; sign "~9.5% a year*" (cue `nine`); sheet "~9.5% / ~5.5%"; narrator "nine and a half … five and a half" | Nifty about 3,700 (Oct 2006) to about 22,750 (27 Oct 2026; down sharply in 2026) = 6.1×, so 9.5% a year. In USD: × 44.9/94.94, so about 5.5%. Sources: https://www.oquilia.com/markets/today/2026-10-26 ; FRED DEXINUS https://fred.stlouisfed.org/series/DEXINUS |

## Verified, no change needed (main items)
- **Ch22:**
  - Case-Shiller (FRED CSUSHPINSA): Jan 2000 = 100, peak 184.6 in Jul 2006, low 134.0 in Feb 2012 (−27%).
  - Burry +489% after fees; Paulson about $15B in 2007.
  - The Big Short is rated M (classification.gov.au).
  - BofA $14.08 / $3.14 / $15.06. Black Wednesday rates 10 → 12 → 15%, Treasury cost £3.3bn.
  - Ackman $27M → $2.6B; S&P 2020 low 2,237 (−34%), record by Aug.
  - Berkshire's Apple stake about $62B at end-2025 (Q4 2025 13F).
  - Paulson's gold fund −65% in H1 2013 (Reuters).
  - LTCM −$4.6B, 14 banks put in $3.6B. Archegos about $20B, banks $10B+, Credit Suisse $5.5B.
- **Ch23:**
  - IVV 0.04% (BlackRock), VGS 0.18%, VAS 0.07%.
  - Fee compounding (1.0995^20 = 6.667; 1.085^20 = 5.112).
  - DCA ($7.69 vs $8.20) and rebalancing arithmetic.
  - Apple gross margin about 47% (FY2025 10-K 46.9%; FY2026 10-K is due 2 Nov).
- **Ch24:**
  - Equilar/AP 2026: median $17.7M, stock awards $10.9M (https://www.equilar.com/reports/127-equilar-associated-press-ceo-pay-study-2026.html).
  - Huang 3.58% (NVDA DEF 14A 2026). Zuckerberg about 13.5% economic and 60.6% voting (Meta PRE 14C Oct 2026).
  - HFR Q4 2025 fees 1.33% / 15.83%.
  - Ternus CEO from 1 Sep 2026. Cook Form 4: +374,541 M / −199,038 F / −191,753 S at about $331–334 / −26,325 G / 3,237,843 held (https://www.sec.gov/Archives/edgar/data/0000320193/000114036126038674/form4.xml). That stake is still over $1B at about $340.
  - Form 4 deadline: 2 business days.
- **Ch25:**
  - Lynch 29% a year, 1977–90.
  - Buffett 2008 letter "price is what you pay".
  - Abel CEO from 1 Jan 2026.
- **Ch26:**
  - S&P 500 price returns 24.2 / 23.3 / 16.4% (total 26.3 / 25.0 / 17.9%).
  - SPIVA YE2025 large-cap underperformance: 85.6% over 10 years, 89.9% over 15, 92.9% over 20 (secondary source; spglobal.com blocked automated fetch).
  - K&T loss ratio about 2–2.25×.
  - DCA arithmetic.
- **Ch27:**
  - S&P bear-market drawdowns (−86 / −48 / −49 / −57 / −34 / −25%) and the gain needed to recover from each.
  - 1% fee line (1.09^20 = 5.604).
- **Ch28:**
  - 2026–27 rates (0 / 15 / 30 / 37 / 45%; thresholds 18,200 / 45,000 / 135,000 / 190,000) plus 2% Medicare.
  - Minors' $416 threshold.
  - Franking ($3.50 → $5.00).
  - CBA FY26 dividend $5.05, fully franked (2.70 final + 2.35 interim, CBA 12 Aug 2026), which carries $2.16 of credits.
  - SG 12% from 1 Jul 2025.
  - TBC $2.1M from 1 Jul 2026 (ATO).
  - Div 296 (30% / 40%) passed Parliament on 10 Mar 2026, starts 1 Jul 2026.
  - W-8BEN 15% vs 30%; TFN withholding 47%.
- **Ch29:**
  - Nikkei: 38,916 peak (1989); beaten Feb 2024; 2025 +26% to 50,339.
  - 2025 returns: DAX +23%, FTSE +21.5%, Nifty +10.5%, Bovespa +34%.
  - IMF WEO Oct 2026: India 7.0%, China 4.5%.
  - INR 94.94 on 23 Oct 2026 and about 45 in 2006 (FRED).
  - BABA $319 → $58 (−82%).
  - Nubank 139M customers (Q2 2026 release).
  - PCAOB access from Dec 2022.

## Unverifiable figures (and what I did)
- **Ch29 market caps by country** (US $77.95T, China $15.61T etc., "Bloomberg via Yahoo, May 2026"): no primary source reachable. Already labelled "about" and dated May 2026. Kept.
- **Ch29 ASX 200 sector weights** (financials about 33%, materials about 20%, IT about 3%): the S&P factsheet wasn't fetchable. These are already approximate ("about", "approx."). Kept.
- **Ch29 Nifty level at end-Oct 2026** relies on one secondary source (Oquilia, 27 Oct close 22,750). The new 9.5% figure is rounded and stated as "about".
- **Ch29 China GDP "about $20T" and India "about $4T"** (IMF nominal USD for 2026): couldn't open the WEO table. Both are already rounded with "about". Kept.
- **Ch26 SPIVA long-horizon percentages:** primary PDF blocked (403). They match the secondary source to rounding. Kept.
- **Ch22 AmEx $60 → $35 and the "$13M, about 40% of his partnership"** are widely reported (Fortune, Buffett biographies), but there's no filing. Already "about". Kept.
- **Ch23/25 Druckenmiller 2009 Jeff Feig interview "1 hr 23 min" and other video lengths:** not checked against YouTube. Board labels only. Kept.

## Note for the coordinator (outside my range)
Ch08 and Ch20 still use the 28 Oct S&P 500 close of about 7,744 ("about 7,700"). The 30 Oct close was 7,580.07, so check those against the house rule.
