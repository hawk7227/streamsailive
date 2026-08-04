export const BRAINSTORM_PREVIEW_ID = "bc0609ba-27f7-4a58-823b-f36754ec8ea5";

export const BRAINSTORM_PREVIEW_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sample Landing Page</title>
    <style>
        body, h1, h2, p, a, button { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        body { line-height: 1.6; }
        header, main, footer { padding: 20px; max-width: 1200px; margin: auto; }
        header { background-color: #4CAF50; color: white; text-align: center; }
        nav a { color: white; margin: 0 10px; text-decoration: none; }
        nav a:focus { outline: 2px solid yellow; }
        .hero { background-color: #f4f4f4; padding: 40px; text-align: center; }
        .hero h1 { margin-bottom: 10px; }
        .content { display: flex; flex-wrap: wrap; justify-content: space-around; padding: 20px 0; }
        .card { background-color: #fff; box-shadow: 0 0 10px rgba(0,0,0,0.1); margin: 10px; padding: 20px; width: calc(33% - 40px); transition: transform 0.3s; }
        .card:hover { transform: translateY(-10px); }
        .card h2 { margin-bottom: 10px; }
        .card p { color: #333; }
        .card button { background-color: #4CAF50; color: white; border: none; padding: 10px 15px; margin-top: 10px; cursor: pointer; }
        .card button:focus { outline: 2px solid yellow; }
        footer { background-color: #333; color: white; text-align: center; padding: 10px 0; }
        @media(max-width: 768px) { .card { width: calc(48% - 40px); } }
        @media(max-width: 480px) { .card { width: 100%; } }
    </style>
</head>
<body>
    <header>
        <h1>Welcome to Our Landing Page</h1>
        <nav aria-label="Main Navigation">
            <a href="#home">Home</a>
            <a href="#services">Services</a>
            <a href="#contact">Contact</a>
        </nav>
    </header>
    <main>
        <section class="hero" id="home">
            <h1>Your Journey Begins Here</h1>
            <p>Discover endless possibilities with us.</p>
        </section>
        <section class="content" id="services">
            <article class="card"><h2>Service One</h2><p>Experience the best of our first service offering.</p><button>Learn More</button></article>
            <article class="card"><h2>Service Two</h2><p>Our second service is tailored to your needs.</p><button>Learn More</button></article>
            <article class="card"><h2>Service Three</h2><p>Explore the features of our third service.</p><button>Learn More</button></article>
        </section>
    </main>
    <footer><p>&copy; 2023 Sample Landing Page. All rights reserved.</p></footer>
</body>
</html>`;

export function brainstormPreviewSource(previewId: string) {
  return previewId === BRAINSTORM_PREVIEW_ID ? BRAINSTORM_PREVIEW_HTML : "";
}
