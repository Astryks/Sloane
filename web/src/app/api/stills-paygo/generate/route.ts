import { NextRequest } from "next/server";
import { getPaygoSessionUser } from "@/lib/auth";
import {
  initSchema,
  spendStillCredits,
  refundStillCredits,
  getStillCreditBalanceCents,
} from "@/lib/db";
import {
  STILL_CREDIT_PACKS,
  isStillEngine,
  stillCostCents,
} from "@/lib/stillsPaygo";
import { generateImageVariants, hasEnoughFalBalanceToGenerate } from "@/lib/fal";
import { publicJson } from "@/lib/mediaProxy";

// generateImageVariants polls up to 120s.
export const maxDuration = 130;

const MAX_PROMPT_LENGTH = 2000;

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getPaygoSessionUser();
    if (!user) {
      return publicJson(
        { error: "Buy still credits first - no account needed" },
        { status: 401 },
      );
    }

    const body = (await req.json()) as { prompt?: string; engine?: string };
    const prompt = String(body.prompt ?? "").trim();
    const engineRaw = String(body.engine ?? "");

    if (!isStillEngine(engineRaw)) {
      return publicJson({ error: "Unknown still engine" }, { status: 400 });
    }
    if (!prompt) {
      return publicJson({ error: "Describe the still you want" }, { status: 400 });
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return publicJson(
        { error: `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)` },
        { status: 400 },
      );
    }

    if (!(await hasEnoughFalBalanceToGenerate())) {
      return publicJson(
        {
          error:
            "Image generation is temporarily paused while we top up - please try again shortly.",
        },
        { status: 503 },
      );
    }

    const cost = stillCostCents(engineRaw);
    const spent = await spendStillCredits(user.id, cost);
    if (!spent) {
      const balanceCents = await getStillCreditBalanceCents(user.id);
      return publicJson(
        {
          error: "Not enough still credit - buy a pack to keep generating",
          needCents: cost,
          balanceCents,
          packs: STILL_CREDIT_PACKS.map((p) => ({
            id: p.id,
            creditsCents: p.creditsCents,
            priceUsdCents: p.priceUsdCents,
            label: p.label,
          })),
        },
        { status: 402 },
      );
    }

    try {
      const urls = await generateImageVariants(prompt, engineRaw, [], 1);
      const imageUrl = urls[0];
      if (!imageUrl) {
        await refundStillCredits(user.id, cost);
        return publicJson({ error: "Generation returned no image" }, { status: 502 });
      }
      return publicJson({ imageUrl });
    } catch (err) {
      await refundStillCredits(user.id, cost);
      console.error("stills-paygo generate failed after spend", err);
      const message = err instanceof Error ? err.message : "Generation failed";
      return publicJson({ error: message }, { status: 502 });
    }
  } catch (err) {
    console.error("stills-paygo generate failed", err);
    const message = err instanceof Error ? err.message : "Generation failed";
    return publicJson({ error: message }, { status: 500 });
  }
}
