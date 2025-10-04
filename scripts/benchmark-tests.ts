#!/usr/bin/env bun

/**
 * Simple test benchmarking script
 *
 * This script runs each test file individually, times them, and generates
 * a comprehensive performance report sorted by duration (slowest first).
 */

import { $ } from "bun";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

interface TestResult {
	name: string;
	path: string;
	time: number;
	status: "passed" | "failed" | "timeout";
	prefix?: string;
	testCount?: number;
}

interface BenchmarkReport {
	timestamp: string;
	totalTime: number;
	testCount: number;
	byPrefix: Record<string, { count: number; time: number }>;
	slowest: TestResult[];
	all: TestResult[];
}

const TIMEOUT_MS = 60000; // 1 minute timeout per test file

/**
 * Get all test files from src/test directory
 */
function getAllTestFiles(): string[] {
	const testDir = join(process.cwd(), "src", "test");
	const files = readdirSync(testDir, { withFileTypes: true });

	return files
		.filter(dirent => dirent.isFile() && dirent.name.endsWith('.test.ts'))
		.map(dirent => join(testDir, dirent.name))
		.sort();
}

/**
 * Extract prefix from test file name (e.g., "mcp-", "cli-", "board-")
 */
function getTestPrefix(filename: string): string {
	const match = filename.match(/^([a-z]+)-/);
	return match?.[1] ?? "other";
}

/**
 * Run a single test file and measure its execution time
 */
async function runSingleTest(testFile: string): Promise<TestResult> {
	const startTime = Date.now();
	const filename = testFile.split("/").pop() || testFile;
	const relativePath = relative(process.cwd(), testFile);

	console.log(`Running ${filename}...`);

	try {
		const result = await $`bun test ${testFile} --timeout ${TIMEOUT_MS}`.quiet();
		const endTime = Date.now();
		const duration = endTime - startTime;

		// Parse test count from output (rough estimation)
		const output = result.stdout?.toString() || "";
		const testCountMatch = output.match(/Ran (\d+) tests?/);
		const testCount = testCountMatch?.[1] ? parseInt(testCountMatch[1], 10) : undefined;

		return {
			name: filename,
			path: relativePath,
			time: duration,
			status: "passed",
			prefix: getTestPrefix(filename),
			testCount
		};
	} catch (error: any) {
		const endTime = Date.now();
		const duration = endTime - startTime;

		// Check if it was a timeout
		const isTimeout = duration >= TIMEOUT_MS;

		return {
			name: filename,
			path: relativePath,
			time: duration,
			status: isTimeout ? "timeout" : "failed",
			prefix: getTestPrefix(filename)
		};
	}
}

/**
 * Generate benchmark report
 */
function generateReport(results: TestResult[]): BenchmarkReport {
	const totalTime = results.reduce((sum, result) => sum + result.time, 0);
	const testCount = results.length;

	// Group by prefix
	const byPrefix: Record<string, { count: number; time: number }> = {};
	for (const result of results) {
		const prefix = result.prefix || "other";
		if (!byPrefix[prefix]) {
			byPrefix[prefix] = { count: 0, time: 0 };
		}
		byPrefix[prefix].count++;
		byPrefix[prefix].time += result.time;
	}

	// Sort results by time (slowest first)
	const sortedResults = [...results].sort((a, b) => b.time - a.time);

	return {
		timestamp: new Date().toISOString(),
		totalTime,
		testCount,
		byPrefix,
		slowest: sortedResults.slice(0, 10), // Top 10 slowest
		all: sortedResults
	};
}

/**
 * Format time in a human-readable way
 */
function formatTime(ms: number): string {
	if (ms < 1000) {
		return `${ms}ms`;
	}
	return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Print summary to console
 */
function printSummary(report: BenchmarkReport) {
	console.log("\n=== TEST BENCHMARK RESULTS ===");
	console.log(`Total time: ${formatTime(report.totalTime)}`);
	console.log(`Test files: ${report.testCount}`);
	console.log(`Timestamp: ${report.timestamp}`);

	console.log("\n=== BY PREFIX ===");
	const prefixes = Object.entries(report.byPrefix)
		.sort((a, b) => b[1].time - a[1].time);

	for (const [prefix, stats] of prefixes) {
		const avgTime = stats.time / stats.count;
		console.log(`${prefix.padEnd(8)}: ${stats.count.toString().padStart(2)} files, ` +
			`${formatTime(stats.time).padStart(8)}, avg ${formatTime(avgTime)}`);
	}

	console.log("\n=== SLOWEST TESTS ===");
	for (let i = 0; i < Math.min(10, report.slowest.length); i++) {
		const test = report.slowest[i];
		if (!test) continue;
		const status = test.status === "passed" ? "✓" :
					   test.status === "failed" ? "✗" : "⏱";
		console.log(`${(i + 1).toString().padStart(2)}. ${status} ${test.name.padEnd(40)} ${formatTime(test.time).padStart(8)}`);
	}
}

/**
 * Save report to JSON file
 */
async function saveReport(report: BenchmarkReport, filename: string = "test-benchmark-report.json") {
	await Bun.write(filename, JSON.stringify(report, null, 2));
	console.log(`\nReport saved to ${filename}`);
}

/**
 * Main execution
 */
async function main() {
	console.log("🚀 Starting test benchmark...\n");

	const testFiles = getAllTestFiles();
	console.log(`Found ${testFiles.length} test files\n`);

	const results: TestResult[] = [];
	const startTime = Date.now();

	// Run each test file sequentially
	for (const testFile of testFiles) {
		const result = await runSingleTest(testFile);
		results.push(result);

		// Show progress
		const status = result.status === "passed" ? "✓" :
					   result.status === "failed" ? "✗" : "⏱";
		console.log(`  ${status} ${result.name} - ${formatTime(result.time)}`);
	}

	const totalBenchmarkTime = Date.now() - startTime;
	console.log(`\nBenchmark completed in ${formatTime(totalBenchmarkTime)}`);

	// Generate and display report
	const report = generateReport(results);
	printSummary(report);

	// Save to file
	await saveReport(report);

	// Show any failures
	const failures = results.filter(r => r.status !== "passed");
	if (failures.length > 0) {
		console.log(`\n⚠️  ${failures.length} test file(s) failed or timed out:`);
		for (const failure of failures) {
			console.log(`   ${failure.status === "timeout" ? "⏱" : "✗"} ${failure.name}`);
		}
	}
}

// Run if this file is executed directly
if (import.meta.main) {
	main().catch(error => {
		console.error("Benchmark failed:", error);
		process.exit(1);
	});
}