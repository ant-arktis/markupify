export const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/x-icon" href="https://llego.dev/favicon.svg">
    <title>Markupify - llego.dev</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            background-color: #f3f4f6;
            color: #1f2937;
        }
        .dark body {
            background-color: #111827;
            color: #f9fafb;
        }
    </style>
</head>
<body class="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
    <header class="max-w-4xl w-full my-8 sm:my-12 lg:my-16">
        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
            Markupify: Turn Websites into LLM Data
        </h1>
    </header>
    <main class="max-w-4xl w-full space-y-12">
        <section class="px-4 sm:px-0">
            <p class="text-lg sm:text-xl text-gray-600 dark:text-gray-400 text-center leading-relaxed">
			Unleash the power of web data for your LLM projects. Effortlessly convert websites into structured markdown, streamline your data preparation, and focus on building innovative AI solutions. Embrace the future with Markupify and revolutionize your language models.
            </p>
        </section>
		<section class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8">
		<h2 class="text-2xl font-bold mb-6">How to Use</h2>
		<ol class="list-decimal list-inside space-y-6 text-gray-600 dark:text-gray-400">
			<li>
				To convert a website to markdown, use the following URL format:
				<pre class="bg-gray-100 dark:bg-gray-700 rounded-md p-2 sm:p-4 mt-4 overflow-x-auto text-sm sm:text-base whitespace-nowrap">
	https://md.llego.dev/?url=&lt;target-url&gt;&amp;api_key=&lt;your-api-key&gt;
				</pre>
				Example:
				<pre class="bg-gray-100 dark:bg-gray-700 rounded-md p-2 sm:p-4 mt-2 overflow-x-auto text-sm sm:text-base whitespace-nowrap">
	https://md.llego.dev/?url=https://example.com&amp;api_key=your_api_key_here
				</pre>
				cURL command:
				<pre class="bg-gray-100 dark:bg-gray-700 rounded-md p-2 sm:p-4 mt-2 overflow-x-auto text-sm sm:text-base whitespace-nowrap">
	curl "https://md.llego.dev/?url=https://example.com&amp;api_key=your_api_key_here"
				</pre>
			</li>
			<li>
				Replace <code>&lt;target-url&gt;</code> with the URL of the website you want to convert to markdown.
			</li>
			<li>
				Replace <code>&lt;your-api-key&gt;</code> with your assigned API key.
			</li>
			<li>
				Optional Parameters:
				<ul class="list-disc list-inside mt-4 space-y-2">
					<li>
						<code>enableDetailedResponse</code> (boolean, default: false): Toggle for detailed response with full HTML content.
						<pre class="bg-gray-100 dark:bg-gray-700 rounded-md p-2 sm:p-4 mt-2 overflow-x-auto text-sm sm:text-base whitespace-nowrap">
	https://md.llego.dev/?url=https://example.com&amp;api_key=your_api_key_here&amp;enableDetailedResponse=true
						</pre>
						cURL command:
						<pre class="bg-gray-100 dark:bg-gray-700 rounded-md p-2 sm:p-4 mt-2 overflow-x-auto text-sm sm:text-base whitespace-nowrap">
	curl "https://md.llego.dev/?url=https://example.com&amp;api_key=your_api_key_here&amp;enableDetailedResponse=true"
						</pre>
					</li>
					<li>
						<code>crawlSubpages</code> (boolean, default: false): Crawl and return markdown for up to 10 subpages.
						<pre class="bg-gray-100 dark:bg-gray-700 rounded-md p-2 sm:p-4 mt-2 overflow-x-auto text-sm sm:text-base whitespace-nowrap">
	https://md.llego.dev/?url=https://example.com&amp;api_key=your_api_key_here&amp;crawlSubpages=true
						</pre>
						cURL command:
						<pre class="bg-gray-100 dark:bg-gray-700 rounded-md p-2 sm:p-4 mt-2 overflow-x-auto text-sm sm:text-base whitespace-nowrap">
	curl "https://md.llego.dev/?url=https://example.com&amp;api_key=your_api_key_here&amp;crawlSubpages=true"
						</pre>
					</li>
					<li>
						<code>llmFilter</code> (boolean, default: false): Filter out unnecessary information using LLM.
						<pre class="bg-gray-100 dark:bg-gray-700 rounded-md p-2 sm:p-4 mt-2 overflow-x-auto text-sm sm:text-base whitespace-nowrap">
	https://md.llego.dev/?url=https://example.com&amp;api_key=your_api_key_here&amp;llmFilter=true
						</pre>
						cURL command:
						<pre class="bg-gray-100 dark:bg-gray-700 rounded-md p-2 sm:p-4 mt-2 overflow-x-auto text-sm sm:text-base whitespace-nowrap">
	curl "https://md.llego.dev/?url=https://example.com&amp;api_key=your_api_key_here&amp;llmFilter=true"
						</pre>
					</li>
				</ul>
			</li>
			<li>
				Response Types:
				<ul class="list-disc list-inside mt-4 space-y-2">
					<li>
						Add <code>Content-Type: text/plain</code> in headers for plain text response.
						<pre class="bg-gray-100 dark:bg-gray-700 rounded-md p-2 sm:p-4 mt-2 overflow-x-auto text-sm sm:text-base whitespace-nowrap">
	curl -H "Content-Type: text/plain" "https://md.llego.dev/?url=https://example.com&amp;api_key=your_api_key_here"
						</pre>
					</li>
					<li>
						Add <code>Content-Type: application/json</code> in headers for JSON response.
						<pre class="bg-gray-100 dark:bg-gray-700 rounded-md p-2 sm:p-4 mt-2 overflow-x-auto text-sm sm:text-base whitespace-nowrap">
	curl -H "Content-Type: application/json" "https://md.llego.dev/?url=https://example.com&amp;api_key=your_api_key_here"
						</pre>
					</li>
				</ul>
			</li>
			<li>
				Make a GET request to the generated URL to retrieve the markdown content of the website.
			</li>
		</ol>
	</section>
    </main>
    <footer class="max-w-4xl w-full my-8 sm:my-12 lg:my-16 text-center text-sm text-gray-600 dark:text-gray-400">
        Made with ❤️ by <a href="https://github.com/llegomark" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 hover:underline transition duration-300 ease-in-out">Mark Anthony Llego</a>
    </footer>
</body>
</html>
`;
