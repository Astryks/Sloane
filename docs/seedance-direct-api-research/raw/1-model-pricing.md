# Raw capture: BytePlus ModelArk pricing

Source: https://docs.byteplus.com/en/docs/ModelArk/1544106
Captured: 2026-09-15, via the Browser pane (plain fetch only returns the JS-shell nav, not body content - this page is a client-rendered SPA).
Only the Video generation models and Image generation models sections are reproduced in full below (the LLM/embedding/3D/Managed-Agents pricing tables above them in the original page are real but not relevant to this research and were captured in the conversation transcript, not repeated here).

## Video generation models

Limited-time discount:
- Seedance 2.5: From 14:00 (UTC+8) on August 14, 2026 through 14:00 (UTC+8) on September 17, 2026, 1080p output is billed at 28% off the list price (480p and 720p output are not eligible for the discount), with prices starting at approximately USD 0.41 per second.
- Seedance 2.0 mini: From 14:00 (UTC+8) on August 7, 2026 through 14:00 (UTC+8) on October 7, 2026, both 480p and 720p output are billed at 60% off the list price. For 720p output, the price starts at approximately USD 0.03 per second.
- Seedance 2.0 fast: From 14:00 (UTC+8) on August 7, 2026 through 14:00 (UTC+8) on October 7, 2026, both 480p and 720p output are billed at 25% off the list price. For 720p output, the price starts at approximately USD 0.09 per second.

Video pricing is determined by both the token rate and token consumption. Under otherwise identical conditions: a video generated at a higher resolution costs more than one generated at a lower resolution; a video generated with video input costs more than one generated without video input.

Estimated video price: Token unit price x Token consumption
Estimated token consumption = (Input video duration + Output video duration) x Output video width x Output video height x Output video frame rate / 1024
You are only charged for successfully generated videos. No fee is charged if generation fails due to reasons such as content moderation.

### Price examples - Dreamina Seedance 2.5 (16:9, 5s output)

Input without video:
- 480p: 0.514 per video / 0.103 per second
- 720p: 1.156 per video / 0.231 per second
- 1080p: 2.843 per video / 0.569 per second

Input with video (2-30s input, 5s output):
- 480p: 0.553-2.152 (lowest = 2-4s input, highest = 30s input)
- 720p: 1.244-4.838
- 1080p: 3.062-11.907

### Price examples - Dreamina Seedance 2.0 series (16:9, 5s output)

Input without video:
| Resolution | Seedance 2.0 | Seedance 2.0 Fast | Seedance 2.0 Mini |
| --- | --- | --- | --- |
| 480p | 0.35/video (0.07/s) | 0.28/video (0.06/s) | 0.18/video (0.04/s) |
| 720p | 0.76/video (0.15/s) | 0.60/video (0.12/s) | 0.38/video (0.08/s) |
| 1080p | 1.87/video (0.37/s) | not supported | not supported |
| 4K | 3.89/video (0.78/s) | not supported | not supported |

Input with video (2-15s input, 5s output), price range low=2-4s input, high=15s input:
| Resolution | Seedance 2.0 | Seedance 2.0 Fast | Seedance 2.0 Mini |
| --- | --- | --- | --- |
| 480p | 0.39-0.86 | 0.30-0.66 | 0.19-0.42 |
| 720p | 0.84-1.86 | 0.64-1.43 | 0.41-0.91 |
| 1080p | 2.06-4.57 | not supported | not supported |
| 4K | 4.20-9.33 | not supported | not supported |

### Older models (for reference)

Seedance 1.5 Pro (16:9, 5s):
| Resolution | Audio video | Draft audio | Silent | Draft silent |
| --- | --- | --- | --- | --- |
| 480p | 0.12 | 0.07 | 0.06 | 0.04 |
| 720p | 0.26 | n/a | 0.13 | n/a |
| 1080p | 0.58 | n/a | 0.29 | n/a |

Seedance 1.0 Pro / 1.0 Pro Fast: full resolution x ratio x frame-rate x duration x token table captured in the live conversation transcript (2026-09-15) - omitted here since these are legacy models, not the ones under consideration.

## Image generation models

| Model | Input image price | Output image price |
| --- | --- | --- |
| dola-seedream-5-0-pro-260628 | First free, then $0.003/image | $0.045 (<=1.5K px) / $0.09 (>1.5K px) per single image; layer decomposition half that |
| seedream-5-0-lite-260128 | Free | $0.035 |
| seedream-4-5-251128 | Free | $0.04 |
| seedream-4-0-250828 | Free | $0.03 |
| seededit-3-0-i2i-250628 | Free | $0.03 |

Images that fail due to content moderation are not billed. Last updated (on BytePlus's page): September 11, 2026.
