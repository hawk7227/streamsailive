
const fs = require('fs');
const path = require('path');

// Manually verify env if dotenv fails
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath) && !process.env.JSON2VIDEO_API_KEY) {
    const envConfig = fs.readFileSync(envLocalPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value && !process.env[key.trim()]) {
            process.env[key.trim()] = value.trim();
        }
    });
}

async function test() {
    console.log("Testing JSON2Video SDK (JS)...");
    const apiKey = process.env.JSON2VIDEO_API_KEY;
    if (!apiKey) {
        console.error("Error: JSON2VIDEO_API_KEY not found.");
        process.exit(1);
    }
    console.log("API Key found:", apiKey.substring(0, 5) + "...");

    try {
        const SDK = require('json2video-sdk');
        console.log("SDK loaded:", Object.keys(SDK));

        const Movie = SDK.Movie;

        const movie = new Movie();
        movie.setAPIKey(apiKey);
        movie.set("resolution", "1080");
        movie.set("quality", "low");

        movie.addElement({
            type: "text",
            text: "Verification Test",
            duration: 5
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
            console.log("SUCCESS: Video URL ->", result.movie.url);
        } else {
            console.error("FAILED: No video URL.");
        }

    } catch (error) {
        console.error("Test failed:", error);
    }
}

test();
