import type { ClientProfile } from "../utils/types";

/**
 * Content script that extracts client profile info from an Upwork job detail page.
 * Injected dynamically by the background/scraper when enriching new jobs.
 */
export default defineContentScript({
	matches: ["https://www.upwork.com/jobs/*"],
	registration: "runtime",

	main(): ClientProfile {
		const getText = (selectors: string[]): string => {
			for (const sel of selectors) {
				const el = document.querySelector(sel);
				if (el?.textContent?.trim()) {
					return el.textContent.trim();
				}
			}
			return "";
		};

		// Client/company name - try multiple selectors
		const clientName = getText([
			'[data-qa="client-company-name"]',
			'[data-test="client-company-name"]',
			".client-info-header h3",
			'.cfe-ui-job-about-client [data-test="about-client-title"]',
			'[data-cy="about-client"] h3',
			".up-card-section h4",
			// Fallback: look for the "About the client" section and grab the first heading
		]);

		// If no specific selector worked, try a broader search
		let resolvedClientName = clientName;
		if (!resolvedClientName) {
			// Look for "About the client" section
			const headers = Array.from(document.querySelectorAll("h2, h3, h4, h5"));
			for (const h of headers) {
				const text = h.textContent?.toLowerCase() ?? "";
				if (text.includes("about the client")) {
					// The client name is often a sibling or nearby element
					const section = h.closest("section") ?? h.parentElement;
					if (section) {
						const nameEl =
							section.querySelector("h3") ??
							section.querySelector("h4") ??
							section.querySelector("[class*='company']") ??
							section.querySelector("[class*='name']");
						if (nameEl && nameEl !== h) {
							resolvedClientName = nameEl.textContent?.trim() ?? "";
						}
					}
					break;
				}
			}
		}

		// Client location
		const clientLocation = getText([
			'[data-qa="client-location"] .location',
			'[data-qa="client-location"]',
			'[data-test="client-location"]',
			'[data-test="location"] span',
			".client-location",
			'[data-cy="client-location"]',
		]);

		// Try extracting location from text like "Location: San Francisco, CA"
		let resolvedLocation = clientLocation;
		if (!resolvedLocation) {
			const allText = document.body.innerText;
			const locMatch = allText.match(
				/(?:Location|Client Location)[:\s]+([^\n]+)/i,
			);
			if (locMatch) {
				resolvedLocation = locMatch[1].trim();
			}
		}

		// Company profile URL
		let clientCompanyUrl = "";
		const companyLink = document.querySelector<HTMLAnchorElement>(
			'[data-qa="client-company-name"] a, [data-test="client-company-name"] a, a[href*="/company/"]',
		);
		if (companyLink?.href) {
			try {
				clientCompanyUrl = new URL(
					companyLink.href,
					"https://www.upwork.com",
				).toString();
			} catch {
				clientCompanyUrl = companyLink.href;
			}
		}

		// Member since
		const clientMemberSince = getText([
			'[data-qa="client-member-since"]',
			'[data-test="member-since"]',
			".member-since",
		]);

		let resolvedMemberSince = clientMemberSince;
		if (!resolvedMemberSince) {
			const allText = document.body.innerText;
			const memberMatch = allText.match(
				/Member [Ss]ince[:\s]+([A-Z][a-z]+ \d{1,2},? \d{4}|\w+ \d{4})/,
			);
			if (memberMatch) {
				resolvedMemberSince = memberMatch[1].trim();
			}
		}

		// Jobs posted
		const clientJobsPosted = getText([
			'[data-qa="client-jobs-posted"]',
			'[data-test="jobs-posted"]',
		]);

		let resolvedJobsPosted = clientJobsPosted;
		if (!resolvedJobsPosted) {
			const allText = document.body.innerText;
			const jobsMatch = allText.match(
				/(\d+)\s*(?:jobs?\s*posted|open\s*jobs?)/i,
			);
			if (jobsMatch) {
				resolvedJobsPosted = jobsMatch[0].trim();
			}
		}

		// Hire rate
		const clientHireRate = getText([
			'[data-qa="client-hire-rate"]',
			'[data-test="hire-rate"]',
		]);

		let resolvedHireRate = clientHireRate;
		if (!resolvedHireRate) {
			const allText = document.body.innerText;
			const hireMatch = allText.match(/(\d+%)\s*hire\s*rate/i);
			if (hireMatch) {
				resolvedHireRate = hireMatch[1].trim();
			}
		}

		return {
			clientName: resolvedClientName,
			clientLocation: resolvedLocation,
			clientCompanyUrl,
			clientMemberSince: resolvedMemberSince,
			clientJobsPosted: resolvedJobsPosted,
			clientHireRate: resolvedHireRate,
		};
	},
});
