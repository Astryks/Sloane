# Shot Pacing Research: Average Shot Length (ASL) by Content Type

Real, academically-sourced data on how many seconds a shot stays on screen before cutting, across films, commercials, and short-form content - grounds the `PACE_PRESETS` in `web/src/lib/directorMode.ts`. Every figure below is cited; gaps are flagged explicitly rather than filled with a guess.

## 1. Film, by genre and era

**Historical decline (multiply-sourced academic consensus)**: ASL fell from ~8-12s (1930s-1960s) to often under 2-4s in modern action films.
- James E. Cutting, "Attention and the Evolution of Hollywood Film," *Psychological Science*, 2010 (150 films, 1935-2005): ASL declined from ~12s (1930) to ~2.5s (contemporary). *Quantum of Solace* measured at 1.7s.
- Cutting, Brunick, DeLong, Iricinschi & Candan, "Quicker, Faster, Darker: Changes in Hollywood Film over 75 Years," *i-Perception*, 2011 (160 films, 1935-2010): linear decline from ~10s (1930s) to below 4s (post-2000).
- Barry Salt, "Statistical Style Analysis of Motion Pictures," *Film Quarterly*, 1974 - originator of the ASL metric; dataset of ~15,000 films.
- Wikipedia "Post-classical editing" (citing David Bordwell, *Film Quarterly*, 2002): general feature-film ASL fell to 4.3-4.9s; double-digit ASLs "virtually disappeared" from mainstream features by the 1980s.

**By genre** (Stephen Follows, "How many shots are in the average movie?," Cinemetrics-derived sample, films 1997-2016):

| Genre | ASL |
| --- | --- |
| Action | 4.0s |
| Adventure | 5.1s |
| Sci-fi | 6.2s |
| Horror | 15.7s |

Horror's high average likely reflects slow-burn/atmospheric horror in the sample rather than modern jump-scare-heavy subgenres specifically - a real, useful finding: horror as a genre trends toward *slower*, dread-building shots on average, not faster ones.

**Individual reference points** (Cinemetrics/Filmmakers Academy): *Bourne Supremacy* 2.4s, *Babel* 3.3s, *Psycho* 6.2s, *Vertigo* 7.0s, *Pulp Fiction* 7.9s, *The Godfather* 8.4s, *8½* 10.9s, *A Clockwork Orange* 11.6s, *2001: A Space Odyssey* 13.0s, *Barry Lyndon* 13.3s. Director extremes: Paul W.S. Anderson 2.4s avg vs. Michael Haneke 26.4s avg.

## 2. UGC / TikTok / Instagram Reels

**No peer-reviewed academic ASL study exists for short-form UGC** - this is the weakest-sourced section; every figure here is trade/marketing-blog consensus, not measured research, and should be treated accordingly:
- TikTok cuts commonly cited at 1-2s for high-energy content, 4-8s for calm talking-head/tutorial content (creator-economy trade guidance, not an independent dataset).
- TikTok Marketing Science + Kantar (secondhand-cited, original report not independently verified): 90% of ad-recall impact captured within the first 6 seconds of a TikTok ad, across a 3,500-ad analysis.
- Instagram Reels: 15s Reels ~8-12 cuts (~1.2-1.8s/shot); 30s Reels ~15-20 cuts (marketing-agency blog estimate, not a platform-published or academic dataset).

## 3. TV Commercials / Super Bowl Ads

**Primary academic source**: MacLachlan, J. & Logan, M., "Camera Shot Length in TV Commercials and Their Memorability and Persuasiveness," *Journal of Advertising Research*, Vol. 33, No. 2 (1993).

- TV commercial ASL: 3.8s (1978) → 2.3s (1991).
- Shots per 30-second commercial: 8 avg (1978-1984) → 10.6 avg (1986-1991) → 13.2 (1991).
- **Super Bowl-specific (1989)**: ad ASL = 2.0s, vs. 8.9s for the surrounding game broadcast itself - ads cut ~4.5x faster than the program around them.
- Recall/persuasion by shot count: 1-5 shots scored 115 recall / 100 persuasion index; 20+ shots scored 83 recall / 81 persuasion - fewer, longer shots outperformed rapid cuts by 36-39% in this dataset.
- The commonly-repeated "25-30 shots per 30-second spot" figure (e.g., PremiumBeat) appears only in trade commentary, not a cited dataset - flagged as directionally plausible for modern ads but not an academically verified re-measurement of the 1991 baseline. No modern (2000s-2020s) peer-reviewed replication of this study was found - a real gap in the literature.

## 4. Documentary / Slow Cinema

**No peer-reviewed ASL figure specifically labeled "documentary" as a genre was found** - a confirmed gap, not a guess.

**Slow/contemplative narrative cinema** (Cinemetrics-derived, via unspokencinema.blogspot.com and cross-referenced sources):

| Film / Director | ASL |
| --- | --- |
| Russian Ark (Sokurov, 2002) | 96 min (single continuous shot) |
| Five (Kiarostami, 2005) | 885s |
| The Man from London (Tarr, 2007) | 264s |
| Werckmeister Harmonies (Tarr, 2000) | 228s |
| Sátántangó (Tarr, 1994) | 153s |
| Eternity and a Day (Angelopoulos, 1998) | 114s |
| Jeanne Dielman (Akerman, 1975) | 51.4s |
| Stalker (Tarkovsky, 1979) | 68s |

Tarkovsky's ASL rose across his career to ~33s (*Mirror*), then ~60s+ for his final three films. Béla Tarr's full-career average is ~192s. Contemporary mainstream film (2-6s ASL) runs at roughly 1/15th to 1/100th the shot duration of these directors.

## Summary table (used to derive `PACE_PRESETS`)

| Content type | ASL | Source |
| --- | --- | --- |
| Classic Hollywood (1930s-60s) | 8-12s | Bordwell/Salt/Cutting |
| Modern drama | 4-6s | Wikipedia/Bordwell |
| Modern action | 2-4s (as low as 1.7s) | Cutting 2010; Follows |
| Horror (genre avg) | 15.7s | Follows/Cinemetrics |
| Sci-fi | 6.2s | Follows |
| Adventure | 5.1s | Follows |
| TV commercial, 1991 | 2.3s | MacLachlan & Logan 1993 |
| Super Bowl ad, 1989 | 2.0s | MacLachlan & Logan 1993 |
| TV broadcast program (non-ad), 1989 | 8.9s | MacLachlan & Logan 1993 |
| TikTok/Reels (trade consensus, unverified) | 1-3s | Marketing blogs, not peer-reviewed |
| Documentary | No cited figure found - gap | - |
| Slow cinema | 51s - 96min | Cinemetrics-derived |

**Confidence ranking**: film-genre ASL (strong, multiply-corroborated academic sourcing) > commercial/Super Bowl (strong for 1978-1991, real gap for modern re-measurement) > slow cinema (good sourcing, one minor internal discrepancy noted between sources) > UGC/TikTok (weakest - no academic literature exists yet, trade-blog consensus only).
