#!/usr/bin/env python3
"""
Generic Documentation Link Checker for GitHub Pull Requests

This script checks if PRs that add new features include proper documentation links.
Works with any repository by using environment variables for configuration.

Usage:
	python documentation.py <pr_number> [github_token]

Environment Variables:
	GITHUB_REPOSITORY: owner/repo format (e.g., "myorg/myproject")
	GITHUB_TOKEN: GitHub API token (optional, increases rate limits)
	DOCUMENTATION_DOMAINS: Comma-separated list of docs domains
	DOCUMENTATION_KEYWORDS: Comma-separated keywords that indicate docs
	SKIP_KEYWORDS: Comma-separated keywords that skip docs requirement
"""

import os
import sys
from urllib.parse import urlparse

import requests


def get_documentation_domains():
	"""Get documentation domains from environment or use defaults."""
	env_domains = os.getenv("DOCUMENTATION_DOMAINS", "")
	if env_domains:
		return [domain.strip() for domain in env_domains.split(",")]
	
	# Default domains for common documentation sites
	return [
		"docs.github.io",
		"readthedocs.io",
		"gitbook.io",
		"notion.site",
		"confluence.com",
		"docs.google.com",
		"frappeframework.com",
		"docs.erpnext.com",
		"docs.frappe.io",
	]


def get_documentation_keywords():
	"""Get keywords that indicate documentation from environment."""
	env_keywords = os.getenv("DOCUMENTATION_KEYWORDS", "")
	if env_keywords:
		return [keyword.strip().lower() for keyword in env_keywords.split(",")]
	
	# Default keywords that indicate documentation
	return [
		"docs",
		"documentation",
		"readme",
		"guide",
		"tutorial",
		"wiki",
		"manual",
		"reference",
		"api docs",
		"user guide",
		"developer guide",
	]


def get_skip_keywords():
	"""Get keywords that skip documentation requirement."""
	env_keywords = os.getenv("SKIP_KEYWORDS", "")
	if env_keywords:
		return [keyword.strip().lower() for keyword in env_keywords.split(",")]
	
	# Default keywords that skip documentation requirement
	return [
		"no-docs",
		"skip-docs",
		"no docs",
		"skip docs",
		"backport",
		"revert",
		"hotfix",
		"emergency",
		"internal",
		"wip",
		"work in progress",
	]


def is_valid_url(url: str) -> bool:
	"""Check if URL has valid structure."""
	try:
		parts = urlparse(url)
		return all((parts.scheme, parts.netloc, parts.path))
	except Exception:
		return False


def is_documentation_link(word: str) -> bool:
	"""Check if a word/URL points to documentation."""
	if not word.startswith("http") or not is_valid_url(word):
		return False

	parsed_url = urlparse(word)
	documentation_domains = get_documentation_domains()
	
	# Check if domain is in documentation domains
	for domain in documentation_domains:
		if domain in parsed_url.netloc:
			return True

	# Check for GitHub links to docs
	if parsed_url.netloc == "github.com":
		path_parts = parsed_url.path.split("/")
		# Check for /owner/repo/wiki, /owner/repo/blob/main/docs, etc.
		if len(path_parts) >= 4:
			if "wiki" in path_parts or "docs" in parsed_url.path.lower():
				return True

	return False


def contains_documentation_keywords(text: str) -> bool:
	"""Check if text contains documentation-related keywords."""
	text_lower = text.lower()
	documentation_keywords = get_documentation_keywords()
	
	return any(keyword in text_lower for keyword in documentation_keywords)


def contains_documentation_link(body: str) -> bool:
	"""Check if PR body contains documentation links."""
	words = [word for line in body.splitlines() for word in line.split()]
	return any(is_documentation_link(word) for word in words)


def should_skip_documentation_check(title: str, body: str) -> bool:
	"""Check if documentation requirement should be skipped."""
	skip_keywords = get_skip_keywords()
	combined_text = f"{title} {body}".lower()
	
	return any(keyword in combined_text for keyword in skip_keywords)


def get_github_repository():
	"""Get GitHub repository from environment."""
	repo = os.getenv("GITHUB_REPOSITORY")
	if not repo:
		raise ValueError(
			"GITHUB_REPOSITORY environment variable not set. "
			"Should be in format 'owner/repo'"
		)
	return repo


def get_github_headers():
	"""Get GitHub API headers with optional authentication."""
	headers = {
		"Accept": "application/vnd.github.v3+json",
		"User-Agent": "Documentation-Checker/1.0"
	}
	
	token = os.getenv("DHWANI_FRAPPE_TOKEN")
	if token:
		headers["Authorization"] = f"token {token}"
	
	return headers


def check_pull_request(pr_number: str) -> "tuple[int, str]":
	"""
	Check if a pull request includes proper documentation.
	
	Returns:
		tuple[int, str]: (exit_code, message)
			exit_code: 0 for success, 1 for failure
			message: Human-readable status message
	"""
	try:
		repository = get_github_repository()
		headers = get_github_headers()
		
		# Fetch PR details
		url = f"https://api.github.com/repos/{repository}/pulls/{pr_number}"
		response = requests.get(url, headers=headers, timeout=30)
		
		if not response.ok:
			if response.status_code == 404:
				return 0, f"Pull Request #{pr_number} not found - may have been deleted or merged already. Skipping documentation check. ✅"
			elif response.status_code == 403:
				return 0, f"GitHub API rate limit or permissions issue. Skipping documentation check. ⚠️"
			else:
				return 0, f"GitHub API error: {response.status_code}. Skipping documentation check. ⚠️"

		payload = response.json()
		title = (payload.get("title") or "").strip()
		body = (payload.get("body") or "").strip()
		head_sha = (payload.get("head") or {}).get("sha")
		
		# Basic validation
		if not head_sha:
			return 1, "Invalid pull request data! ⚠️"

		# Check if this is a feature that needs documentation
		title_lower = title.lower()
		if not (title_lower.startswith("feat") or "feature" in title_lower):
			return 0, "Not a feature PR - skipping documentation check 🏃"

		# Check if documentation should be skipped
		if should_skip_documentation_check(title, body):
			return 0, "Documentation check skipped (found skip keyword) 🏃"

		# Check for documentation links
		if contains_documentation_link(body):
			return 0, "Documentation link found! You're awesome! 🎉"

		# Check for documentation keywords (less strict)
		if contains_documentation_keywords(body):
			return 0, "Documentation keywords found in PR description 📚"

		# No documentation found
		return 1, (
			"Documentation not found! ⚠️\n"
			"Feature PRs should include:\n"
			"• Link to documentation\n"
			"• Documentation keywords in description\n"
			"• Or add 'no-docs' if no documentation needed"
		)

	except requests.RequestException as e:
		return 1, f"Network error checking documentation: {e} ⚠️"
	except Exception as e:
		return 1, f"Error checking documentation: {e} ⚠️"


def main():
	"""Main entry point."""
	if len(sys.argv) < 2:
		print("Usage: python documentation.py <pr_number>")
		print("Environment variables:")
		print("  GITHUB_REPOSITORY (required): owner/repo")
		print("  GITHUB_TOKEN (optional): GitHub API token") 
		print("  DOCUMENTATION_DOMAINS (optional): comma-separated domains")
		print("  SKIP_KEYWORDS (optional): comma-separated skip keywords")
		sys.exit(1)

	pr_number = sys.argv[1]
	
	try:
		exit_code, message = check_pull_request(pr_number)
		print(message)
		sys.exit(exit_code)
	except ValueError as e:
		print(f"Configuration error: {e}")
		sys.exit(1)


if __name__ == "__main__":
	main()
