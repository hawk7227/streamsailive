import { updateHtmlContent, ReplacementChunk } from '../src/lib/html-editor';

const sampleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Sample Page</title>
</head>
<body>
    <header>
        <h1>Welcome to StreamsAI</h1>
    </header>
    <main>
        <div class="hero">
            <p>The future of streaming is here.</p>
            <button class="btn-primary">Get Started</button>
        </div>
    </main>
    <footer>
        <p>Copyright 2024</p>
    </footer>
</body>
</html>`;

const replacementChunks: ReplacementChunk[] = [
    {
        targetContent: '<button class="btn-primary">Get Started</button>',
        replacementContent: '<button class="btn-danger">Join Now</button>',
        startLine: 12,
        endLine: 12
    },
    {
        targetContent: '<p>The future of streaming is here.</p>',
        replacementContent: '<p>AI-powered streaming automation.</p>',
        startLine: 11,
        endLine: 11
    }
];

console.log("Original HTML:\n", sampleHtml);
console.log("\n---\n");

try {
    const newHtml = updateHtmlContent(sampleHtml, replacementChunks);

    console.log("New HTML:\n", newHtml);

    if (newHtml.includes('btn-danger') && newHtml.includes('AI-powered')) {
        console.log("\nTEST PASSED: Replacements successful.");
    } else {
        console.error("\nTEST FAILED: Replacements not found.");
        process.exit(1);
    }

} catch (e: any) {
    console.error(e);
    process.exit(1);
}
