
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

// Load .env.local manually if dotenv doesn't pick it up automatically or checks .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    const envConfig = fs.readFileSync(envLocalPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value && !process.env[key.trim()]) {
            process.env[key.trim()] = value.trim();
        }
    });
}

async function test() {
    console.log("Testing JSON2Video SDK...");
    const apiKey = process.env.JSON2VIDEO_API_KEY;
    if (!apiKey) {
        console.error("Error: JSON2VIDEO_API_KEY not found in environment.");
        process.exit(1);
    }
    console.log("API Key found:", apiKey.substring(0, 5) + "...");

    try {
        // @ts-ignore
        const SDK = require('json2video-sdk');
        const Movie = SDK.Movie;

        const movie = new Movie();
        movie.setAPIKey(apiKey);
        movie.set("resolution", "1080");
        movie.set("quality", "low"); // Low for faster render

        // Add a simple element
        movie.addElement({
            type: "text",
            text: "Hello from Verification Script",
            duration: 5,
            style: "fade-in-out"
        });

        console.log("Starting render...");
        const response = await movie.render();

        if (!response.success) {
            console.error("Render failed:", response);
            return;
        }

        console.log("Render started. Project ID:", response.project);
        console.log("Waiting for completion...");

        const result = await movie.waitToFinish();

        console.log("Render finished!");
        console.log("Result:", JSON.stringify(result, null, 2));

        if (result.movie && result.movie.url) {
            console.log("\nSUCCESS: Video URL ->", result.movie.url);
        } else {
            console.error("\nFAILED: No video URL in result.");
        }

    } catch (error) {
        console.error("Test failed with error:", error);
    }
}

test();
