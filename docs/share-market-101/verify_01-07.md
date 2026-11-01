# Verification: Chapters 1–7 (checked 1–2 Nov 2026)

Prices use the 30 Oct 2026 close unless noted. Lint: `sm_src.py` regenerated; `sm_lint.py 101 102 201 202 301 302 401 402 501 502 601 602 603 604 701 702 703` → OK.

## Every change

| chapter | old | new | source URL |
|---|---|---|---|
| 1 | "Seven times in ten years is about twenty-two percent growth" | "about twenty-one percent" ($14.4B→$100.1B = 6.95x → 21.4%/yr) | https://www.sec.gov/Archives/edgar/data/1652044/000165204426000018/goog-20251231.htm |
| 2 | "Three times in twenty-six years is about four and a half percent a year" | "almost five percent a year" (A$2.59→A$8.50 = 4.7%/yr) | https://github.com/TheEconomist/big-mac-data (big-mac-raw-index.csv: AUS 2000-04 2.59, 2026-07 8.50) |
| 2 | Board quote "McDonald's customers rage over menu prices that have nearly tripled in a decade" (NY Post, 15 May 2024) | "New York Post, May 2024 / McDonald's prices up more than 100% in a decade, some items nearly tripled" | FinanceBuzz study as syndicated: https://www.fox5atlanta.com/news/mcdonalds-menu-hikes-mcdouble-up-168-mcchicken-200-in-10-years |
| 2 | narration "menu prices that had nearly tripled in a decade" | "menu prices that had more than doubled in a decade, with some items nearly tripling" | same as above (study: menu up 100%+; McDouble ~2.7x, McChicken 3x) |
| 3 | Board "Instagram @hmdk, June 2025" | "Instagram @hmdk" (date unverifiable) | n/a |
| 4 | Gold today "about four thousand and thirty" (29 Oct) | "about four thousand dollars" (week of 26–30 Oct ranged ~$3,880–$4,040; no LBMA fix found for 29/30 Oct) | https://pricegold.net/2026/october/ |
| 4 | Gold multiple "about one hundred and fifteen times"; bar 115 / "≈115x", cue `fifteen` | "about one hundred and fourteen times"; bar 114 / "≈114x", cue `fourteen` | as above ($4,000 ÷ $35) |
| 4 | Gold chart last point 4,030; src "29 Oct 2026" | 4,000; src "late Oct 2026 ~$4,000" | as above |
| 4 | World gold "about twenty-nine trillion"; bar 28.6; answer "gold ~$29T"; src "× $4,030/oz" | "about twenty-eight trillion"; bar 28.4; "~$28T"; "× ~$4,000/oz" | 220,700 t × ~$4,000 = $28.4T |
| 6 | 1997 "a loss of about thirty million"; bar 30 / "–$30M" | "about twenty-eight million"; bar 27.6 / "–$27.6M" (1997 net loss $27.59M) | Amazon 1997 10-K, SEC EDGAR |
| 6 | AMZN "around thirty-two percent a year"; Jack "Thirty-two percent versus ten"; bar label "~32%/yr" | "thirty-one" / "~31%/yr" (3,204x over 29.46 yrs = 31.5%/yr) | https://stockanalysis.com/stocks/amzn/history/ (30 Oct 2026 close $240.35) |
| 6 | $10k at IPO "around thirty-three million"; chart end 33,333,333; note "~$33 million"; bar 33.3M "~$33M"; cues `thirty-three` | "around thirty-two million"; 32,046,667; "~$32 million"; 32.0M "~$32M"; cues `thirty-two` | $240.35 × 240 (splits) ÷ $18 |
| 6 | src "AMZN ~$250 Oct 2026" | "AMZN $240.35, 30 Oct 2026" | as above |
| 6 | Claude answer "one Alphabet share at about $320" | "about $280" (matches narration; $279.84 close) | https://stockanalysis.com/stocks/googl/history/ |
| 6 | "about three and a half trillion dollars, for Alphabet"; kinetic "12.3 billion × $280" | "about three point four trillion"; "12.2 billion × $280 ≈ $3.4 trillion" | https://companiesmarketcap.com/ (Alphabet $3.42T) |
| 6 | Norway "its biggest holdings are Nvidia, Apple and Alphabet" | "its biggest holdings include Nvidia, Apple and Microsoft" (latest reported top three) | https://www.nbim.no/en/the-fund/ ; NBIM 2025 annual results coverage |
| 6 | Bezos stake "worth well over two hundred billion" | "worth more than two hundred billion" (8.16% × ~$2.6T ≈ $212B) | Form 4, Aug 2026: https://www.sec.gov/Archives/edgar/data/0001018724/000101872426000028/wk-form4_1785962062.xml |
| 7 | Mega-cap race: Nvidia 5.5, Apple 5.0, Microsoft 3.9, Alphabet 3.8, Amazon 2.7, Meta 1.6; asof "As at October 2026 (approx.)" | Coordinator's course-wide snapshot: Apple 5.03, Nvidia 4.94, Microsoft 3.88, Alphabet 3.42, Amazon 2.60, Meta 1.57; asof "As at end of October 2026"; narration "As at the end of October 2026" | https://companiesmarketcap.com/ ; NVDA close $204.64 https://stockanalysis.com/stocks/nvda/history/ |
| 7 | "Nvidia alone is worth more than twice Australia's GDP… Apple and Microsoft are each bigger than Australia's GDP too" | "…for a whole year. So is Apple. Microsoft is bigger than Australia's GDP too." | as above (Apple $5.03T, NVDA $4.94T vs 2 × $2.11T) |
| 1 | Chart: S&P 500 since Google IPO, last point 7.07x | 6.92x (7,580.07 on 30 Oct 2026 ÷ 1,095.17 on 19 Aug 2004); narration "about seven times" unchanged | S&P 500 30 Oct close per coordinator; FRED SP500 https://fred.stlouisfed.org/series/SP500 |
| 7 | Board "Jeff Bezos (CNBC, May 2026):" | "Jeff Bezos:" (quote reported by aggregators; CNBC source/date unconfirmed) | https://officechai.com/learn/jeff-bezos-explains-why-america-produces-so-many-successful-companies/ |

## Verified, no change needed (main items)
- Ch1: Alphabet net income 2014 $14.4B, 2024 $100.1B, 2025 $132.2B (10-K); GOOGL $279.84 on 30 Oct after falling from $324.89 to $283.82 on 29 Oct (Q3 results 28 Oct); IPO $85 → ~$2.13 split-adjusted → ~131x; S&P 500 ~6.9x (1,095 → 7,580 on 30 Oct); AWS 2025 $128.7B; Google Cloud 2025 $58.7B; Azure $75B+ FY25; Synergy Q2 2026 shares 28/20/15.
- Ch2: Fed 3.75–4.00% (held 28 Oct 2026, federalreserve.gov); RBA 4.60%, fourth 2026 hike on 29 Sep; Selic 14% (Aug 2026); IMF WEO Oct 2026 inflation US 3.6, AUS 3.9, UK 3.3, BRA 4.4, ARG 32.5; Big Mac AUS $8.50 and US $6.22 (Jul 2026); Argentina 2023 211%; $100 S&P 2014→2024 ≈ $340, Google ≈ 7x.
- Ch3: all compounding maths; Berkshire 19.9% vs S&P 10.4% (1965–2024); Buffett ~$144B (Forbes, 18 Sep 2026, via secondary report).
- Ch4/5: 10-yr 4.98%, 30-yr 5.32% on 29 Oct 2026 (US Treasury); gold Jan 2026 peak $5,589 (28 Jan), 2025 +~65% to ~$4,320; BTC ~60% dominance, ~$1.6T of ~$2.7T (CoinMarketCap via CoinStats, 23 Oct); Savills $393.3T; Ocorian shares $156.7T (Aug 2026, +14% YTD), bonds $137T+ (Sep 2026); 2005–2025 index price returns consistent with S&P 500 1,212→6,846.
- Ch6: Fed Z.1 Q2 2026 total US corporate equities $123.7T; rest of world 18.0%, ETFs 10.3%, mutual funds 15.1% (2010: 13.2/3.1/24.0; 2024: 18.0/9.0/16.9) via FRED; ICI $51.2T / IRAs $19.9T / 401(k) $10.8T; ICI index share 19% (2010) → 52% (2025); APRA super A$4.77T (Jun 2026); HFR $5.64T (Q3 2026); Harvard $68B (FY26); NBIM 22,683bn NOK (30 Jun 2026), ~1.5% of listed companies, ~7,100 companies; Bezos 8.16%.
- Ch7: IMF WEO Oct 2026 GDP (US 32.64, CN 21.55, DEU 5.47, JPN 4.34, GBR 4.27, IND 4.06 … AUS 2.11, #14 above Spain 2.09; world 128.0; EU 22.81); real growth US 2.3, CN 4.5, AUS 1.9, IND 7.0; GDP per capita AUS $75,172, IND $2,750; India female LFPR 40.0% (PLFS 2025); Forbes 2026 richest per country (Rinehart, Zhang Yiming, Platt, Arnault, Schwarz, Ambani, Jason Chang, Saverin) per forbes.it 7 Apr 2026.

## Unverifiable figures and what I did
| chapter | figure | action |
|---|---|---|
| 2 | NY Post headline wording and exact date (15 May 2024) | Replaced the quoted headline with the verifiable study finding; kept month only |
| 2 | Bondi 2-bed rent "few hundred a week (2000) → $1,000+ (2026)" | Left: told as Mum's recollection, already rounded and hedged |
| 3 | Hasan Minhaj @hmdk reel date (June 2025) | Removed the date |
| 3 | Buffett Forbes series 1990–2001 points (via GOBankingRates) | Left: secondary but consistent with Forbes 400 history; chart labelled "Forbes estimates" |
| 4 | Gold price on 29/30 Oct 2026 (no LBMA fix found) | Rounded to "about $4,000" |
| 6 | Bezos angel round ($981k, ~20 angels, ~60 meetings) | Left: matches Fortune/BI reporting cited in file; not in a filing |
| 6 | Fed Z.1 households 42.1%, pensions 8.2%, companies 3.1% | Could not open Z.1 L.223 directly; the ROW, ETF, mutual-fund and total lines all matched exactly, so the rest left as is |
| 6 | Norway top holdings at mid-2026 | Softened to "include Nvidia, Apple and Microsoft" |
| 6 | US listed companies 3,908 (2025) / 8,090 (1996) | 3,908 confirmed only via a secondary copy of World Bank data; 8,090 is the long-standing WB figure. Left |
| 7 | Bezos "best risk capital system in the world by far" (CNBC, May 2026) | Kept quote (consistent across secondary reports), removed CNBC/date attribution |
| 7 | China share of world manufacturing in 2000 (~6%, UNIDO) and series points | Left: endpoints (China ~27–30%, passed US ~2010) agree with World Bank-based sources |
