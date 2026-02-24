/**
 * Gemini Service
 * Handles all AI interactions with built-in rotation and usage tracking.
 */
import { auth } from "../lib/firebase";

const PRICING = {
  pro: { input: 1.25 / 1000000, output: 5.0 / 1000000 },
  flash: { input: 0.075 / 1000000, output: 0.3 / 1000000 },
  "flash-lite": { input: 0.0375 / 1000000, output: 0.15 / 1000000 },
};

const getModelTier = (model) => {
  if (model.includes("pro")) return "pro";
  if (model.includes("lite") || model.includes("8b")) return "flash-lite";
  return "flash";
};

const estimateTokens = (text) => {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
};

const updateUsageStats = (
  keyIndex,
  model,
  status,
  inputTokens,
  outputTokens,
) => {
  try {
    const stats = JSON.parse(
      localStorage.getItem("gemini_usage_stats") || "{}",
    );
    const key = `key_${keyIndex}`;
    if (!stats[key]) stats[key] = {};
    if (!stats[key][model])
      stats[key][model] = {
        success: 0,
        failure: 0,
        429: 0,
        inputTokens: 0,
        outputTokens: 0,
      };

    const mStats = stats[key][model];
    if (status === "success") {
      mStats.success++;
      mStats.inputTokens += inputTokens;
      mStats.outputTokens += outputTokens;
    } else if (status === 429) {
      mStats["429"]++;
    } else {
      mStats.failure++;
    }

    localStorage.setItem("gemini_usage_stats", JSON.stringify(stats));
  } catch (e) {
    console.error("Failed to update usage stats", e);
  }
};

const DEFAULT_BOOTSTRAP_KEY =
  import.meta.env.VITE_GEMINI_API_KEY || "USE_PROXY";

const getKeys = (primaryKey, userProfile) => {
  let rawKeys = [];

  // 1. Determine if user is allowed to use Custom Keys
  //    Allowed: Tier 5 (Planeswalker) OR Admin
  const tier = userProfile?.subscription_tier;
  const isAdmin =
    userProfile?.role === "admin" || userProfile?.settings?.isAdmin === true;
  const isAllowedCustomKeys = tier === "tier_5" || isAdmin;

  // 2. If allowed, push their custom keys
  if (isAllowedCustomKeys) {
    if (primaryKey) rawKeys.push(primaryKey);
    if (
      userProfile?.settings?.geminiApiKeys &&
      Array.isArray(userProfile.settings.geminiApiKeys)
    ) {
      userProfile.settings.geminiApiKeys.forEach((k) => {
        if (k && !rawKeys.includes(k)) rawKeys.push(k);
      });
    }
  }

  // 3. ALWAYS add the bootstrap key (The Default Proxy)
  //    If they aren't allowed custom keys, this will be the ONLY key they get.
  if (!rawKeys.includes(DEFAULT_BOOTSTRAP_KEY)) {
    rawKeys.push(DEFAULT_BOOTSTRAP_KEY);
  }

  // Harden: Split by space and trim to remove any shell redirection junk (like '>> .env')
  const keys = rawKeys.filter(Boolean).map((k) => k.split(" ")[0].trim());

  return [...new Set(keys)].slice(0, 5);
};

const PRO_MODELS = [
  "gemini-2.5-pro",
  "gemini-1.5-pro",
];

const FLASH_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
];

const PREFERRED_MODELS = [...PRO_MODELS, ...FLASH_MODELS];

const cleanResponse = (text) => {
  if (!text) return "";
  console.log("DEBUG: Raw AI Response:", text); // Debugging truncation
  let cleaned = text
    .replace(/```json/g, "")
    .replace(/```html/g, "")
    .replace(/```/g, "")
    .trim();

  // Enhanced Truncation Repair
  if (cleaned.startsWith("{") && !cleaned.endsWith("}")) {
    // 1. Fix open strings (unbalanced unescaped quotes)
    const quotes = (cleaned.match(/"/g) || []).length;
    if (quotes % 2 !== 0) {
      cleaned += '"';
    }

    // 2. Fix specific known array truncation patterns
    if (cleaned.includes('"suggestions"')) {
      const lastBracket = cleaned.lastIndexOf("[");
      const lastCloseBracket = cleaned.lastIndexOf("]");

      // If we have an open array that hasn't closed
      if (lastBracket > lastCloseBracket) {
        // Check if we are mid-object
        const lastOpenCurly = cleaned.lastIndexOf("{");
        const lastCloseCurly = cleaned.lastIndexOf("}");

        if (lastOpenCurly > lastCloseCurly) {
          // We are inside an object that isn't closed. Close it first.
          cleaned += " }";
        }

        // Now close the array
        cleaned += " ]";
      }
    }

    // 3. Final safety net: Close the main object if needed
    cleaned = cleaned.trim();
    if (!cleaned.endsWith("}")) {
      if (cleaned.endsWith(",")) cleaned = cleaned.slice(0, -1);
      cleaned += "}";
    }
  }
  return cleaned;
};

const parseResponse = (text) => {
  try {
    return JSON.parse(cleanResponse(text));
  } catch (e) {
    console.error(
      "JSON Parse Error at position:",
      e.message.match(/position (\d+)/)?.[1] || "unknown",
    );
    // Log a snippet of where it failed
    const posMatch = e.message.match(/position (\d+)/);
    if (posMatch) {
      const pos = parseInt(posMatch[1]);
      console.error(
        "Context around error:",
        text.substring(Math.max(0, pos - 50), pos + 50),
      );
    }
    return { aiResponse: text, updatedDraft: {} };
  }
};

/**
 * Strips heavy data (base64 images, sample responses) from a persona/helper object
 * before passing it to AI prompts to prevent token overflow.
 */
function sanitizeHelper(helper) {
  if (!helper) return null;
  const { avatar_url, avatar, photo_url, sample_responses, personality_base64, ...clean } = helper;
  return clean;
}

// Diagnostic: List models for a key to verify what it can see
const verifyModels = async (key) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
    );
    if (response.ok) {
      const data = await response.json();
      const names =
        data.models?.map((m) => m.name.replace("models/", "")) || [];
      console.log(
        `[GeminiService] DIAGNOSTIC: Available Models for key ...${key.slice(-4)}:`,
        names.join(", "),
      );
    } else {
      console.warn(
        `[GeminiService] DIAGNOSTIC: Failed to list models for key ...${key.slice(-4)}`,
        response.status,
      );
    }
  } catch (e) {
    console.error(
      `[GeminiService] DIAGNOSTIC: Network error listing models`,
      e,
    );
  }
};

const GeminiService = {
  async executeWithFallback(payload, userProfile = null, options = {}) {
    const primaryKey = options.apiKey;
    const keys = getKeys(primaryKey, userProfile);
    const models = options.models || PREFERRED_MODELS;

    let failureSummary = [];
    let hitOverall429 = true;

    let inputTokens = 0;
    if (payload.contents) {
      payload.contents.forEach((c) =>
        c.parts.forEach((p) => {
          if (p.text) inputTokens += estimateTokens(p.text);
        }),
      );
    }
    if (payload.systemInstruction || payload.system_instruction) {
      const sysParts = (payload.systemInstruction || payload.system_instruction)
        .parts;
      sysParts.forEach((p) => {
        if (p.text) inputTokens += estimateTokens(p.text);
      });
    }

    const requiresBeta = !!(
      payload.system_instruction ||
      payload.systemInstruction ||
      payload.generationConfig?.responseSchema ||
      payload.generationConfig?.responseMimeType
    );
    const deadKeys = new Set();

    for (const model of models) {
      let hit429ForAllKeysThisModel = true; // Assume throttled until we see success or non-429

      for (let kIdx = 0; kIdx < keys.length; kIdx++) {
        const key = keys[kIdx];
        if (deadKeys.has(key)) continue;

        const methods = ["v1beta", "v1"];
        const method = options.method || "generateContent";
        for (const apiVer of methods) {
          try {
            const url = `https://generativelanguage.googleapis.com/${apiVer}/models/${model}:${method}?key=${key}`;

            // Deep copy to prevent reference pollution across versions/models
            let finalPayload = JSON.parse(JSON.stringify(payload));

            if (apiVer === "v1" && requiresBeta) {
              // STRICT V1 COMPATIBILITY:
              // The v1 endpoint DOES NOT support system_instruction or responseSchema,
              // even for newer models (as verified by logs). We must strip them.

              const systemParts = (
                finalPayload.systemInstruction ||
                finalPayload.system_instruction
              )?.parts;
              const systemText = systemParts?.[0]?.text;

              if (systemText) {
                // Move system instruction to a fake user message
                finalPayload.contents = [
                  {
                    role: "user",
                    parts: [
                      {
                        text: `SYSTEM INSTRUCTION: ${systemText}\n\nUNDERSTOOD. I will follow those instructions exactly.`,
                      },
                    ],
                  },
                  {
                    role: "model",
                    parts: [{ text: "Understood. I am ready." }],
                  },
                  ...(finalPayload.contents || []),
                ];
                delete finalPayload.system_instruction;
                delete finalPayload.systemInstruction;
              }

              // Strip beta generation config fields
              if (finalPayload.generationConfig) {
                delete finalPayload.generationConfig.responseSchema;
                delete finalPayload.generationConfig.responseMimeType;
              }
            }

            const isProxyKey = key === DEFAULT_BOOTSTRAP_KEY;
            let response;

            if (isProxyKey) {
              // PROXY ROUTE (Secure)
              // We don't send the key; the server handles it.
              response = await fetch("/api/ai/generate", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: auth.currentUser
                    ? `Bearer ${await auth.currentUser.getIdToken()}`
                    : "",
                },
                body: JSON.stringify({
                  model,
                  method,
                  apiVersion: apiVer,
                  data: finalPayload,
                }),
              });
            } else {
              // DIRECT ROUTE (User's Custom Key)
              response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(finalPayload),
              });
            }

            if (!response.ok) {
              let errorMsg = response.status.toString();
              let isInvalidKey = false;
              let errData = null;
              try {
                errData = await response.json();
                if (errData.error?.message) {
                  errorMsg = errData.error.message;
                  const lower = errorMsg.toLowerCase();
                  if (
                    lower.includes("api key not valid") ||
                    lower.includes("invalid api key") ||
                    lower.includes("expired") ||
                    lower.includes("deleted")
                  )
                    isInvalidKey = true;
                }
              } catch (e) {
                /* ignore */
              }

              // START FIX: Check for Insufficient Credits (Do not kill key)
              if (
                response.status === 403 &&
                errData?.code === "INSUFFICIENT_CREDITS"
              ) {
                const creditErr = new Error(
                  errData.message || "Insufficient AI Credits",
                );
                creditErr.code = "INSUFFICIENT_CREDITS";
                throw creditErr;
              }
              // END FIX

              if (isInvalidKey || response.status === 403) {
                console.warn(
                  `[GeminiService] Killing Key ${kIdx}. Reason: ${errorMsg}`,
                );
                deadKeys.add(key);
                failureSummary.push(
                  `Key ${kIdx}: ${isInvalidKey ? "Invalid" : response.status}`,
                );
                continue; // Try next key
              }

              if (response.status === 429) {
                hitOverall429 = true;
                updateUsageStats(kIdx, model, 429, 0, 0);
                failureSummary.push(`Key ${kIdx}: 429`);
                console.warn(
                  `[GeminiService] 429 for ${model}@${apiVer}. Key ${kIdx}. Trying next key...`,
                );
                break; // Break versions, try next KEY for the SAME model
              }

              if (response.status === 404) {
                failureSummary.push(`${model}@${apiVer}: 404 (Not Found)`);
                console.warn(
                  `[GeminiService] 404 Not Found: ${model}@${apiVer}. URL: ${url}`,
                );
                hitOverall429 = false;
                hit429ForAllKeysThisModel = false;

                // Run diagnostic ONCE per key if we hit a 404
                if (!deadKeys.has(key)) {
                  verifyModels(key).catch((e) => console.error(e));
                }
                continue;
              }

              // Other errors (400, 500, etc)
              console.warn(
                `[GeminiService] ${response.status} for ${model}@${apiVer}. Key ${kIdx}. Msg: ${errorMsg}`,
              );
              if (response.status === 400 && errData) {
                console.warn(
                  `[GeminiService] 400 Error Body:`,
                  JSON.stringify(errData, null, 2),
                );
              }

              failureSummary.push(`Key ${kIdx}: ${response.status}`);
              updateUsageStats(kIdx, model, "failure", 0, 0);

              // For v1beta 400s, maybe v1 works? For v1 400s, maybe next key?
              // Default behavior: continue to next version (v1beta -> v1) or next loop
              continue;

              // 400 Bad Request or 500
              console.error(
                `[GeminiService] ${model}@${apiVer} error ${response.status}:`,
                errorMsg,
                errData,
              );
              failureSummary.push(`${model}@${apiVer}: ${errorMsg}`);
              updateUsageStats(kIdx, model, response.status, 0, 0);
              hitOverall429 = false;
              hit429ForAllKeysThisModel = false; // Not a 429, so this model isn't fully throttled
              break; // Try next key
            }

            // Success
            const data = await response.json();

            // Fire event to update credits in UI instantly
            if (
              data.credits_monthly !== undefined ||
              data.credits_topup !== undefined
            ) {
              if (typeof window !== "undefined") {
                const evt = new CustomEvent("auth:update-credits", {
                  detail: {
                    credits_monthly: data.credits_monthly,
                    credits_topup: data.credits_topup,
                    credits_used: data.credits_used || 0,
                  },
                });
                window.dispatchEvent(evt);
              }
            }

            // Handle PREDICT results (e.g. Imagen)
            if (data.predictions) {
              return {
                predictions: data.predictions,
                meta: { model }
              };
            }

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const outTokens = estimateTokens(text);
              updateUsageStats(kIdx, model, "success", inputTokens, outTokens);
              return {
                text,
                meta: {
                  model,
                  tokens: data.usageMetadata?.totalTokenCount || 0,
                  promptTokens: data.usageMetadata?.promptTokenCount || 0,
                  candidatesTokens:
                    data.usageMetadata?.candidatesTokenCount || 0,
                },
              };
            }
          } catch (e) {
            // START FIX: Bubble up credit errors immediately
            if (e.code === "INSUFFICIENT_CREDITS") throw e;
            // END FIX

            failureSummary.push(`${model}@${apiVer} Error: ${e.message}`);
            hit429ForAllKeysThisModel = false; // Not a 429, so this model isn't fully throttled
          }
        }
      }

      // If we got here, this model tier failed across all keys.
      // If it was mostly 429s, pause a second to let quota breathe before trying next model.
      if (hitOverall429 && hit429ForAllKeysThisModel) {
        console.warn(
          `[GeminiService] All keys 429'd for ${model}. Pausing 2s...`,
        );
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    if (hitOverall429 && typeof window !== "undefined" && window.addToast) {
      window.addToast("Gemini rate limit reached across all keys.", "warning");
    }

    const finalErr = new Error(
      `Oracle Exhausted: ${failureSummary.join(" | ")}`,
    );
    finalErr.reason = hitOverall429 ? "rate_limit" : "exhausted";
    throw finalErr;
  },

  // --- BLUEPRINT ARCHITECTURE METHODS ---

  /**
   * PHASE 1: THE ARCHITECT
   * Generates a high-level strategy blueprint with specific card packages and dynamic ratios.
   */
  async generateDeckBlueprint(
    apiKey,
    commander,
    userProfile,
    collectionMode = false,
  ) {
    const systemMessage = `You are a Master Deck Architect for Magic: The Gathering.
        GOAL: Create a high-power, cohesive deck blueprint for [${commander.name}].
        PHILOSOPHY: Do not build a "pile of staples". Build an ENGINE.
        
        TASK:
        1. Define a creative Strategy Name (e.g. "Aristocrats of the Ghost Council").
        2. Define 3-5 specific "Card Packages" that form the engine (e.g. "Sacrifice Outlets", "Death Trigger Payoffs", "Recursion Loop").
        3. Assign target card counts to each package.
        4. Define the "Vegetable" targets (Lands, Ramp, Interaction) based on the specific mana curve of this strategy.
           - Aggro might need 33 lands. Control might need 38. YOU DECIDE.
           - Ensure the total of Packages + Vegetables = ~63 (assuming 36 lands + 1 commander, but adjust lands as needed).
        
        CRITICAL CONSTRAINTS:
        - COLOR IDENTITY: You MUST strictly adhere to the Commander's Color Identity. Do not suggest or plan for any cards that have pips outside this identity.
        - LEGALITY: You MUST NOT suggest strategies that rely on Commander Banned cards.
        
        OUTPUT JSON:
        {
            "strategyName": "String",
            "description": "Short description of the game plan.",
            "packages": [
                { "name": "Package Name", "description": "Specific search criteria", "count": 8, "type": "Synergy" }
            ],
            "foundation": {
                "lands": 36,
                "nonBasicLands": 15,
                "creatures": 25,
                "ramp": 10,
                "draw": 10,
                "interaction": 10,
                "wipes": 3
            }
        }`;

    const userQuery = `Commander: ${commander.name} (${commander.oracle_text})
        Mode: ${collectionMode ? "Collection Restricted (Be flexible)" : "Discovery (Ideal Build)"}
        Output the Blueprint in JSON.`;

    const payload = {
      contents: [
        { role: "user", parts: [{ text: systemMessage + "\n\n" + userQuery }] },
      ],
      generationConfig: { responseMimeType: "application/json" },
    };

    const response = await this.executeWithFallback(payload, userProfile, {
      apiKey,
      models: this.PRO_MODELS,
    });
    return {
      result: parseResponse(response.text),
      meta: response.meta,
    };
  },

  /**
   * PHASE 2: THE CONTRACTOR
   * Fetches a specific package of cards, respecting collection constraints if needed.
   */
  async fetchPackage(
    apiKey,
    packageDef,
    currentDeck,
    userProfile,
    candidates = [],
    constraints = {},
  ) {
    const isCollectionMode = candidates && candidates.length > 0;
    const setRestriction =
      constraints?.restrictedSets?.length > 0
        ? `RESTRICTION: You MUST ONLY suggest cards from these set codes: ${constraints.restrictedSets.join(", ")}. Do NOT suggest cards from any other sets.`
        : "";

    const systemMessage = `You are a Deck Contractor.
        MISSION: Find exactly ${packageDef.count} cards for the package: "${packageDef.name}".
        DESCRIPTION: ${packageDef.description}
        COMMANDER: ${currentDeck.commander?.name}
        ${setRestriction}
        
        ${isCollectionMode
        ? `CONSTRAINT: You MUST select cards from the provided [CANDIDATE POOL] below. 
               - If perfect matches aren't found, choose the best available functional substitutes from the pool.
               - Do NOT suggest cards not in the pool.`
        : `CONSTRAINT: Search the entire MTG history for the absolute best synergies.
           CRITICAL CONSTRAINTS:
           - COLOR IDENTITY: You MUST STRICTLY adhere to the Commander's color identity. No off-color cards (e.g. no green cards in a red deck).
           - LEGALITY: Do NOT suggest any card that is banned in the Commander format.`
      }
            
        OUTPUT JSON:
        { "suggestions": [ { "name": "Card Name", "reason": "Why it fits", "role": "Synergy", "rating": 1-10, "set": "optional set code", "collectorNumber": "optional cn" } ] }
        CRITICAL: You MUST provide a 'rating' (integer 1-10) for every card, representing its power level/synergy in this deck. 10=Perfect, 1=Weak.
        If the user requested 'cheapest', bias your 'set' and 'collectorNumber' towards mass reprints (e.g., Commander precons, Masters sets).
        `;

    const candidateText = isCollectionMode
      ? `[CANDIDATE POOL (Filtered by Color)]\n${candidates
        .slice(0, 800)
        .map((c) => `- ${c.name} (${c.type_line})`)
        .join("\n")}` // Cap at 800 to fit context
      : "";

    const userQuery = `Fetch ${packageDef.count} cards for "${packageDef.name}".\n${candidateText}`;

    const payload = {
      contents: [
        { role: "user", parts: [{ text: systemMessage + "\n\n" + userQuery }] },
      ],
      generationConfig: { responseMimeType: "application/json" },
    };

    const response = await this.executeWithFallback(payload, userProfile, {
      apiKey,
      models: [...this.PRO_MODELS, ...this.FLASH_MODELS],
    });
    return {
      result: parseResponse(response.text),
      meta: response.meta,
    };
  },

  async generateDeckSuggestions(
    apiKey,
    payload,
    helper = null,
    userProfile = null,
    options = {},
  ) {
    const {
      deckName,
      commander,
      strategyGuide,
      helperPersona,
      targetRole,
      candidates,
      currentContext,
      neededCount,
      buildMode,
      commanders,
      instructions,
      restrictedSets,
    } = payload;

    const helperName = helperPersona?.name || helper?.name || "The Oracle";
    const helperTone =
      helperPersona?.personality ||
      helper?.personality ||
      "Professional and helpful";

    const systemMessage = `You are ${helperName}. Your personality is: ${helperTone}.
        VOICE: Strictly adhere to your personality. Address the user as an equal.
        CORE MISSION:
        - EXECUTE THE DECK STRATEGY: ${strategyGuide}
        - SPECIAL INSTRUCTIONS: ${instructions || "None provided."}
        - SET RESTRICTION: ${restrictedSets && restrictedSets.length > 0 ? `Only suggest cards from the following set codes: ${restrictedSets.join(", ")}. PROHIBITION: Do NOT suggest any card from any other set.` : "None."}
        - STAMP OF COMPLETION (CRITICAL): You are being asked to provide a COMPLETE deck skeleton. You must return EXACTLY the number of cards requested in [REQUEST]. 
        - UNDER-REPORTING IS A FAILURE: If I ask for 99 cards, returning 40 or 60 is a failure. You must fill the "suggestions" array until the requested count is met.
        - SYNERGY PRIORITIZATION: Prioritize cards that enable triggers or mechanics mentioned in the commander's text.
        - COLOR IDENTITY: Suggest cards matching: ${payload.commanderColorIdentity}.
        - CONTEXT AWARENESS: DO NOT suggest cards already in deck: ${JSON.stringify(currentContext)}.
        - TOKEN EFFICIENCY: Your 'reason' for each card MUST be a short fragment (3-6 words). Example: "Top-tier ramp." or "Key synergy piece." Do not waste tokens on full sentences.
        
        ALLOWED ROLES:
        Assign one of: 'Synergy / Strategy', 'Mana Ramp', 'Card Draw', 'Targeted Removal', 'Board Wipes', 'Land'.

        CRITICAL INSTRUCTIONS FOR DISCOVERY MODE:
        Search entire MTG history. Resolve by Name. Recommend 'set' and 'collectorNumber'.
        - CHEAPEST PRINTING: If the User's [SPECIAL FOCUS] or strategy implies budget/cheapest, strictly prioritize mass reprints (e.g., Commander precons, Masters sets) over standard non-foil printings for the 'set' and 'collectorNumber'.
        - LEGALITY: You MUST NOT suggest any cards that are banned in the Commander format.
        - STRICT COLOR IDENTITY: You MUST strictly adhere to the Commander's Color Identity: ${payload.commanderColorIdentity}. NEVER include off-color cards.
        
        CRITICAL INSTRUCTIONS FOR COLLECTION MODE:
        Only suggest from [CANDIDATE POOL]. Use 'firestoreId'.`;

    const commanderDetail = (commanders || [])
      .map((c) => `[${c.name}] (${c.type_line}) - Oracle: ${c.oracle_text}`)
      .join("\n");

    const userQuery = `
            DECK: ${deckName}
            [COMMANDER(S)]
            ${commanderDetail || commander}
            
            [COLOR IDENTITY] ${payload.commanderColorIdentity}
            [STRATEGY] ${strategyGuide}
            [RESTRICTED SETS] ${restrictedSets && restrictedSets.length > 0 ? restrictedSets.join(", ") : "Global Search (No Restriction)"}
            [SPECIAL FOCUS] ${instructions || "None"}
            [STATUS] Current deck contains: ${JSON.stringify(currentContext)}
            [REQUEST] I need the following counts for these specific roles: ${JSON.stringify(payload.deckRequirements || { [targetRole]: neededCount })}
            [MODE] ${buildMode === "discovery" ? "DISCOVERY (Global Search)" : "COLLECTION (Strict Pool)"}
            
            ${buildMode !== "discovery" ? `[CANDIDATE POOL]\n${candidates.map((c) => `ID: ${c.firestoreId || c.id} | Name: ${c.name} | Type: ${c.type_line}`).join("\n")}` : ""}
        `;

    const payload_obj = {
      system_instruction: { parts: [{ text: systemMessage }] },
      contents: [{ role: "user", parts: [{ text: userQuery }] }],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        responseSchema: {
          type: "OBJECT",
          properties: {
            suggestions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  firestoreId: {
                    type: "STRING",
                    description:
                      "The ID from the pool, or 'discovery' for new cards",
                  },
                  name: { type: "STRING" },
                  rating: {
                    type: "NUMBER",
                    description:
                      "MANDATORY: 1-10 integer score. Do NOT leave null.",
                  },
                  reason: {
                    type: "STRING",
                    description: "Brief justification (max 12 words)",
                  },
                  set: {
                    type: "STRING",
                    description: "Scryfall set code (e.g. 'mkm')",
                  },
                  collectorNumber: {
                    type: "STRING",
                    description: "Scryfall collector number",
                  },
                  role: {
                    type: "STRING",
                    description:
                      "MUST be one of: 'Synergy / Strategy', 'Mana Ramp', 'Card Draw', 'Targeted Removal', 'Board Wipes', 'Land'",
                  },
                },
                required: [
                  "firestoreId",
                  "name",
                  "rating",
                  "reason",
                  "set",
                  "collectorNumber",
                  "role",
                ],
              },
            },
          },
        },
      },
    };

    const response = await this.executeWithFallback(payload_obj, userProfile, {
      apiKey,
      ...options,
    });
    return {
      result: parseResponse(response.text),
      meta: response.meta,
    };
  },

  async analyzeDeck(
    apiKey,
    deckList,
    commanderName,
    helper = null,
    userProfile = null,
  ) {
    const helperName = helper?.name || "The Oracle";
    const helperPersonality =
      helper?.personality || "Analytical, critical, and constructive.";

    const deckContext =
      deckList
        .map((c) => `${c.countInDeck || 1}x ${c.name} (${c.set})`)
        .join("\n") +
      `\n\nTotal Lands: ${deckList.reduce((acc, c) => (c.type_line?.toLowerCase().includes("land") ? acc + (c.countInDeck || 1) : acc), 0)}`;

    const prompt = `You are ${helperName}. Analyze this Commander deck for "${commanderName}".
        
        [DECKLIST]
        ${deckContext}
        
        [INSTRUCTIONS]
        Perform a clinical evaluation. Be critical but constructive.
        1. Calculate a Score (0-100).
        2. Identify 3-5 critical structural Issues.
        3. Propose up to 5 surgical Swaps with 'remove', 'add', 'reason'.
        4. Focus on Mana Curve, Synergy density, and Interaction package.`;

    const payload = {
      system_instruction: { parts: [{ text: prompt }] },
      contents: [
        {
          role: "user",
          parts: [
            { text: `Analyze this Commander deck for "${commanderName}"` },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            score: { type: "NUMBER" },
            metrics: {
              type: "OBJECT",
              properties: {
                synergy: { type: "NUMBER" },
                speed: { type: "NUMBER" },
                interaction: { type: "NUMBER" },
              },
            },
            issues: { type: "ARRAY", items: { type: "STRING" } },
            changes: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  remove: { type: "STRING" },
                  add: { type: "STRING" },
                  reason: { type: "STRING" },
                },
                required: ["remove", "add", "reason"],
              },
            },
          },
          required: ["score", "metrics", "issues", "changes"],
        },
      },
    };

    const response = await this.executeWithFallback(payload, userProfile, {
      apiKey,
    });
    return {
      result: parseResponse(response.text),
      meta: response.meta,
    };
  },

  async sendMessage(
    apiKey,
    history,
    message,
    context = "",
    helper = null,
    userProfile = null,
  ) {
    const helperName = helper?.name || "MTG Forge";
    const helperPersonality =
      helper?.personality || "Knowledgeable, friendly, and concise.";

    const systemPrompt = `You are ${helperName}, an elite Magic: The Gathering AI strategist and companion.
        
        [PERSONALITY]
        ${helperPersonality}
        
        [RESPONSE GUIDELINES]
        - Output ONLY raw HTML. Do not use Markdown blocks (no \`\`\`html).
        - Use Tailwind CSS classes for styling.
        - Primary font color should be text-gray-300 unless highlighting.
        - Use <strong class="text-primary-400"> for card names or key terms.
        - Use <ul class="space-y-1 list-disc pl-4 my-2"> for lists.
        - Use <div class="p-2.5 bg-primary-500/10 border border-primary-500/20 rounded-lg my-2"> for emphasis or summary blocks.
        - CRITICAL: Never use h-full, min-h-screen, items-center, or justify-center on top-level containers. Let the chat bubble determine its own height.
        
        [CONTEXT]
        ${context}
        
        You are interacting with the user inside their personal deck-building laboratory. Be helpful, strategic, and stay in character.`;

    const contents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      ...history.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    const payload = { contents };
    // FORCE FLASH MODELS FOR CHAT
    const response = await this.executeWithFallback(payload, userProfile, {
      apiKey,
      models: FLASH_MODELS,
    });
    return {
      result: cleanResponse(response.text),
      meta: response.meta,
    };
  },

  async spruceUpText(apiKey, text, type = "General", userProfile = null) {
    const payload = {
      system_instruction: {
        parts: [
          {
            text: `You are a professional editor. Rewrite the following ${type} text to be professional, evocative, and structured for a high-end gaming application. Use basic HTML (<b>, <i>, <ul>, <li>). Do not use markdown blocks.`,
          },
        ],
      },
      contents: [{ role: "user", parts: [{ text: text }] }],
    };
    const response = await this.executeWithFallback(payload, userProfile, {
      apiKey,
      models: FLASH_MODELS,
    });
    return response.text
      .replace(/```html/g, "")
      .replace(/```/g, "")
      .trim();
  },

  async getDeckStrategy(
    apiKey,
    commanderInput,
    playstyle = null,
    existingCards = [],
    helper = null,
    userProfile = null,
  ) {
    const helperName = helper?.name || "The Oracle";
    const helperPersona =
      helper?.personality || "Wise, mystical, and strategic.";

    // Parse Commander Details
    const commanders = Array.isArray(commanderInput)
      ? commanderInput
      : typeof commanderInput === "string"
        ? [{ name: commanderInput }]
        : [commanderInput];
    const commanderContext = commanders
      .map((c) => {
        const name = c.name || c.data?.name || "Unknown Commander";
        const cost =
          c.mana_cost || c.cmc || c.data?.mana_cost || c.data?.cmc || "N/A";
        const type = c.type_line || c.data?.type_line || "Legendary Creature";
        const text =
          c.oracle_text || c.data?.oracle_text || "Refer to global knowledge";
        return `NAME: ${name}\nMANA COST: ${cost}\nTYPE: ${type}\nTEXT: ${text}`;
      })
      .join("\n---\n");

    const playstyleContext = playstyle
      ? `USER PLAYSTYLE PROFILE:\n- Summary: ${playstyle.summary}\n- Archetypes: ${playstyle.archetypes?.join(", ")}\n- Aggression: ${playstyle.scores?.aggression}/10`
      : "USER PLAYSTYLE: Unknown, assume balanced competitive-casual.";

    const systemPrompt = `You are ${helperName}. Your personality is: ${helperPersona}.
        
        MISSION:
        Generate a unique, high-level Commander STRATEGY BLUEPRINT for a deck led by:
        ${commanderContext}

        ${playstyleContext}
        
        CRITICAL RULES:
        1. **100 CARDS TOTAL**: The 'layout' counts MUST sum up to exactly 100 cards when including the ${commanders.length} commander(s).
        2. **DYNAMIC LAYOUT**: Tailor "Functional" and "Type" counts to the strategy.
        3. **VISUAL AESTHETICS**: You are a UI Designer as much as a Strategist. Your output must be VISUALLY STUNNING.
           - Use **EMOJIS** in every section header and list item. 🔮 ⚔️ 🛡️
           - Use **BANNERS**: Wrap key concepts in styled divs.
           - Use **COLORS**: specific tailwind text colors for types (e.g., text-green-400 for lands/ramp, text-red-400 for aggression).

        FORMAT INSTRUCTIONS:
        - 'theme': A 3-5 word evocative title (e.g., "Eldritch Spellslinger Chaos").
        - 'strategy': Tactical advice in **RICH HTML**. Do *not* use Markdown.
           
           Required HTML Elements & Styling:
           - **Headers**: <h4 class="text-xl font-black text-white mt-6 mb-3 flex items-center gap-2"><span class="text-2xl">⚡</span> SECTION TITLE</h4>
           - **Banners**: <div class="bg-primary-500/10 border-l-4 border-primary-500 p-4 rounded-r-lg my-4 text-gray-200">Content...</div>
           - **Keywords**: <span class="font-bold text-primary-400">Keyword</span>
           - **Lists**: <ul class="space-y-2 mb-4"><li class="flex items-start gap-2"><span class="mt-1">🔹</span><span>Point...</span></li></ul>
           
           Required Sections:
           1. **The Grand Vision** (Intro)
           2. **The Game Plan** (Early/Mid/Late game - use a timeline or steps)
           3. **Winning the Game** (Win Conditions)
           4. **Secret Tech & Synergies** (Highlight specific interactions)
           
        - 'layout': Target counts for the remaining deck slots (Total 100 - Commanders).
           - 'functional': { "Lands": N, "Mana Ramp": N, "Card Draw": N, "Removal": N, "Board Wipes": N, "Synergy/Core": N }
           - 'types': { "Creatures": N, "Instants": N, "Sorceries": N, "Artifacts": N, "Enchantments": N, "Planeswalkers": N, "Lands": N }
        `;

    const payload = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [
        {
          role: "user",
          parts: [{ text: `Generate unique strategy for this commander.` }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            suggestedName: { type: "STRING" },
            theme: { type: "STRING" },
            strategy: { type: "STRING" },
            layout: {
              type: "OBJECT",
              properties: {
                functional: {
                  type: "OBJECT",
                  properties: {
                    Lands: { type: "NUMBER" },
                    "Mana Ramp": { type: "NUMBER" },
                    "Card Draw": { type: "NUMBER" },
                    Removal: { type: "NUMBER" },
                    "Board Wipes": { type: "NUMBER" },
                    Synergy: { type: "NUMBER" },
                  },
                  required: [
                    "Lands",
                    "Mana Ramp",
                    "Card Draw",
                    "Removal",
                    "Board Wipes",
                    "Synergy",
                  ],
                },
                types: {
                  type: "OBJECT",
                  properties: {
                    Creatures: { type: "NUMBER" },
                    Instants: { type: "NUMBER" },
                    Sorceries: { type: "NUMBER" },
                    Artifacts: { type: "NUMBER" },
                    Enchantments: { type: "NUMBER" },
                    Planeswalkers: { type: "NUMBER" },
                    Lands: { type: "NUMBER" },
                  },
                  required: [
                    "Creatures",
                    "Instants",
                    "Sorceries",
                    "Artifacts",
                    "Enchantments",
                    "Planeswalkers",
                    "Lands",
                  ],
                },
              },
              required: ["functional", "types"],
            },
          },
          required: ["suggestedName", "theme", "strategy", "layout"],
        },
      },
    };
    const result = await this.executeWithFallback(payload, userProfile, {
      apiKey,
    });
    return parseResponse(result.text);
  },

  async refineDeckBuild(
    apiKey,
    deckContext,
    draftPool,
    strategy,
    instructions,
    userProfile = null,
  ) {
    const systemPrompt = `You are a Tier-1 Competitive Deck Consultant.
        
        MISSION:
        Review a "DRAFT POOL" of cards being considered for a deck.
        The goal is to finalize a cohesive 100-card Commander deck.
        
        YOU MUST:
        1. Identify "OUTLIERS": Cards in the draft pool that are weak, non-synergistic, or redundant.
        2. Suggest "REPLACEMENTS": Better cards that fit the strategy/curve.
        3. Ensuring the FINAL count reaches exactly 100 is NOT your job here; your job is QUALITY control.
        
        CONTEXT:
        - COMMANDER & CORE: ${deckContext.length} cards (immutable).
        - DRAFT POOL: ${draftPool.length} cards (candidates).
        - STRATEGY: ${strategy?.theme || "General Synergy"}
        `;

    const userQuery = `
            [EXISTING DECK CORE]
            ${deckContext.slice(0, 100).join(", ")}... (and more)

            [DRAFT CANDIDATES TO REVIEW]
            ${draftPool.join("\n")}

            [INSTRUCTIONS]
            Identify up to 5 weak links in the Draft Candidates and provide better alternatives.
            If the draft look solid, return an empty change list.
        `;

    const payload = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userQuery }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            analysis: { type: "STRING" },
            swaps: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  remove: {
                    type: "STRING",
                    description: "Exact name of card to remove from DRAFT POOL",
                  },
                  add: {
                    type: "STRING",
                    description: "Exact name of better card to add",
                  },
                  reason: { type: "STRING" },
                  set: { type: "STRING" },
                  collectorNumber: { type: "STRING" },
                },
                required: ["remove", "add", "reason", "set", "collectorNumber"],
              },
            },
          },
          required: ["analysis", "swaps"],
        },
      },
    };
    const result = await this.executeWithFallback(payload, userProfile, {
      apiKey,
    });
    return parseResponse(result.text);
  },

  async gradeDeck(apiKey, payload, userProfile = null) {
    const {
      deckName,
      commander,
      cards,
      playerProfile,
      strategyGuide,
      helperPersona,
      restrictedSets,
    } = payload;
    const helperName = helperPersona?.name || "The Oracle";

    const setRestriction =
      restrictedSets && restrictedSets.length > 0
        ? `RESTRICTION: You MUST ONLY suggest 'recommendedSwaps' using cards from these set codes: ${restrictedSets.join(", ")}. Do NOT suggest cards from any other sets.`
        : "";

    const systemInstruction = `You are ${helperName}, a Tier-1 MTG competitive analyst.
        
        MISSION:
        Evaluate the power level of the provided decklist based on the "Commander Bracket" system.
        ${setRestriction}
        
        CRITIQUE FORMATTING:
        Provide the 'critique' and 'bracketJustification' fields as **Polished Modern HTML**. 
        - Use <strong class="text-white"> for emphasis.
        - Use emojis 🧪 🧬 ⚡ liberally to enhance the "Deck Doctor" persona.
        - Do NOT use markdown.
        
        BRACKET DEFINITIONS:
        - Bracket 1 (Exhibition): Precons, low-powered themes, extreme budget, or jank.
        - Bracket 2 (Core): Standard casual decks with basic synergies and upgrades.
        - Bracket 3 (Upgraded): High-synergy decks with efficient win conditions and strong mana bases.
        - Bracket 4 (Optimized): High-power casual, infinite combos, tutors, and fast mana (short of cEDH).
        - Bracket 5 (cEDH): Tier-0 competitive decks designed for Turn 1-3 wins or hard stax.
        
        METRICS (1-10):
        - Efficiency: Average CMC vs Mana acceleration quality.
        - Interaction: Density and quality of removal, counters, and protection.
        - winTurn: The average turn the deck projects to present a lethal threat.`;

    const userQuery = `
            DECK: "${deckName}"
            COMMANDER: ${commander}
            STRATEGY: ${strategyGuide}
            USER PROFILE: ${playerProfile}
            [RESTRICTED SETS] ${restrictedSets && restrictedSets.length > 0 ? restrictedSets.join(", ") : "None"}
            DECKLIST:
            DECKLIST:
            ${(cards || []).map((c) => `- ${c.name}`).join("\n")}
        `;

    const body = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: userQuery }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            powerLevel: {
              type: "NUMBER",
              description: "Float between 1.0 and 10.0",
            },
            commanderBracket: {
              type: "INTEGER",
              description: "1 to 5 based on rubric",
            },
            metrics: {
              type: "OBJECT",
              properties: {
                efficiency: { type: "NUMBER" },
                interaction: { type: "NUMBER" },
                winTurn: { type: "NUMBER" },
              },
            },
            bracketJustification: { type: "STRING" },
            critique: {
              type: "STRING",
              description: "Emotional/Strategic feedback",
            },
            mechanicalImprovements: {
              type: "ARRAY",
              items: { type: "STRING" },
            },
            recommendedSwaps: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  remove: { type: "STRING" },
                  add: { type: "STRING" },
                  reason: { type: "STRING" },
                  set: { type: "STRING", description: "Scryfall set code preference" },
                  collectorNumber: { type: "STRING", description: "Scryfall collector number" }
                },
                required: ["remove", "add", "reason"],
              },
            },
          },
          required: [
            "powerLevel",
            "commanderBracket",
            "metrics",
            "bracketJustification",
            "critique",
            "mechanicalImprovements",
            "recommendedSwaps",
          ],
        },
      },
    };

    const result = await this.executeWithFallback(body, userProfile, {
      apiKey,
      models: PRO_MODELS,
    });
    return parseResponse(result.text);
  },

  async generatePlaystyleQuestion(apiKey, priorAnswers, userProfile = null) {
    const systemPrompt = `You are the Oracle of the Multiverse. You are conducting a psychographic assessment of a Magic: The Gathering player.
        
        Your questions should be evocative, thematic, and cover:
        - Aggression (Face vs Board)
        - Interaction (Control vs Proactive)
        - Complexity (Linear vs Rube Goldberg)
        - Archetypes (Aggro, Control, Combo, Midrange, Stax)`;

    const userQuery = `Current Assessment State: ${JSON.stringify(priorAnswers)}. Generate the next clinical question.`;

    const payload = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userQuery }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            question: { type: "STRING" },
            choices: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["question", "choices"],
        },
      },
    };
    const result = await this.executeWithFallback(payload, userProfile, {
      apiKey,
      models: FLASH_MODELS,
    });
    return parseResponse(result.text);
  },

  async synthesizePlaystyle(apiKey, answers, userProfile = null) {
    const systemPrompt = `Analyze the following MTG session answers and synthesize a permanent psychographic profile for the player.
        
        FORMATTING:
        - 'summary': A 3-4 sentence evocative summary in **Polished HTML**. Use <strong class="text-white"> for emphasis and emojis 🎭. Make it feel like a mythical prophecy.

        CATEGORIES:
        - Aggression: Desire for combat and early pressure.
        - Interaction: Desire to stop opponents or control the stack.
        - Complexity: Preference for intricate loops vs simple power.
        - Social: Preference for group hug/politics vs kingmaking.`;

    const payload = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [
        {
          role: "user",
          parts: [{ text: `PLAYER ANSWERS: ${JSON.stringify(answers)}` }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            summary: {
              type: "STRING",
              description: "3-4 sentence evocative summary",
            },
            tags: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Short traits like 'Combo Fiend', 'Stax Master'",
            },
            scores: {
              type: "OBJECT",
              properties: {
                aggression: { type: "NUMBER" },
                interaction: { type: "NUMBER" },
                complexity: { type: "NUMBER" },
                political: { type: "NUMBER" },
              },
              required: [
                "aggression",
                "interaction",
                "complexity",
                "political",
              ],
            },
            archetypes: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["summary", "tags", "scores", "archetypes"],
        },
      },
    };
    const result = await this.executeWithFallback(payload, userProfile, {
      apiKey,
      models: FLASH_MODELS,
    });
    return parseResponse(result.text);
  },

  async refinePlaystyleChat(
    apiKey,
    history,
    currentProfile,
    helper = null,
    userProfile = null,
  ) {
    const helperName = helper?.name || "The Oracle";
    const systemPrompt = `You are ${helperName}. Carry out a conversation with the user to refine their MTG Playstyle Profile. 
        Current State: ${JSON.stringify(currentProfile)}.
        
        In every response:
        1. Keep the AI personality intact.
        2. Silently update the 'updatedProfile' object based on their responses.
        3. Be insightful and slightly assertive about your observations.`;

    const payload = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents:
        history.length > 0
          ? [
            ...history.map((h) => ({
              role: h.role === "user" ? "user" : "model",
              parts: [{ text: h.content }],
            })),
          ]
          : [{ role: "user", parts: [{ text: "Begin the session." }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            aiResponse: {
              type: "STRING",
              description: "Evocative conversation",
            },
            updatedProfile: {
              type: "OBJECT",
              properties: {
                summary: { type: "STRING" },
                tags: { type: "ARRAY", items: { type: "STRING" } },
                scores: {
                  type: "OBJECT",
                  properties: {
                    aggression: { type: "NUMBER" },
                    interaction: { type: "NUMBER" },
                    complexity: { type: "NUMBER" },
                    political: { type: "NUMBER" },
                  },
                  required: [
                    "aggression",
                    "interaction",
                    "complexity",
                    "political",
                  ],
                },
                archetypes: { type: "ARRAY", items: { type: "STRING" } },
              },
              required: ["summary", "tags", "scores", "archetypes"],
            },
          },
          required: ["aiResponse", "updatedProfile"],
        },
      },
    };
    const result = await this.executeWithFallback(payload, userProfile, {
      apiKey,
      models: FLASH_MODELS,
    });
    return parseResponse(result.text);
  },

  async forgeHelperChat(apiKey, history, currentDraft, userProfile = null) {
    const cleanDraft = sanitizeHelper(currentDraft);
    const systemPrompt = `You are the MTG Spark-Forge. You are interviewing the user to create their permanent AI Deck-Building companion.
        
        CURRENT DRAFT: ${JSON.stringify(cleanDraft)}
        
        You need to determine:
        - Name
        - Type (e.g. Eldrazi Construct, Faerie Spirit, Thran AI)
        - Personality (e.g. Grumpy, Whimsical, Calculating)
        
        Keep the conversation immersive. Update 'updatedDraft' with every response.`;

    const payload = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents:
        history.length > 0
          ? [
            ...history.map((h) => ({
              role: h.role === "user" ? "user" : "model",
              parts: [{ text: h.content }],
            })),
          ]
          : [{ role: "user", parts: [{ text: "Initialize Forge." }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            aiResponse: { type: "STRING" },
            updatedDraft: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                type: { type: "STRING" },
                personality: { type: "STRING" },
                visualDescription: { type: "STRING" },
              },
            },
          },
          required: ["aiResponse", "updatedDraft"],
        },
      },
    };
    const result = await this.executeWithFallback(payload, userProfile, {
      apiKey,
      models: FLASH_MODELS,
    });
    return parseResponse(result.text);
  },

  async generateReleaseNotes(apiKey, payloadData, userProfile = null) {
    const { tickets = [], manualAdditions = '' } = payloadData;

    const systemPrompt = `You are the Lead Developer of MTG Forge. Generate professional, evocative release notes for the latest update.
        You MUST output ONLY raw HTML (no markdown backticks, no <html>, <head>, or <body> tags). 
        You MUST adhere to this exact layout, styling, structure, and CSS classes (use the provided tickets and manual additions to fill in the data and sections):
        
        <div class="hero-glow"></div>
        <main class="max-w-4xl mx-auto px-6 py-16">
            <header class="mb-16 text-center md:text-left">
                <h1 class="heading-font text-5xl md:text-7xl font-bold mb-4 tracking-tight">
                    MTG Forge: <span class="gold-gradient-text">Version [VERSION_NUMBER]</span>
                </h1>
                <h2 class="text-2xl md:text-3xl font-light text-slate-400 italic">[CATCHY_SUBTITLE]</h2>
                <div class="mt-8 p-6 bg-slate-800/40 rounded-2xl border border-slate-700/50 text-slate-300 leading-relaxed italic">
                    [EVOCATIVE_INTRO_PARAGRAPH_SUMMARIZING_THE_RELEASE]
                </div>
            </header>
            
            <!-- Use this section style for major new features from tickets -->
            <section class="mb-16">
                <div class="flex items-center gap-4 mb-6">
                    <div class="h-px flex-1 bg-gradient-to-r from-transparent to-amber-500/50"></div>
                    <h3 class="heading-font text-3xl font-bold text-amber-400 uppercase tracking-widest">[FEATURE_SECTION_TITLE]</h3>
                    <div class="h-px flex-1 bg-gradient-to-l from-transparent to-amber-500/50"></div>
                </div>
                <div class="grid md:grid-cols-2 gap-8">
                    <div class="section-card p-8 rounded-r-2xl">
                        <h4 class="text-xl font-bold text-white mb-3">[FEATURE_1_TITLE]</h4>
                        <p class="text-slate-400 text-sm leading-relaxed">[FEATURE_1_DESC]</p>
                    </div>
                    <!-- Add more section-cards as needed -->
                </div>
            </section>

            <!-- Use this section style for other major features or epic updates -->
            <section class="mb-16">
                <h3 class="heading-font text-3xl font-bold text-amber-400 mb-8 border-b border-slate-700 pb-4">[ANOTHER_SECTION_TITLE]</h3>
                <p class="text-slate-300 mb-8 leading-relaxed">[SECTION_INTRO_TEXT]</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="format-tag p-4 rounded-xl flex items-start gap-4 hover:border-amber-400/60 transition-colors">
                        <div class="bg-amber-500/10 p-2 rounded-lg">
                            <svg class="w-6 h-6 text-amber-500"...><!-- Pick a relevant heroicon SVG -->
                        </div>
                        <div>
                            <h5 class="font-bold text-white">[ITEM_TITLE]</h5>
                            <p class="text-xs text-slate-500">[ITEM_DESC]</p>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Use this section style for Bug Fixes -->
            <section class="mb-16">
                <h3 class="heading-font text-3xl font-bold text-amber-400 mb-8 border-b border-slate-700 pb-4">Banishing the Shadows</h3>
                <ul class="space-y-4">
                    <li class="flex items-start gap-3">
                        <span class="text-emerald-500 mt-1">✦</span>
                        <span class="text-slate-300"><strong class="text-white">[BUG_TITLE]:</strong> [BUG_DESC_AND_FIX]</span>
                    </li>
                </ul>
            </section>
        </main>

        Incorporate 'Manual Additions' into the content creatively. Be professional but embrace the Magic: The Gathering flavor in your writing.`;

    const userText = `
        Tickets: ${JSON.stringify(tickets)}
        Manual Additions / Offline Work: ${manualAdditions || 'None'}
    `;

    const payload = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [
        {
          role: "user",
          parts: [{ text: userText }],
        },
      ],
    };
    const result = await this.executeWithFallback(payload, userProfile, {
      apiKey,
      models: FLASH_MODELS,
    });
    return result.text
      .replace(/```html/g, "")
      .replace(/```/g, "")
      .trim();
  },

  async generatePersonaSamples(apiKey, personaContext, userProfile = null) {
    if (!personaContext || !personaContext.personality) {
      throw new Error("Missing persona personality context.");
    }

    const systemInstruction = `You are tasked with generating 3 example interactions for an AI Persona in a Magic: The Gathering deckbuilder application.
The persona's details:
- Name: ${personaContext.name}
- Archetype/Type: ${personaContext.type}
- Personality Prompt: ${personaContext.personality}

Your goal is to provide 3 distinct questions a user might ask, and 3 corresponding responses written EXACTLY in the voice, tone, and style described by the personality prompt.
Ensure the responses strongly reflect the character. The user questions should be typical MTG deckbuilding/rules questions (e.g. "Should I add more lands?", "Is this card good in my deck?").
Return ONLY a valid JSON array of objects with the keys "userContent" and "aiContent". Do not include markdown blocks. Example:
[
  { "userContent": "Should I add more lands?", "aiContent": "..." },
  { "userContent": "What do you think of my commander?", "aiContent": "..." },
  { "userContent": "Suggest a combo.", "aiContent": "..." }
]`;

    const payload = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: "Generate the 3 sample interactions now." }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    };

    try {
      const result = await this.executeWithFallback(payload, userProfile, {
        apiKey,
        models: FLASH_MODELS,
      });

      const data = JSON.parse(result.text.trim());
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
      return [];
    } catch (err) {
      console.error("[GeminiService] Failed to generate sample responses:", err);
      throw new Error("Could not generate persona sample responses.");
    }
  },

  /**
   * Generates a high-quality MTG-style avatar based on user profile.
   */
  async generateImagen(
    username,
    playstyle,
    archetype,
    referenceImageBase64 = null,
    userProfile = null,
    customPrompt = "",
    quality = "quality"
  ) {
    const baseStyle = `A high-quality MTG-style avatar for a player named ${username}. They have a ${playstyle || "balanced"} playstyle and their deck archetype is ${archetype || "Forge Traveler"}.`;
    let prompt = baseStyle;

    if (customPrompt && customPrompt.trim() !== "") {
      prompt = `${baseStyle} Special user instructions to follow: "${customPrompt}".`;
    }

    prompt += ` Use the provided logo as a style reference for colors and branding. Design it to be a premium profile picture for a Magic: The Gathering platform.`;

    // Nano Banana Pro lineage uses Imagen 4.0 and latest Flash/Preview models
    const isQuality = quality === "quality";
    const models = isQuality
      ? ["imagen-4.0-generate-001", "nano-banana-pro-preview", "gemini-3-pro-image-preview"]
      : ["imagen-4.0-fast-generate-001", "gemini-2.5-flash-image", "gemini-2.0-flash-exp-image-generation"];

    // Standard Gemini generateImages payload structure
    for (const model of models) {
      try {
        const isPredictModel = model.includes("imagen") || model.includes("veo");
        const method = isPredictModel ? "predict" : "generateContent";

        let finalPayload;
        if (method === "generateContent") {
          finalPayload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { sampleCount: 1 }
          };
        } else {
          finalPayload = {
            instances: [{ prompt }],
            parameters: { sampleCount: 1 }
          };
        }

        const runResponse = await this.executeWithFallback(finalPayload, userProfile, {
          models: [model],
          method: method,
        });

        // 1. Handle 'predict' style response (Imagen 4.0)
        if (runResponse?.predictions?.[0]?.bytesBase64Encoded) {
          return `data:image/png;base64,${runResponse.predictions[0].bytesBase64Encoded}`;
        }

        // 2. Handle 'generateContent' style response (Nano Banana / Flash Image)
        const imagePart = runResponse?.candidates?.[0]?.content?.parts?.find(p => p.inlineData || p.inline_data);
        const imageBase64 = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
        if (imageBase64) {
          return `data:image/png;base64,${imageBase64}`;
        }

        // 3. Handle 'generateImages' style legacy response
        if (runResponse?.generatedImages?.[0]?.image?.imageBytes) {
          return `data:image/png;base64,${runResponse.generatedImages[0].image.imageBytes}`;
        }

      } catch (err) {
        console.warn(`[GeminiService] Method attempt failed for ${model}:`, err.message);
        continue; // Try next model in the list
      }
    }

    throw new Error(
      "Failed to generate image: All models and methods exhausted.",
    );
  },

  /**
   * Estimates credit cost for image generation based on assumptions.
   */
  getImagenCost(quality = "quality", assumptions = {}) {
    const marketCost = quality === "quality"
      ? (assumptions.imageCostMarket || 0.03)
      : (assumptions.fastImageCostMarket || 0.01);

    const markup = assumptions.imageMarkup || 1.15;
    const exchangeRate = assumptions.exchangeRate || 6;

    return Math.ceil(marketCost * markup * exchangeRate * 1000000);
  },
};

// Consolidated object with tiers
const GeminiServiceFinal = {
  ...GeminiService,
  PRO_MODELS,
  FLASH_MODELS,
};

export {
  GeminiServiceFinal as GeminiService,
  PRICING,
  getModelTier,
  PRO_MODELS,
  FLASH_MODELS,
};
export default GeminiServiceFinal;
