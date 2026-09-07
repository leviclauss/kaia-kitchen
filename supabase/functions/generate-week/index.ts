/**
 * generate-week — ad-hoc LLM week meal plan via Chutes (OpenAI-compatible).
 * Secrets: CHUTES_API_KEY (required), CHUTES_MODEL (optional).
 * Auto env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or ANON_KEY).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const HOUSEHOLD_ID = "c0ffee00-5a1a-4000-8000-00000000cafe";
const SLOT_KEYS = ["breakfast", "snack1", "lunch", "snack2", "dinner"] as const;
const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function clampRatio(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 60;
  return Math.max(0, Math.min(100, Math.round(v)));
}

type BookMeal = {
  id: string;
  name: string;
  meal_type: string;
  recipe: string | null;
  notes: string | null;
  liked: boolean;
};

function buildPrompt(meals: BookMeal[], existingRatio: number) {
  const liked = meals.filter((m) => m.liked);
  const bookList = meals
    .map(
      (m) =>
        `- id=${m.id} | type=${m.meal_type} | liked=${m.liked ? "yes" : "no"} | name=${m.name}` +
        (m.recipe ? ` | recipe=${m.recipe.slice(0, 120)}` : "") +
        (m.notes ? ` | notes=${m.notes.slice(0, 80)}` : ""),
    )
    .join("\n");

  const targetBook = Math.round((35 * existingRatio) / 100);
  const targetNew = 35 - targetBook;

  return `You are a pediatric meal planner for Kaia, a ~13-month-old toddler who eats soft finger foods.

HARD ALLERGY RULES (never violate):
- NEVER include peanut, walnut, cashew, pistachio, or almond in any form (including butters, flours, milks, oils, "nut mix", pesto with nuts, etc.).
- Prefer soft, mashable, graspable finger-food textures appropriate for ~13 months. No choking hazards (whole grapes, hard raw chunks, whole nuts/seeds, sticky globs of nut butter).

TASK:
Generate a full week plan: 7 days (Monday=0 … Sunday=6) × 5 slots: breakfast, snack1, lunch, snack2, dinner (35 slots total).

BOOK vs NEW mix:
- existingRatio = ${existingRatio} (0 = invent all new; 100 = only from the recipe book below).
- Aim for about ${targetBook} slots from the book (source="book") and ${targetNew} invented (source="new").
- When using the book, PREFER liked meals (liked=yes). Match meal_type when possible: breakfast→breakfast, snack1/snack2→snack, lunch→lunch, dinner→dinner (or type=any).
- For book slots: set mealId to the exact uuid, title to the book name (you may lightly adapt presentation), copy recipe/notes if useful.
- For new slots: invent soft finger-food meals; mealId must be null; include a short recipe (1–4 tiny steps) and optional notes.

Variety: avoid repeating the exact same title more than twice in the week. Keep titles parent-friendly and concise.

RECIPE BOOK (${meals.length} meals, ${liked.length} liked):
${bookList || "(empty — invent everything as new)"}

Respond with STRICT JSON only (no markdown fences, no commentary). Schema:
{
  "days": [
    {
      "dayIndex": 0,
      "dayName": "Monday",
      "slots": {
        "breakfast": { "title": string, "recipe": string|null, "notes": string|null, "source": "book"|"new", "mealId": string|null },
        "snack1": { ... },
        "lunch": { ... },
        "snack2": { ... },
        "dinner": { ... }
      }
    }
  ]
}
Include all 7 days and all 5 slots every day.`;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* continue */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    return JSON.parse(fence[1].trim());
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("Model did not return parseable JSON");
}

function normalizePlan(raw: unknown, meals: BookMeal[]) {
  const byId = new Map(meals.map((m) => [m.id, m]));
  const root = raw as Record<string, unknown>;
  let daysIn = root.days;
  if (!Array.isArray(daysIn) && Array.isArray(root.week)) daysIn = root.week;
  if (!Array.isArray(daysIn)) throw new Error("Plan missing days array");

  const days = [];
  for (let di = 0; di < 7; di++) {
    const dayRaw =
      (daysIn as Record<string, unknown>[]).find(
        (d) => Number(d.dayIndex) === di,
      ) || (daysIn as Record<string, unknown>[])[di] || {};
    const slotsRaw = (dayRaw.slots as Record<string, unknown>) || dayRaw;
    const slots: Record<string, unknown> = {};
    for (const key of SLOT_KEYS) {
      const s = (slotsRaw[key] || {}) as Record<string, unknown>;
      let source = s.source === "book" ? "book" : "new";
      let mealId =
        typeof s.mealId === "string" && s.mealId
          ? s.mealId
          : typeof s.meal_id === "string"
          ? s.meal_id
          : null;
      let title = String(s.title || "").trim();
      let recipe =
        s.recipe != null && String(s.recipe).trim()
          ? String(s.recipe).trim()
          : null;
      let notes =
        s.notes != null && String(s.notes).trim()
          ? String(s.notes).trim()
          : null;

      if (mealId && byId.has(mealId)) {
        source = "book";
        const m = byId.get(mealId)!;
        if (!title) title = m.name;
        if (!recipe && m.recipe) recipe = m.recipe;
        if (!notes && m.notes) notes = m.notes;
      } else if (source === "book" && title) {
        const match = meals.find(
          (m) => m.name.toLowerCase() === title.toLowerCase(),
        );
        if (match) {
          mealId = match.id;
          if (!recipe && match.recipe) recipe = match.recipe;
          if (!notes && match.notes) notes = match.notes;
        } else {
          source = "new";
          mealId = null;
        }
      } else {
        source = "new";
        mealId = null;
      }

      if (!title) title = `Soft ${key} idea`;
      slots[key] = { title, recipe, notes, source, mealId };
    }
    days.push({
      dayIndex: di,
      dayName: DAY_NAMES[di],
      slots,
    });
  }
  return { days };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  try {
    const chutesKey = Deno.env.get("CHUTES_API_KEY");
    if (!chutesKey) {
      return json(
        {
          error:
            "CHUTES_API_KEY not configured. Set it with: supabase secrets set CHUTES_API_KEY=...",
        },
        503,
      );
    }

    const model =
      Deno.env.get("CHUTES_MODEL") || "deepseek-ai/DeepSeek-V3";

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const existingRatio = clampRatio(body.existingRatio ?? 60);
    const weekStart =
      typeof body.weekStart === "string" ? body.weekStart : null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { data: meals, error: mealsErr } = await sb
      .from("meals")
      .select("id, name, meal_type, recipe, notes, liked")
      .eq("household_id", HOUSEHOLD_ID)
      .order("liked", { ascending: false })
      .order("name", { ascending: true });

    if (mealsErr) {
      console.error(mealsErr);
      return json({ error: "Failed to load recipe book", detail: mealsErr.message }, 500);
    }

    const book = (meals || []) as BookMeal[];
    const prompt = buildPrompt(book, existingRatio);

    const llmRes = await fetch("https://llm.chutes.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chutesKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You output only valid JSON objects matching the schema the user requests. No markdown.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      console.error("Chutes error", llmRes.status, errText);
      return json(
        {
          error: "Chutes API request failed",
          status: llmRes.status,
          detail: errText.slice(0, 500),
        },
        502,
      );
    }

    const llmJson = await llmRes.json();
    const content =
      llmJson?.choices?.[0]?.message?.content ??
      llmJson?.choices?.[0]?.message?.reasoning_content ??
      "";
    if (!content || typeof content !== "string") {
      return json({ error: "Empty model response", raw: llmJson }, 502);
    }

    const parsed = extractJson(content);
    const plan = normalizePlan(parsed, book);

    const bookCount = plan.days.reduce((n, d) => {
      return (
        n +
        SLOT_KEYS.filter((k) => (d.slots as Record<string, { source: string }>)[k].source === "book")
          .length
      );
    }, 0);

    return json({
      ok: true,
      weekStart,
      existingRatio,
      model,
      stats: {
        bookSlots: bookCount,
        newSlots: 35 - bookCount,
        bookMealsAvailable: book.length,
      },
      plan,
    });
  } catch (err) {
    console.error(err);
    return json(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});
