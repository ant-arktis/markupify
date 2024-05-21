import puppeteer from '@cloudflare/puppeteer';
import { Tweet } from 'react-tweet/api';
import { html } from './response';

const KEEP_BROWSER_ALIVE_IN_SECONDS = 60;
const TEN_SECONDS = 10000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const CACHE_EXPIRATION_TTL = 3600; // 1 hour

export default {
	async fetch(request: Request, env: Env) {
		const url = new URL(request.url);
		const targetUrl = url.searchParams.get('url');
		const apiKey = url.searchParams.get('api_key');

		if (targetUrl) {
			if (!apiKey || apiKey !== env.API_KEY) {
				return new Response(
					`Unauthorized. Please provide a valid API key using the "api_key" query parameter.

Example URL format:
https://md.llego.dev/?url=<target-url>&api_key=<your-api-key>

Replace "<target-url>" with the URL you want to convert to markdown, and "<your-api-key>" with your assigned API key.`,
					{ status: 401 }
				);
			}

			const enableDetailedResponse = url.searchParams.get('enableDetailedResponse') === 'true';
			const crawlSubpages = url.searchParams.get('crawlSubpages') === 'true';
			const contentType = request.headers.get('content-type') === 'application/json' ? 'json' : 'text';
			const llmFilter = url.searchParams.get('llmFilter') === 'true';

			const id = env.BROWSER.idFromName('browser');
			const obj = env.BROWSER.get(id);

			const resp = await obj.fetch(request.url, {
				headers: {
					...request.headers,
					'x-url': targetUrl,
					'x-enable-detailed-response': String(enableDetailedResponse),
					'x-crawl-subpages': String(crawlSubpages),
					'x-content-type': contentType,
					'x-llm-filter': String(llmFilter),
				},
			});

			return resp;
		} else {
			return new Response(html, { headers: { 'Content-Type': 'text/html' } });
		}
	},
};

export class Browser {
	state: DurableObjectState;
	env: Env;
	keptAliveInSeconds: number;
	storage: DurableObjectStorage;
	browser: puppeteer.Browser | undefined;
	request: Request | undefined;
	llmFilter: boolean;

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;
		this.keptAliveInSeconds = 0;
		this.storage = this.state.storage;
		this.request = undefined;
		this.llmFilter = false;
	}

	async fetch(request: Request) {
		this.request = request;

		if (!(request.method === 'GET')) {
			return new Response('Method Not Allowed', { status: 405 });
		}

		const url = new URL(request.url).searchParams.get('url');
		const enableDetailedResponse = new URL(request.url).searchParams.get('enableDetailedResponse') === 'true';
		const crawlSubpages = new URL(request.url).searchParams.get('crawlSubpages') === 'true';
		const contentType = request.headers.get('content-type') === 'application/json' ? 'json' : 'text';

		this.llmFilter = new URL(request.url).searchParams.get('llmFilter') === 'true';

		if (contentType === 'text' && crawlSubpages) {
			return new Response('Error: Crawl subpages can only be enabled with JSON content type', { status: 400 });
		}

		if (!url) {
			return this.buildHelpResponse();
		}

		if (!this.isValidUrl(url)) {
			return new Response('Invalid URL provided, should be a full URL starting with http:// or https://', { status: 400 });
		}

		try {
			if (!(await this.ensureBrowser())) {
				return new Response('Could not start browser instance. Please check the logs for more details.', { status: 500 });
			}

			return crawlSubpages
				? await this.crawlSubpages(url, enableDetailedResponse, contentType)
				: await this.processSinglePage(url, enableDetailedResponse, contentType);
		} catch (error) {
			console.error(`Error processing URL: ${url}. Error: ${(error as Error).message}`);
			console.error((error as Error).stack);
			return new Response('An error occurred while processing the request. Please check the logs for more details.', { status: 500 });
		}
	}

	async ensureBrowser() {
		let retries = MAX_RETRIES;
		while (retries > 0) {
			if (!this.browser || !this.browser.isConnected()) {
				try {
					console.log('Launching new browser instance');
					// @ts-ignore
					this.browser = await puppeteer.launch(this.env.MYBROWSER);
					return true;
				} catch (error) {
					console.error(`Error launching browser instance. Error: ${(error as Error).message}`);
					console.error((error as Error).stack);
					retries--;
					if (retries === 0) {
						return false;
					}
					await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
				}
			} else {
				return true;
			}
		}
		return false;
	}

	async crawlSubpages(baseUrl: string, enableDetailedResponse: boolean, contentType: string) {
		try {
			const page = await this.browser!.newPage();
			await page.goto(baseUrl);
			const links = await this.extractLinks(page, baseUrl);
			await page.close();

			const uniqueLinks = Array.from(new Set(links)).splice(0, 10);
			const md = await this.getWebsiteMarkdown({ urls: uniqueLinks, enableDetailedResponse, classThis: this, env: this.env });

			let status = 200;
			if (md.some((item) => item.md === 'Rate limit exceeded')) {
				status = 429;
			}

			return new Response(JSON.stringify(md), { status: status });
		} catch (error) {
			console.error(`Error crawling subpages for URL: ${baseUrl}. Error: ${(error as Error).message}`);
			console.error((error as Error).stack);
			throw error;
		}
	}

	async processSinglePage(url: string, enableDetailedResponse: boolean, contentType: string) {
		try {
			const md = await this.getWebsiteMarkdown({ urls: [url], enableDetailedResponse, classThis: this, env: this.env });
			if (contentType === 'json') {
				let status = 200;
				if (md.some((item) => item.md === 'Rate limit exceeded')) {
					status = 429;
				}
				return new Response(JSON.stringify(md), { status: status });
			} else {
				return new Response(md[0].md, { status: md[0].md === 'Rate limit exceeded' ? 429 : 200 });
			}
		} catch (error) {
			console.error(`Error processing single page for URL: ${url}. Error: ${(error as Error).message}`);
			console.error((error as Error).stack);
			throw error;
		}
	}

	async extractLinks(page: puppeteer.Page, baseUrl: string) {
		return await page.evaluate((baseUrl) => {
			return Array.from(document.querySelectorAll('a'))
				.map((link) => (link as { href: string }).href)
				.filter((link) => link.startsWith(baseUrl));
		}, baseUrl);
	}

	async getTweet(tweetID: string) {
		const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetID}&lang=en&features=tfw_timeline_list%3A%3Btfw_follower_count_sunset%3Atrue%3Btfw_tweet_edit_backend%3Aon%3Btfw_refsrc_session%3Aon%3Btfw_fosnr_soft_interventions_enabled%3Aon%3Btfw_show_birdwatch_pivots_enabled%3Aon%3Btfw_show_business_verified_badge%3Aon%3Btfw_duplicate_scribes_to_settings%3Aon%3Btfw_use_profile_image_shape_enabled%3Aon%3Btfw_show_blue_verified_badge%3Aon%3Btfw_legacy_timeline_sunset%3Atrue%3Btfw_show_gov_verified_badge%3Aon%3Btfw_show_business_affiliate_badge%3Aon%3Btfw_tweet_edit_frontend%3Aon&token=4c2mmul6mnh`;

		let retries = MAX_RETRIES;
		while (retries > 0) {
			try {
				const resp = await fetch(url, {
					headers: {
						'User-Agent':
							'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
						Accept: 'application/json',
						'Accept-Language': 'en-US,en;q=0.5',
						'Accept-Encoding': 'gzip, deflate, br',
						Connection: 'keep-alive',
						'Upgrade-Insecure-Requests': '1',
						'Cache-Control': 'max-age=0',
						TE: 'Trailers',
					},
				});
				console.log(`Twitter API response status: ${resp.status}`);
				const data = (await resp.json()) as Tweet;
				return data;
			} catch (error) {
				console.error(`Error fetching tweet data. Error: ${(error as Error).message}`);
				console.error((error as Error).stack);
				retries--;
				if (retries === 0) {
					throw error;
				}
				await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
			}
		}
		throw new Error('Failed to fetch tweet data after multiple retries');
	}

	async getWebsiteMarkdown({
		urls,
		enableDetailedResponse,
		classThis,
		env,
	}: {
		urls: string[];
		enableDetailedResponse: boolean;
		classThis: Browser;
		env: Env;
	}) {
		classThis.keptAliveInSeconds = 0;

		const isBrowserActive = await this.ensureBrowser();

		if (!isBrowserActive) {
			return [{ url: urls[0], md: 'Could not start browser instance' }];
		}

		return await Promise.all(
			urls.map(async (url) => {
				const ip = this.request?.headers.get('cf-connecting-ip') || 'unknown';
				const { success, limit, remaining, reset } = await this.checkRateLimit(env, ip);

				if (!success) {
					return {
						url,
						md: `Rate limit exceeded. Limit: ${limit} requests per minute. Remaining: ${remaining}. Resets in ${reset} seconds.`,
					};
				}

				const id = url + (enableDetailedResponse ? '-detailed' : '') + (this.llmFilter ? '-llm' : '');
				const cached = await env.MD_CACHE.get(id);

				if (url.startsWith('https://x.com') || url.startsWith('https://twitter.com')) {
					const tweetID = url.split('/').pop();
					if (!tweetID) return { url, md: 'Invalid tweet URL' };

					const cacheFind = await env.MD_CACHE.get(tweetID);
					if (cacheFind) return { url, md: cacheFind };

					console.log(`Processing tweet ID: ${tweetID}`);
					const tweet = await this.getTweet(tweetID);

					if (!tweet || typeof tweet !== 'object' || tweet.text === undefined) return { url, md: 'Tweet not found' };

					const tweetMd = `Tweet from @${tweet.user?.name ?? tweet.user?.screen_name ?? 'Unknown'}\n\n${tweet.text}\nImages: ${
						tweet.photos ? tweet.photos.map((photo) => photo.url).join(', ') : 'none'
					}\nTime: ${tweet.created_at}, Likes: ${tweet.favorite_count}, Retweets: ${tweet.conversation_count}`;

					await env.MD_CACHE.put(tweetID, tweetMd);

					return { url, md: tweetMd };
				}

				let md = cached ?? (await classThis.fetchAndProcessPage(url, enableDetailedResponse));

				if (this.llmFilter && !cached) {
					for (let i = 0; i < 60; i++) await this.checkRateLimit(env, ip);
					// @ts-ignore
					const answer = (await env.AI.run('@hf/meta-llama/meta-llama-3-8b-instruct', {
						prompt: `You are an AI assistant that converts webpage content to clean, readable markdown while filtering out unnecessary information. Please follow these guidelines:

            1. Start with the main heading or article title at the top of the markdown output.
            2. Remove any inappropriate content, ads, irrelevant information, or distracting elements.
            3. If unsure about including something, err on the side of keeping it to preserve important details.
            4. Organize the content into a logical structure using markdown headers, lists, and paragraphs.
            5. Use markdown formatting to enhance readability, such as bold and italic text, links, and code blocks where appropriate.
            6. Aim for a clean, readable, and concise markdown representation of the webpage content.
            7. If the webpage contains images, include relevant image descriptions and alt text.
            8. Ensure the output is in English and contains all essential points in sufficient detail to be useful.
            9. Remove all navigation, menu, footer, and other non-content elements.
            10. Return only the markdown content or main article content, starting with the heading or the article title, without any additional text or explanations.
            
            Input:
            \`\`\`html
            ${md}
            \`\`\`
            
            Output:
            \`\`\`markdown
            `,
					})) as { response: string };

					md = answer.response;
				}

				await env.MD_CACHE.put(id, md, { expirationTtl: CACHE_EXPIRATION_TTL });
				return { url, md };
			})
		);
	}

	async fetchAndProcessPage(url: string, enableDetailedResponse: boolean): Promise<string> {
		let retries = MAX_RETRIES;
		while (retries > 0) {
			try {
				const page = await this.browser!.newPage();
				await page.goto(url, { timeout: 30000 });
				const md = await page.evaluate((enableDetailedResponse) => {
					function extractArticleMarkdown() {
						const readabilityScript = document.createElement('script');
						readabilityScript.src = 'https://unpkg.com/@mozilla/readability/Readability.js';
						document.head.appendChild(readabilityScript);

						const turndownScript = document.createElement('script');
						turndownScript.src = 'https://unpkg.com/turndown/dist/turndown.js';
						document.head.appendChild(turndownScript);

						let md = 'no content';

						md = Promise.all([
							new Promise((resolve) => (readabilityScript.onload = resolve)),
							new Promise((resolve) => (turndownScript.onload = resolve)),
						]).then(() => {
							// @ts-ignore
							const reader = new Readability(document.cloneNode(true), {
								charThreshold: 0,
								keepClasses: true,
								nbTopCandidates: 500,
							});

							// Parse the article content
							const article = reader.parse();

							// Turndown instance to convert HTML to Markdown
							// @ts-ignore
							const turndownService = new TurndownService();

							if (enableDetailedResponse) {
								// Remove scripts, styles, iframes, and noscript elements directly in the browser context
								document.querySelectorAll('script, style, iframe, noscript').forEach((element) => element.remove());
							}

							// Convert article content to Markdown
							const markdown = turndownService.turndown(enableDetailedResponse ? document.body.innerHTML : article.content);

							return markdown;
						}) as unknown as string;

						return md;
					}
					return extractArticleMarkdown();
				}, enableDetailedResponse);
				await page.close();
				return md;
			} catch (error) {
				console.error(`Error fetching and processing page for URL: ${url}. Error: ${(error as Error).message}`);
				console.error((error as Error).stack);
				retries--;
				if (retries === 0) {
					throw error;
				}
				await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
			}
		}
		throw new Error(`Failed to fetch and process page for URL: ${url} after multiple retries`);
	}

	buildHelpResponse() {
		return new Response(html, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
	}

	isValidUrl(url: string): boolean {
		return /^(http|https):\/\/[^ "]+$/.test(url);
	}

	async checkRateLimit(env: Env, ip: string) {
		const { success, limit, remaining, reset } = await env.RATELIMITER.limit({ key: ip });
		return { success, limit, remaining, reset };
	}

	async alarm() {
		this.keptAliveInSeconds += 10;
		if (this.keptAliveInSeconds < KEEP_BROWSER_ALIVE_IN_SECONDS) {
			await this.storage.setAlarm(Date.now() + TEN_SECONDS);
		} else {
			if (this.browser) {
				await this.browser.close();
				this.browser = undefined;
			}
		}
	}
}
