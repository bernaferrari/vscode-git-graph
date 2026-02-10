/**
 * Commit Message Component
 * Renders commit message with issue links
 */

import { useMemo } from 'react';

interface CommitMessageProps {
	message: string;
	issuePattern?: string;
	issueUrlTemplate?: string;
	maxLength?: number;
	className?: string;
}

export function CommitMessage({
	message,
	issuePattern,
	issueUrlTemplate,
	maxLength,
	className = '',
}: CommitMessageProps) {
	const content = useMemo(() => {
		let text = message;
		
		// Truncate if needed
		if (maxLength && text.length > maxLength) {
			text = text.slice(0, maxLength) + '...';
		}

		// If no issue pattern, just return text
		if (!issuePattern || !issueUrlTemplate) {
			return text;
		}

		// Parse and link issues
		const parts: Array<{ type: 'text' | 'link'; content: string; url?: string }> = [];
		const regex = new RegExp(issuePattern, 'g');
		let lastIndex = 0;
		let match;

		while ((match = regex.exec(text)) !== null) {
			// Add text before match
			if (match.index > lastIndex) {
				parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
			}

			// Add link
			const issueId = match[0];
			const url = issueUrlTemplate.replace('{issue}', issueId);
			parts.push({ type: 'link', content: issueId, url });

			lastIndex = match.index + issueId.length;
		}

		// Add remaining text
		if (lastIndex < text.length) {
			parts.push({ type: 'text', content: text.slice(lastIndex) });
		}

		return parts.length > 0 ? parts : text;
	}, [message, issuePattern, issueUrlTemplate, maxLength]);

	if (typeof content === 'string') {
		return <span className={className}>{content}</span>;
	}

	return (
		<span className={className}>
			{content.map((part, index) =>
				part.type === 'link' ? (
					<a
						key={index}
						href={part.url}
						className="text-primary hover:underline cursor-pointer"
						onClick={(e) => {
							e.preventDefault();
							if (part.url) {
								window.open(part.url, '_blank');
							}
						}}
					>
						{part.content}
					</a>
				) : (
					<span key={index}>{part.content}</span>
				)
			)}
		</span>
	);
}
