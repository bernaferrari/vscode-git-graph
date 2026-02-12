/**
 * Git Blame Utils
 */

export interface BlameLineInfo {
    hash: string;
    author: string;
    authorEmail: string;
    date: string;
    summary: string;
    content: string;
    // Original line number in the commit
    originalLine?: number;
    // Final line number in the file
    finalLine?: number;
}

/**
 * Parse git blame --line-porcelain output
 */
export function parseGitBlame(blameOutput: string): BlameLineInfo[] {
    if (!blameOutput) return [];

    const lines: BlameLineInfo[] = [];
    const rawLines = blameOutput.split('\n');

    let currentHash = '';
    let currentAuthor = '';
    let currentEmail = '';
    let currentDate = '';
    let currentSummary = '';

    for (const line of rawLines) {
        if (!line) continue;

        if (line.startsWith('\t')) {
            // Content line, ends the block for this line
            lines.push({
                hash: currentHash,
                author: currentAuthor,
                authorEmail: currentEmail,
                date: currentDate,
                summary: currentSummary,
                content: line.substring(1),
            });
            // Reset is not strictly necessary as new block will overwrite, but good for safety
            currentHash = '';
        } else if (/^[0-9a-f]{40}/.test(line)) {
            // New block start
            currentHash = line.split(' ')[0] ?? '';
        } else if (line.startsWith('author ')) {
            currentAuthor = line.substring(7);
        } else if (line.startsWith('author-mail ')) {
            currentEmail = line.substring(12).replace(/[<,>]/g, '');
        } else if (line.startsWith('author-time ')) {
            const ts = parseInt(line.substring(12), 10);
            if (!isNaN(ts)) {
                // Use ISO string for consistency
                currentDate = new Date(ts * 1000).toISOString();
            }
        } else if (line.startsWith('summary ')) {
            currentSummary = line.substring(8);
        }
    }

    return lines;
}
