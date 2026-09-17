# Raw capture: Private virtual portrait library tutorial

Source: https://docs.byteplus.com/en/docs/ModelArk/2333565
Captured: 2026-09-15, via the Browser pane. Full Go/Python/cURL code samples condensed to their essential call shape (real request/response fields kept, boilerplate SDK setup trimmed) - the real API surface (actions, fields, moderation flag) is preserved in full.

## Real correction to flag every time this doc is referenced
This library is for **fictional/virtual** characters. Its own terms explicitly require the uploaded asset NOT resemble a real person:
> "The asset must not resemble any real human person's portrait, must not be plagiarized or misappropriated, and must not infringe upon any third party's personality rights, intellectual property rights, or other legal interests."

The separate mechanism for a REAL person's likeness is the "Private Real-Person Portrait Library" (referenced by name in this doc and in doc 2, not directly linked by the user in this research round) - gated behind the same Advanced Creation Rights tiers (doc 2).

## Prerequisites
Full asset-library features require Advanced Creation Rights (doc 2) - capacity quota is shared between the Private Virtual Avatar Asset Library and the Real-human Portrait Library.

## Structure
- **Asset Group**: each Asset belongs to a Group (e.g. group all assets of the same character together).
- **Asset**: a file (image/video/audio) trusted by Seedance 2.0/2.5 for inference.
- Only assets actually added to the library can be referenced by Asset ID in generation; un-added assets of "the same" character cannot.
- Uploaded assets are preprocessed asynchronously - poll `GetAsset`'s `Status` field; usable only once `Active`. `Failed` means preprocessing failed, asset unusable.

## Image asset requirements
- Format: jpeg, png, webp, bmp, tiff, gif, heic/heif
- Aspect ratio (width/height): (0.4, 2.5)
- Width and height: (300, 6000) px
- Max file size: 30 MB
- Recommended pair per character, for consistent face/clothing/detail rendering: (1) full-body reference - vertical layout, full-body frontal image; (2) facial close-up - vertical layout, frontal close-up above the shoulders, no expression, face occupying ~2/3 of frame.

## Assets API (requires Access Key/AK-SK authentication)
Creation: `CreateAssetGroup` (first use requires signing an authorization letter in console), `CreateAsset`.
Management: `ListAssetGroups`, `ListAssets`, `GetAsset`, `GetAssetGroup`, `UpdateAssetGroup`, `UpdateAsset`, `DeleteAsset`, `DeleteAssetGroup`.

Rate limits (per account): CreateAssetGroup 10 QPS; CreateAsset varies by rights tier (see doc 2); ListAssetGroups/ListAssets/GetAssetGroup/UpdateAsset/UpdateAssetGroup 10 QPS; GetAsset 100 QPS; DeleteAsset 10 QPS; DeleteAssetGroup 5 QPS.

### CreateAssetGroup fields
`Name`, `Description`, `GroupType` (optional, defaults `AIGC`, currently the only supported value), `ProjectName` (optional, defaults `default` - resources in a project are only usable by inference endpoints in that same project).
Response: `{"Id": "group-20260318033332-*****"}`

### CreateAsset fields
`GroupId` (required), `URL` (required, accessible image URL), `AssetType` (required: Image/Video/Audio), `Name` (optional, used only for fuzzy search via ListAssets, not used in inference), `Moderation` (optional - `{"Strategy": "Skip"}` skips most non-baseline Content Pre-filter review for this asset; Content Pre-filter review is ON by default; the console-level toggle for skip capability must be enabled first), `ProjectName` (optional, defaults `default`).
Response: `{"Id": "asset-20260318071009-*****"}`
Note: async - processing may queue, no upload-time SLA guaranteed. This call uploads ONE asset per request.

### GetAsset response shape (example)
```json
{
  "GroupId": "group-20260318033332-7vw4m",
  "Status": "Active",
  "Moderation": { "Strategy": "Default" },
  "CreateTime": "2026-03-18T03:57:10Z",
  "AssetType": "Image",
  "UpdateTime": "2026-03-18T03:57:14Z",
  "LastInferenceTime": "2026-07-24T10:08:49+08:00",
  "ProjectName": "default",
  "Id": "asset-20260318035710-*****",
  "Name": "",
  "URL": "https://ark-media-asset-ap-southeast-1.tos-ap-southeast-1.volces.com/..."
}
```
`LastInferenceTime` = most recent time the asset was used in a submitted generation task (based on submission time, not completion). Statuses: `Active`, `Processing`, `Failed`.

### ListAssets / ListAssetGroups
Query by GroupId/Statuses/Name (fuzzy), sortable by CreateTime etc., NextToken or page-number pagination.

### Project isolation gotcha (their own FAQ)
Asset library is isolated by `ProjectName`. Inference must use an endpoint in the same project as the asset. If upload succeeds but retrieval fails, the likely cause is mismatched `ProjectName` between the CreateAsset and retrieval calls. Default project is `default` if unspecified - recommend managing assets within one consistent project.

### IAM permission example
Custom policy to grant asset-library management:
```json
{
  "Statement": [
    { "Effect": "Allow", "Action": ["ark:*Asset*"], "Resource": ["*"] }
  ]
}
```
Granted via Access control > Create policy, then User management > authorize a user/group with that policy (optionally scoped to a specific project).

## Referencing assets in a generation prompt
Reference by **position**, never by raw Asset ID in the prompt text: "Image 1", "Video 1", "Audio 1" - the index is the asset's position within its type in the request body. The Asset ID only appears as a URI in the request's reference list: `asset://<Asset_Id>`.
Example prompt style (their own, verbatim): "The girl in Image 1 is wearing the outfit from Image 2 and is arranging items on the counter. The boy in Image 3 is a customer who walks up and asks the girl for her contact information."

## Real API call shape (Python, condensed from their sample)
```python
from byteplussdkarkruntime import Ark
client = Ark(
    base_url="https://ark.ap-southeast.bytepluses.com/api/v3",
    api_key=os.environ.get("ARK_API_KEY"),
)
create_result = client.content_generation.tasks.create(
    model="dreamina-seedance-2-0-260128",
    content=[
        {"type": "text", "text": "<full prompt text, referencing Image 1/Image 2/etc positionally>"},
        {"type": "image_url", "image_url": {"url": "asset://asset-20260225023032-gnzwk"}, "role": "reference_image"},
        {"type": "image_url", "image_url": {"url": "https://.../some_other_ref.png"}, "role": "reference_image"},
    ],
    generate_audio=True,
    ratio="16:9",
    duration=11,
    watermark=True,
)
task_id = create_result.id
# poll:
get_result = client.content_generation.tasks.get(task_id=task_id)
# get_result.status in {"succeeded", "failed", ...}; get_result.error on failure
```
Same submit-then-poll task shape our own fal.ts/modal_app.py already use - `tasks.create()` returns an id immediately, `tasks.get(task_id)` polls status, `succeeded`/`failed` outcomes.

Equivalent raw cURL:
```
POST https://ark.ap-southeast-1.bytepluses.com/api/v3/contents/generations/tasks
Authorization: Bearer $ARK_API_KEY
Content-Type: application/json
{
  "model": "seedance-2-0-260128",
  "content": [ {"type": "text", "text": "..."}, {"type": "image_url", "role": "reference_image", "image_url": {"url": "asset://asset-..."}}, ... ],
  "generate_audio": true,
  "ratio": "16:9",
  "duration": 11,
  "watermark": false
}
```

## FAQ (real, from the page)
1. **Why can't I generate/retrieve after a successful upload?** Asset library is project-isolated - inference must use an endpoint in the asset's project; mismatched `ProjectName` between calls is the usual cause.
2. **How to manage user permissions?** Via IAM custom policy (`ark:*Asset*` action) granted to users/groups, optionally scoped to a project.
3. **How to reference uploaded assets in the prompt?** By type+positional-index (`Image 1`, `Video 1`, `Audio 1`), matching the asset's position within its type in the request body - never by raw Asset ID in the prompt text itself.

Last updated (on BytePlus's page): September 1, 2026.
