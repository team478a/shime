import "dotenv/config";
import { OpenAIDreamProvider } from "@shime/core";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY is required");

async function main() {
  const provider = new OpenAIDreamProvider({
    apiKey,
    model: process.env.OPENAI_DREAM_MODEL ?? "gpt-5.4-mini",
    timeoutMs: 30_000,
  });

  const result = await provider.suggest({
    cardName: "希望",
    firstImpression: "穏やか",
    relatedArea: "これからの暮らし",
    underlyingWish: "互いを尊重しながら安心できる関係を育てたい",
  });

  if (result.source !== "ai" || result.candidates.length !== 3) {
    throw new Error("OPENAI_DREAM_SMOKE_INVALID_RESULT");
  }

  console.log("OPENAI_DREAM_SOURCE=ai");
  console.log(`OPENAI_DREAM_BRIDGE_LENGTH=${result.bridge.length}`);
  console.log(`OPENAI_DREAM_CANDIDATE_COUNT=${result.candidates.length}`);
  console.log(`OPENAI_DREAM_MAX_CANDIDATE_LENGTH=${Math.max(...result.candidates.map((value) => value.length))}`);
}

void main();
