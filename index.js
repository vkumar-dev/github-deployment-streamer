#!/usr/bin/env node

import { spawn } from 'child_process';
import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stateFile = path.join(__dirname, '.state.json');

// Parse CLI arguments
const program = new Command();
program
  .name('gh-streamer')
  .description('Stream GitHub deployment runs chronologically')
  .option('-i, --interval <minutes>', 'Scan interval in minutes (default: 30)', '30')
  .option('--verbose', 'Enable verbose logging')
  .parse(process.argv);

const options = program.opts();
const scanInterval = parseInt(options.interval) * 60 * 1000;
let activeStreams = new Set();
let seenRuns = new Set();

function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function log(msg) {
  console.log(`${chalk.gray(`[${getTimestamp()}]`)} > ${msg}`);
}

function logError(msg) {
  console.error(`${chalk.gray(`[${getTimestamp()}]`)} > ${chalk.red('❌ ' + msg)}`);
}

function logSuccess(msg) {
  console.log(`${chalk.gray(`[${getTimestamp()}]`)} > ${chalk.green('✓ ' + msg)}`);
}

function logInfo(msg) {
  console.log(`${chalk.gray(`[${getTimestamp()}]`)} > ${chalk.cyan('ℹ ' + msg)}`);
}

function logWarn(msg) {
  console.log(`${chalk.gray(`[${getTimestamp()}]`)} > ${chalk.yellow('⚠ ' + msg)}`);
}

function loadState() {
  if (fs.existsSync(stateFile)) {
    try {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      seenRuns = new Set(state.seenRuns || []);
      return state.lastScanTime || null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

function saveState(lastScanTime) {
  const state = {
    seenRuns: Array.from(seenRuns),
    lastScanTime
  };
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function execCommand(cmd, args = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || stdout.trim()));
      }
    });
  });
}

async function showBanner() {
  console.clear();
  const banner = `
${chalk.bold.cyan('┌─────────────────────────────────────────────────────────┐')}
${chalk.bold.cyan('│')}                                                             ${chalk.bold.cyan('│')}
${chalk.bold.cyan('│')}  ${chalk.bold.yellow('🚀 GitHub Deployment Streamer')}                        ${chalk.bold.cyan('│')}
${chalk.bold.cyan('│')}  ${chalk.cyan('Real-time deployment monitoring across all repos')}     ${chalk.bold.cyan('│')}
${chalk.bold.cyan('│')}                                                             ${chalk.bold.cyan('│')}
${chalk.bold.cyan('└─────────────────────────────────────────────────────────┘')}
`;
  console.log(banner);
}

async function checkGHCLI() {
  process.stdout.write(`${chalk.gray(`[${getTimestamp()}]`)} > Checking GitHub CLI...`);
  try {
    await execCommand('gh', ['--version']);
    console.log(chalk.green(' ✓\n'));
    return true;
  } catch (error) {
    console.log(chalk.red(' ✗\n'));
    logError('GitHub CLI not found. Please install it: https://cli.github.com');
    return false;
  }
}

async function checkGHAuth() {
  process.stdout.write(`${chalk.gray(`[${getTimestamp()}]`)} > Checking GitHub authentication...`);
  try {
    await execCommand('gh', ['auth', 'status']);
    console.log(chalk.green(' ✓\n'));
    return true;
  } catch (error) {
    console.log(chalk.red(' ✗\n'));
    logError('Not authenticated with GitHub. Run: gh auth login');
    return false;
  }
}

async function getUserInfo() {
  logInfo('Fetching user details...');
  try {
    const output = await execCommand('gh', ['api', 'user', '-q', '.login,.name,.company,.location,.public_repos']);
    const lines = output.split('\n').filter(l => l.trim());
    
    if (lines.length >= 5) {
      const login = lines[0];
      const name = lines[1] || 'N/A';
      const company = lines[2] || 'N/A';
      const location = lines[3] || 'N/A';
      const pubRepos = lines[4];

      console.log('');
      console.log(chalk.cyan('  ┌─ User Details ─────────────────────┐'));
      console.log(chalk.cyan('  │') + ` Username:    ${chalk.bold(login)}`);
      console.log(chalk.cyan('  │') + ` Name:        ${name}`);
      console.log(chalk.cyan('  │') + ` Company:     ${company}`);
      console.log(chalk.cyan('  │') + ` Location:    ${location}`);
      console.log(chalk.cyan('  │') + ` Public Repos: ${chalk.bold(pubRepos)}`);
      console.log(chalk.cyan('  └────────────────────────────────────┘'));
      console.log('');
      
      return login;
    }
  } catch (error) {
    logError('Failed to fetch user details: ' + error.message);
  }
  return null;
}

async function getRepos() {
  try {
    const output = await execCommand('gh', ['repo', 'list', '--json', 'name,owner,pushedAt', '-L', '100']);
    return JSON.parse(output);
  } catch (error) {
    logError('Failed to fetch repos: ' + error.message);
    return [];
  }
}

async function getWorkflowRuns(owner, repo, limit = 100) {
  try {
    const output = await execCommand('gh', [
      'run',
      'list',
      '--repo',
      `${owner}/${repo}`,
      '--json',
      'databaseId,number,name,status,conclusion,createdAt,updatedAt,headBranch,headSha',
      '-L',
      limit.toString()
    ]);
    return JSON.parse(output);
  } catch (error) {
    if (options.verbose) logError(`Failed to fetch runs for ${owner}/${repo}: ${error.message}`);
    return [];
  }
}

function formatStatus(status, conclusion) {
  if (status === 'in_progress') {
    return chalk.yellow('🔄 IN PROGRESS');
  }
  if (conclusion === 'success') {
    return chalk.green('✓ SUCCESS');
  }
  if (conclusion === 'failure') {
    return chalk.red('✗ FAILED');
  }
  if (conclusion === 'cancelled') {
    return chalk.gray('⊘ CANCELLED');
  }
  return chalk.gray('? ' + status);
}

function formatRunTime(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function createClickableLink(url, text) {
  // OSC 8 format for clickable links in terminals
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
}

async function streamRun(owner, repo, runNumber) {
  const key = `${owner}/${repo}#${runNumber}`;
  
  if (activeStreams.has(key)) return;
  activeStreams.add(key);

  logInfo(`🔴 STREAMING: ${key}`);

  try {
    await execCommand('gh', ['run', 'watch', runNumber, '--repo', `${owner}/${repo}`]);
    logSuccess(`STREAM ENDED: ${key}`);
  } catch (error) {
    if (options.verbose && !error.message.includes('signal')) {
      logError(`Stream error for ${key}: ${error.message}`);
    }
  } finally {
    activeStreams.delete(key);
  }
}

async function displayRepos(repos) {
  console.log('');
  console.log(chalk.cyan('  ┌─ Repositories ─────────────────────────────────────────┐'));
  console.log(chalk.cyan('  │'));
  
  const sortedRepos = repos
    .sort((a, b) => new Date(b.pushedAt) - new Date(a.pushedAt))
    .slice(0, 10);
  
  for (const repo of sortedRepos) {
    const pushDate = new Date(repo.pushedAt);
    const pushTime = pushDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    console.log(chalk.cyan('  │') + `  ${repo.name.padEnd(35)} ${chalk.gray(pushTime)}`);
  }
  
  if (repos.length > 10) {
    console.log(chalk.cyan('  │') + `  ${chalk.gray(`... and ${repos.length - 10} more repositories`)}`);
  }
  
  console.log(chalk.cyan('  │'));
  console.log(chalk.cyan('  └────────────────────────────────────────────────────────┘'));
  console.log('');
}

async function scanRepos(showMode = 'first') {
  if (showMode !== 'first') {
    console.log('\n');
  }
  
  console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════'));
  console.log(chalk.gray(`[${getTimestamp()}] > Starting deployment scan`));
  console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════'));
  console.log('');

  try {
    const repos = await getRepos();
    logSuccess(`Found ${repos.length} repositories`);
    
    if (showMode === 'first') {
      await displayRepos(repos);
    }

    // Collect all runs from all repos in parallel
    let allRuns = [];
    
    logInfo('Fetching deployment runs...');
    
    const runPromises = repos.map(async (repo) => {
      const runs = await getWorkflowRuns(repo.owner.login, repo.name, 100);
      return runs.map(run => ({
        ...run,
        repoName: repo.name,
        owner: repo.owner.login,
        repoFullName: `${repo.owner.login}/${repo.name}`
      }));
    });

    const results = await Promise.all(runPromises);
    allRuns = results.flat();

    // Sort by creation time (newest first)
    allRuns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Show mode determines what to display
    let runsToDisplay = [];
    let activeRuns = [];

    if (showMode === 'first') {
      // First app start: show last 100 runs
      runsToDisplay = allRuns.slice(0, 100);
      logSuccess(`Loaded last 100 deployment runs`);
    } else if (showMode === 'interval') {
      // After 30 minute interval: show only new runs from last 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      runsToDisplay = allRuns.filter(run => {
        const runTime = new Date(run.createdAt);
        return runTime >= thirtyMinutesAgo && !seenRuns.has(`${run.repoFullName}#${run.number}`);
      });
      
      if (runsToDisplay.length === 0) {
        logInfo(`No new runs in the last 30 minutes`);
      } else {
        logSuccess(`Found ${runsToDisplay.length} new run(s) in the last 30 minutes`);
      }
    }

    console.log('');
    console.log(chalk.cyan('  ┌─ Deployment Runs ──────────────────────────────────────┐'));
    console.log(chalk.cyan('  │'));

    // Display and track runs
    for (const run of runsToDisplay) {
      const runId = `${run.repoFullName}#${run.number}`;
      seenRuns.add(runId);

      const status = formatStatus(run.status, run.conclusion);
      const runTime = formatRunTime(run.createdAt);
      const runUrl = `https://github.com/${run.repoFullName}/actions/runs/${run.databaseId}`;
      const clickableRunId = createClickableLink(runUrl, `${run.repoFullName}#${run.number}`);
      
      console.log(chalk.cyan('  │') + ` ${chalk.gray(`[${runTime}`)}] ${status} ${clickableRunId} "${run.name}"`);
      
      if (run.status === 'in_progress') {
        activeRuns.push({
          owner: run.owner,
          repo: run.repoName,
          runNumber: run.number,
          name: run.name
        });
      }
    }

    console.log(chalk.cyan('  │'));
    console.log(chalk.cyan('  └────────────────────────────────────────────────────────┘'));
    console.log('');
    
    if (activeRuns.length > 0) {
      console.log(chalk.yellow(`🔴 ${chalk.bold(activeRuns.length)} active stream(s) found. Starting...\n`));
      for (const run of activeRuns) {
        streamRun(run.owner, run.repo, run.runNumber);
      }
    } else {
      console.log(chalk.gray(`Waiting for next scan in ${Math.floor(scanInterval / 60000)} minutes...`));
    }

    saveState(Date.now());

  } catch (error) {
    logError('Scan failed: ' + error.message);
  }
}

async function startup() {
  await showBanner();
  
  console.log('');
  
  // Check prerequisites
  const hasGH = await checkGHCLI();
  if (!hasGH) process.exit(1);
  
  const isAuth = await checkGHAuth();
  if (!isAuth) process.exit(1);
  
  console.log('');
  
  // Get user info
  const username = await getUserInfo();
  
  // Get repos
  const repos = await getRepos();
  logSuccess(`Found ${repos.length} repositories`);
  await displayRepos(repos);
  
  // Start scanning
  await sleep(1000);
  console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════'));
  console.log(chalk.green('✓ Ready to stream deployment logs'));
  console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════'));
  await sleep(1000);
  
  // Always load last 100 on app start
  await scanRepos('first');

  // Then scan every 30 minutes - show only new runs from last 30 min window
  setInterval(async () => {
    await scanRepos('interval');
  }, scanInterval);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\nShutting down...'));
  process.exit(0);
});

startup().catch(error => {
  logError(error.message);
  process.exit(1);
});
