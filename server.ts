/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Load Firebase config from file safely
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));

// Lazy-loaded Gemini AI client to avoid crashes if the key is missing at start
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for body parsing
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Endpoint for Voice Command processing
  app.post("/api/voice-command", async (req, res) => {
    try {
      const { audio, mimeType } = req.body;

      if (!audio) {
        return res.status(400).json({ error: "No audio data provided in request body." });
      }

      // Check if API key is set
      if (!process.env.GEMINI_API_KEY) {
        console.warn("[Gemini API] API key is missing. Falling back to local keyword simulation.");
        // Simulated response if API key is missing
        return res.json({
          transcript: "Simulated voice command (API Key Missing)",
          reply: "I received your audio, but the Gemini API Key is not configured in Settings. Please add GEMINI_API_KEY in Settings > Secrets to enable live Gemini speech parsing!",
          fallback: true
        });
      }

      const ai = getGeminiClient();

      const audioPart = {
        inlineData: {
          mimeType: mimeType || "audio/webm",
          data: audio,
        },
      };

      const prompt = `You are the vocal interface of KITTEN, a highly advanced, futuristic smart home assistant.
Analyze the user's spoken voice command from this audio stream and determine the correct actions.
You must return a structured JSON response corresponding exactly to the schema.

Guidelines:
- Transcribe the user's spoken words accurately into "transcript".
- Formulate a witty, polite, futuristic response in "reply" (refer to yourself as KITTEN, and match the high-tech, glassmorphic mood).
- If they explicitly ask to activate, switch to, or load an automation mode/profile, set "mode" to one of: 'manual', 'auto', 'study', 'sleep', 'movie', 'gaming'.
- If they ask to turn lights on, off, or dim/brighten them manually (without mentioning a profile), set "led" to a value between 0 (completely off) and 255 (maximum glow).
- If they ask to speed up, slow down, or stop the cooling/ventilation fan manually, set "fan" to a value between 0 (off) and 255 (maximum speed).
- If they ask to switch to auto, automatic, or manual mode generally, set "auto" to true or false.
- If they ask to play music, play a song, stop music, or turn on the speakers:
  - Return "playMusic" with "songName" (e.g., "Synthwave Sunset", "Cozy Lofi", "Cyberpunk Overdrive") and "play" as true.
  - If they ask to stop music, return "playMusic" with "stop" as true.

Make sure your reply reflects the actions you are taking.`;

      // Multi-model fallback chain to handle high demand or temporary 503/UNAVAILABLE errors
      const candidateModels = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
      let response = null;
      let lastError: any = null;

      for (const modelName of candidateModels) {
        let success = false;
        const attempts = 2; // Up to 2 attempts per model with a short backoff

        for (let attempt = 1; attempt <= attempts; attempt++) {
          try {
            console.log(`[Gemini API] Attempt ${attempt}/${attempts} parsing voice command with model: ${modelName}`);
            response = await ai.models.generateContent({
              model: modelName,
              contents: [audioPart, prompt],
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    transcript: {
                      type: Type.STRING,
                      description: "Accurate text transcription of what was spoken in the audio."
                    },
                    reply: {
                      type: Type.STRING,
                      description: "The AI assistant's verbal response to the command."
                    },
                    mode: {
                      type: Type.STRING,
                      description: "The automation profile mode name: 'manual', 'auto', 'study', 'sleep', 'movie', or 'gaming'."
                    },
                    led: {
                      type: Type.INTEGER,
                      description: "LED brightness level (0-255)."
                    },
                    fan: {
                      type: Type.INTEGER,
                      description: "Fan level (0-255)."
                    },
                    auto: {
                      type: Type.BOOLEAN,
                      description: "Set automatic mode state."
                    },
                    playMusic: {
                      type: Type.OBJECT,
                      description: "Controls to start or stop music on the smart home speaker system.",
                      properties: {
                        songName: {
                          type: Type.STRING,
                          description: "Proposed song or genre name."
                        },
                        play: {
                          type: Type.BOOLEAN,
                          description: "Set to true to play/resume music."
                        },
                        stop: {
                          type: Type.BOOLEAN,
                          description: "Set to true to stop music playback."
                        }
                      },
                      required: []
                    }
                  },
                  required: ["transcript", "reply"]
                }
              }
            });

            if (response) {
              console.log(`[Gemini API] Successfully parsed voice command using ${modelName} on attempt ${attempt}`);
              success = true;
              break;
            }
          } catch (err: any) {
            lastError = err;
            console.warn(`[Gemini API] Model ${modelName} attempt ${attempt} failed:`, err.message || err);
            
            // Wait 250ms before retrying the same model or falling back
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
        }

        if (success && response) {
          break;
        }
      }

      if (!response) {
        throw lastError || new Error("All candidate Gemini models failed to respond.");
      }

      const responseText = response.text || "{}";
      const parsedData = JSON.parse(responseText.trim());

      res.json(parsedData);
    } catch (error: any) {
      console.error("[Voice Command Error]:", error);
      res.status(500).json({
        error: "Failed to process voice command.",
        details: error.message || error
      });
    }
  });

  // Helper: Prepend standard 44-byte WAV header to raw PCM samples
  function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 16000, numChannels: number = 1, bitsPerSample: number = 16): Buffer {
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmBuffer.length;
    const wavHeader = Buffer.alloc(44);

    wavHeader.write("RIFF", 0);
    wavHeader.writeUInt32LE(36 + dataSize, 4);
    wavHeader.write("WAVE", 8);
    wavHeader.write("fmt ", 12);
    wavHeader.writeUInt32LE(16, 16);
    wavHeader.writeUInt16LE(1, 20);
    wavHeader.writeUInt16LE(numChannels, 22);
    wavHeader.writeUInt32LE(sampleRate, 24);
    wavHeader.writeUInt32LE(byteRate, 28);
    wavHeader.writeUInt16LE(blockAlign, 32);
    wavHeader.writeUInt16LE(bitsPerSample, 34);
    wavHeader.write("data", 36);
    wavHeader.writeUInt32LE(dataSize, 40);

    return Buffer.concat([wavHeader, pcmBuffer]);
  }

  // Helper: Push updates to Firestore control/esp32 document via direct REST API
  async function updateFirestoreControlState(updates: any) {
    const projectId = firebaseConfig.projectId;
    const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/control/esp32`;

    const fields: any = {};
    const queryParams: string[] = [];

    if (updates.led !== undefined) {
      fields.led = { integerValue: updates.led };
      queryParams.push("updateMask.fieldPaths=led");
    }
    if (updates.fan !== undefined) {
      fields.fan = { integerValue: updates.fan };
      queryParams.push("updateMask.fieldPaths=fan");
    }
    if (updates.auto !== undefined) {
      fields.auto = { booleanValue: updates.auto };
      queryParams.push("updateMask.fieldPaths=auto");
    }

    // Always assert voice state is true on voice command trigger
    fields.voice = { booleanValue: true };
    queryParams.push("updateMask.fieldPaths=voice");

    fields.lastUpdated = { timestampValue: new Date().toISOString() };
    queryParams.push("updateMask.fieldPaths=lastUpdated");

    const finalUrl = `${url}?${queryParams.join("&")}`;

    try {
      const response = await fetch(finalUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields })
      });
      if (!response.ok) {
        const text = await response.text();
        console.error("[Firestore Sync] REST Patch failed:", text);
      } else {
        console.log("[Firestore Sync] Successfully synched controls directly to database:", updates);
      }
    } catch (err) {
      console.error("[Firestore Sync] Connection error:", err);
    }
  }

  // Helper: Call Google's direct Speech-to-Text REST API to transcribe PCM data
  async function transcribeWithGoogleSTT(rawPCM: Buffer): Promise<string> {
    const base64Audio = rawPCM.toString("base64");
    const key = process.env.GEMINI_API_KEY;

    if (key) {
      try {
        console.log("[Google STT] Attempting direct Google Speech-to-Text REST API transcription...");
        const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${key}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            config: {
              encoding: "LINEAR16",
              sampleRateHertz: 16000,
              languageCode: "en-US",
            },
            audio: {
              content: base64Audio,
            },
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          const transcript = data.results?.[0]?.alternatives?.[0]?.transcript || "";
          if (transcript) {
            console.log(`[Google STT] Direct STT Server transcription success: "${transcript}"`);
            return transcript;
          }
        } else {
          const errorText = await response.text();
          console.warn(`[Google STT] Direct STT REST endpoint returned status ${response.status}: ${errorText}`);
        }
      } catch (err: any) {
        console.warn("[Google STT] Direct Google STT API connection failed:", err.message || err);
      }
    }

    // Fallback: Use Gemini as a pure Speech-to-Text transcription engine (A/B testing/restricted API key backup)
    console.log("[Google STT] Falling back to pure transcription pipeline...");
    const ai = getGeminiClient();
    const wavBuffer = pcmToWav(rawPCM, 16000, 1, 16);
    const base64Wav = wavBuffer.toString("base64");
    const audioPart = {
      inlineData: {
        mimeType: "audio/wav",
        data: base64Wav,
      },
    };

    const prompt = `You are a high-fidelity automatic speech recognition (ASR) engine.
Listen to this audio clip and accurately transcribe the user's spoken words into written text.
Do not interpret the commands or execute any actions. Simply transcribe the words verbatim.
Return a JSON object containing the "transcript" of the words.`;

    const candidateModels = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
    let lastError: any = null;

    for (const modelName of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [audioPart, prompt],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  transcript: { type: Type.STRING },
                },
                required: ["transcript"],
              },
            },
          });

          if (response) {
            const responseText = response.text || "{}";
            const parsedData = JSON.parse(responseText.trim());
            return parsedData.transcript || "";
          }
        } catch (err: any) {
          lastError = err;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    }

    throw lastError || new Error("All transcription services failed to respond.");
  }

  // API Endpoint for raw audio data uploaded from ESP32 physical microphone
  app.post("/api/voice-command-raw", express.raw({ type: "application/octet-stream", limit: "50mb" }), async (req, res) => {
    try {
      const rawBody = req.body;
      if (!rawBody || rawBody.length === 0) {
        return res.status(400).json({ error: "No raw PCM audio bytes received." });
      }

      console.log(`[Raw Voice Endpoint] Received ${rawBody.length} bytes of raw audio from ESP32`);

      if (!process.env.GEMINI_API_KEY) {
        console.warn("[Google STT] GEMINI_API_KEY is not configured.");
        return res.json({
          transcript: "kitten lights on (Simulation Mode)",
          reply: "I recorded your voice, but the API Key is not configured in Settings > Secrets. Register your key to enable speech-to-text!",
          led: 255,
          fan: 255,
          auto: false,
          accepted: true
        });
      }

      // Convert speech to text directly using Google's Speech-to-Text server capabilities
      const transcript = await transcribeWithGoogleSTT(rawBody);
      console.log(`[Raw Voice Endpoint] Direct Google STT result: "${transcript}"`);

      // 3. Enforce wake-word requirement:
      // "if the voice command contains 'kitten' at the start only then it accepts the command"
      const transcriptClean = transcript.trim().toLowerCase().replace(/^[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "");
      const startsWithKitten = transcriptClean.startsWith("kitten") || transcriptClean.startsWith("hey kitten") || transcriptClean.startsWith("hi kitten");

      if (!startsWithKitten) {
        console.log(`[Raw Voice Endpoint] Command rejected: Wake word 'kitten' not detected at start of transcript.`);
        return res.json({
          transcript: transcript,
          reply: "I parsed your speech, but you didn't begin your command with my wake-word 'Kitten'. Request ignored.",
          accepted: false
        });
      }

      // 4. Replicate the EXACT deterministic website parsing logic (parseTextCommand)
      const normalized = transcript.toLowerCase();
      const updates: any = {};
      let reply = "I parsed your command.";

      // 1) Match high-priority presets and system automation modes first
      if (normalized.includes("movie")) {
        updates.led = 20;
        updates.fan = 0;
        updates.auto = false;
        reply = "Activating movie night preset: Lights dimmed low, ventilation fan silenced.";
      } else if (normalized.includes("gaming") || normalized.includes("game")) {
        updates.led = 255;
        updates.fan = 255;
        updates.auto = false;
        reply = "Activating gaming preset: Full LED glow and maximum fan power.";
      } else if (normalized.includes("sleep")) {
        updates.led = 0;
        updates.fan = 0;
        updates.auto = false;
        reply = "Activating bedtime sleep preset: LED off and fan shut down.";
      } else if (normalized.includes("study") || normalized.includes("work")) {
        updates.led = 150;
        updates.fan = 80;
        updates.auto = false;
        reply = "Activating productive study preset: Focus lights at 150, gentle ventilation fan.";
      } else if (normalized.includes("auto") || normalized.includes("automatic") || normalized.includes("manual")) {
        if (normalized.includes("off") || normalized.includes("disable") || normalized.includes("manual")) {
          updates.auto = false;
          reply = "Switching to manual microclimate control mode.";
        } else {
          updates.auto = true;
          reply = "Enabling automatic microclimate system automation.";
        }
      }
      // 2) Fall back to direct hardware control statements
      else {
        const hasLightWord = normalized.includes("light") || normalized.includes("lights") || normalized.includes("led");
        const hasFanWord = normalized.includes("fan") || normalized.includes("cooler") || normalized.includes("ventilation");

        if (hasLightWord || hasFanWord) {
          const replies: string[] = [];

          if (hasLightWord) {
            // Check for specific number following light keyword, or fall back to any number
            const lightNumberMatch = normalized.match(/(?:led|light|lights)\D*(\d+)/) || normalized.match(/\d+/);
            if (lightNumberMatch) {
              const percent = parseInt(lightNumberMatch[1] || lightNumberMatch[0], 10);
              const pwmVal = Math.round((percent / 100) * 255);
              const constrainedVal = Math.min(255, Math.max(0, pwmVal));
              updates.led = constrainedVal;
              updates.auto = false;
              replies.push(`Setting the light brightness to ${percent}% (${constrainedVal}/255) [Manual Mode].`);
            } else if (normalized.includes("on")) {
              updates.led = 255;
              updates.auto = false;
              replies.push("Turning the lighting array ON [Maximum glow].");
            } else if (normalized.includes("off")) {
              updates.led = 0;
              updates.auto = false;
              replies.push("Turning the lighting array OFF.");
            } else {
              replies.push("I heard you mention the light, but couldn't detect a percentage or state.");
            }
          }

          if (hasFanWord) {
            // Check for specific number following fan keyword, or fall back to any number (if not already used by light)
            let fanNumberMatch = normalized.match(/(?:fan|cooler|ventilation)\D*(\d+)/);
            if (!fanNumberMatch) {
              const generalMatch = normalized.match(/\d+/);
              if (generalMatch) {
                const lightNumberMatch = normalized.match(/(?:led|light|lights)\D*(\d+)/);
                if (!lightNumberMatch || generalMatch[0] !== (lightNumberMatch[1] || lightNumberMatch[0])) {
                  fanNumberMatch = generalMatch;
                }
              }
            }

            if (fanNumberMatch) {
              const percent = parseInt(fanNumberMatch[1] || fanNumberMatch[0], 10);
              const pwmVal = Math.round((percent / 100) * 255);
              const constrainedVal = Math.min(255, Math.max(0, pwmVal));
              updates.fan = constrainedVal;
              updates.auto = false;
              replies.push(`Setting the ventilation fan power level to ${percent}% (${constrainedVal}/255) [Manual Mode].`);
            } else if (normalized.includes("on")) {
              updates.fan = 255;
              updates.auto = false;
              replies.push("Turning the ventilation fan ON [Manual Mode].");
            } else if (normalized.includes("off")) {
              updates.fan = 0;
              updates.auto = false;
              replies.push("Turning the ventilation fan OFF.");
            } else {
              replies.push("I heard you mention the fan, but couldn't detect a percentage or state.");
            }
          }

          reply = replies.join(" ");
        } else {
          reply = "Voice command received but not matched. Try saying 'turn fan on', 'set fan to 50%', or 'movie mode'.";
        }
      }

      if (Object.keys(updates).length > 0) {
        await updateFirestoreControlState(updates);
      }

      res.json({
        transcript: transcript,
        reply: reply,
        accepted: true,
        ...updates
      });

    } catch (error: any) {
      console.error("[Raw Voice Endpoint Error]:", error);
      res.status(500).json({
        error: "Failed to process raw voice stream.",
        details: error.message || error
      });
    }
  });

  // Serve static files / Vite HMR
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
