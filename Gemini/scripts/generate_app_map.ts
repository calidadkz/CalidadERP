import fs from 'fs/promises';
import path from 'path';

// List of files and directories to include in the app map.
// Removed 'supabase' as it was deleted by the user.
const includedPaths = [
    // Root files
    'App.tsx',
    'index.tsx',
    'constants.ts',
    'server.js',
    'package.json',
    'vite.config.ts',
    'firebase.json',
    // Directories
    'components',
    'features',
    'services',
    'types',
    'Gemini', // Added Gemini to track project documentation and scripts
];

// Output file path
const outputFilePath = path.join('Gemini', 'Project summaries', 'app_map.md');

// Type definition for the file tree structure
interface FileNode {
    name: string;
    type: 'file' | 'directory';
    path: string;
    children?: FileNode[];
}

/**
 * Recursively traverses a directory to build a tree structure.
 */
async function buildFileTree(entryPath: string, basePath: string = '.'): Promise<FileNode | null> {
    try {
        const stats = await fs.stat(entryPath);
        const name = path.basename(entryPath);
        const relativePath = path.relative(basePath, entryPath);

        // Skip node_modules and hidden folders/files
        if (name === 'node_modules' || name.startsWith('.')) {
            return null;
        }

        if (stats.isDirectory()) {
            const childrenNames = await fs.readdir(entryPath);
            const children = await Promise.all(
                childrenNames.map(child => buildFileTree(path.join(entryPath, child), basePath))
            );
            return {
                name,
                type: 'directory',
                path: relativePath,
                children: children.filter((child): child is FileNode => child !== null),
            };
        } else {
            return {
                name,
                type: 'file',
                path: relativePath,
            };
        }
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }
        console.error(`Error processing path ${entryPath}:`, error);
        throw error;
    }
}

/**
 * Formats a file tree node into a Markdown string.
 */
function formatTreeAsMarkdown(node: FileNode, depth = 0): string {
    const indent = '  '.repeat(depth);
    const prefix = depth === 0 ? '' : '- ';
    const icon = node.type === 'directory' ? '📁' : '📄';
    let markdown = `${indent}${prefix}${icon} **${node.name}**\n`;

    if (node.children && node.children.length > 0) {
        const sortedChildren = [...node.children].sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        for (const child of sortedChildren) {
            markdown += formatTreeAsMarkdown(child, depth + 1);
        }
    }
    return markdown;
}

/**
 * Main function to generate the application map.
 */
async function generateAppMap() {
    console.log('🚀 Starting to generate the application map...');

    let markdownContent = '# 🗺️ Application Map\n\n';
    markdownContent += `This document provides an overview of the project structure, generated on ${new Date().toUTCString()}.\n\n`;

    const rootTreeNodes: FileNode[] = [];

    for (const p of includedPaths) {
        const node = await buildFileTree(p, '.');
        if (node) {
            rootTreeNodes.push(node);
        } else {
            // Check if it's a critical path or just optional
            if (['features', 'services', 'types'].includes(p)) {
                console.warn(`⚠️ Warning: Key directory not found: ${p}`);
            }
        }
    }

    const sortedRootNodes = rootTreeNodes.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });

    for (const node of sortedRootNodes) {
        markdownContent += formatTreeAsMarkdown(node, 0);
    }

    try {
        await fs.mkdir(path.dirname(outputFilePath), { recursive: true });
        await fs.writeFile(outputFilePath, markdownContent);
        console.log(`✅ Application map successfully generated at: ${outputFilePath}`);
    } catch (error) {
        console.error('❌ Failed to write application map file:', error);
    }
}

generateAppMap();