# Raw capture: ModelArk Content filter (the page the "Content_Pre-filter" URL actually resolves to)

Source: https://docs.byteplus.com/zh-CN/docs/ModelArk/Content_Pre-filter
Captured: 2026-09-15, via the Browser pane (original page was Chinese; content below is the English-language version of the same doc, found via the sidebar link, since the zh-CN URL and the English "ModelArk Content filter overview" doc are the same underlying article).

At BytePlus, we're committed to harnessing the power of AI responsibly and ethically... BytePlus offers the Content filter System, a robust protection mechanism adaptable for diverse application scenarios. This content filter can detect specific categories of potentially risky content in input prompts and output completions, and will implement corresponding measures, such as refusing to answer or returning a more benign response.

## How to enable/disable
Integrated into ModelArk's Online Inference custom endpoint interface. Enabled by default on new endpoints. Can be toggled per-endpoint (Custom inference endpoints, Preset inference endpoints, batch inference endpoints) via the edit button on the endpoint list page; takes effect immediately.

Important notes from the page: "The implementation of Content filter shall not be construed as a warranty by BytePlus regarding the appropriateness, or compliance of AI generated content. The user remains solely responsible for the usage of any generated content and shall bear all liability and damages arising from such use." Even with the feature disabled, BytePlus states it still maintains baseline content safety policies.

## How it works
When enabled, the system detects and identifies risky content during online dialogues or API calls. For API callers, the `finish_reason` field in the response is set to `"content_filter"` when content is filtered, e.g.:
```json
{
  "choices": [
    {
      "finish_reason": "content_filter",
      "index": 0,
      "logprobs": null,
      "message": { "content": "Let's talk about something else", "role": "assistant" }
    }
  ]
}
```

## What data does the content filter system filter?
- Minor Safety: infringement of personal privacy of children/adolescents, harm to their physical and mental health.
- Hate Speech and Hateful Content: discrimination based on race, nationality, ethnicity, sexual orientation, personal appearance, or physical disability, etc.
- Nudity, Sexual, and Graphic Content: pornography, abuse, violence, self-harm, etc.
- Misinformation: content that is clearly deceptive and significantly inconsistent with facts.

Note: this is BytePlus's *general* safety filter - it does not, on this page, specifically call out real-person/celebrity-likeness blocking. That specific mechanism is documented instead in doc 2 (Advanced Creation Rights - the Real-human Portrait Library) and doc 4's own FAQ (celebrity-resemblance blocking tied to face-reference ID drift).

## Data privacy and protection
When Content filter is enabled, BytePlus retains logs from its use and the risk-related content data it filtered, for a limited period, on servers in Malaysia or Singapore. Used to help troubleshoot and ensure normal operation. States encryption for transmission/storage and access controls/audit logging are in place.

Last updated (on BytePlus's page): September 10, 2026.
